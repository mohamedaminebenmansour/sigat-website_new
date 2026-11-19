/**
 * SIGAT hydraulic physics core (framework-free, canvas 2D).
 *
 *  - WaveSurface : 1D height-field water surface solved with the discrete
 *                  wave equation + restoring spring + viscous damping.
 *  - Droplets    : ballistic drops (gravity + quadratic air drag) that
 *                  impact a surface, inject momentum and throw a crown.
 *  - Bubbles     : buoyant bubbles with terminal velocity and wobble.
 *  - drawWater   : layered renderer (body gradient, back layer, light
 *                  shafts, caustics, crest highlight).
 *
 * All units are CSS pixels and seconds. Every class is allocation-light
 * (typed arrays, pooled particles) so it can run on mobile at 60fps.
 */

export const GRAVITY = 1650; // px/s² (≈ 9.81 m/s² at ~170 px/m on screen)

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------------ */
/* Wave surface                                                        */
/* ------------------------------------------------------------------ */

export interface WaveOptions {
  columns?: number;
  /** Wave propagation speed along the surface (px/s). */
  speed?: number;
  /** Restoring spring (1/s²) — pulls the surface back to rest. */
  stiffness?: number;
  /** Viscous damping (1/s). */
  damping?: number;
}

export class WaveSurface {
  readonly n: number;
  readonly h: Float32Array;
  readonly v: Float32Array;
  private readonly lap: Float32Array;
  width = 1;
  speed: number;
  stiffness: number;
  damping: number;
  /** Ambient swell amplitude (px) — the "always alive" motion. */
  swell = 6;
  time = 0;

  constructor(opts: WaveOptions = {}) {
    this.n = opts.columns ?? 120;
    this.h = new Float32Array(this.n);
    this.v = new Float32Array(this.n);
    this.lap = new Float32Array(this.n);
    this.speed = opts.speed ?? 320;
    this.stiffness = opts.stiffness ?? 14;
    this.damping = opts.damping ?? 1.6;
  }

  resize(width: number): void {
    this.width = Math.max(1, width);
  }

  /** Fixed-substep integration keeps the solver stable at any frame rate. */
  step(dt: number): void {
    this.time += dt;
    const sub = 1 / 240;
    let t = Math.min(dt, 1 / 20);
    while (t > 1e-6) {
      const h = Math.min(sub, t);
      this.integrate(h);
      t -= h;
    }
  }

  private integrate(dt: number): void {
    const { n, h, v, lap } = this;
    const dx = this.width / (n - 1);
    // CFL guard: c·dt/dx must stay < 1.
    const c = Math.min(this.speed, (0.9 * dx) / dt);
    const c2 = (c * c) / (dx * dx);
    for (let i = 0; i < n; i++) {
      const l = h[i > 0 ? i - 1 : 0]; // reflective walls
      const r = h[i < n - 1 ? i + 1 : n - 1];
      lap[i] = l + r - 2 * h[i];
    }
    for (let i = 0; i < n; i++) {
      const a = c2 * lap[i] - this.stiffness * h[i] - this.damping * v[i];
      v[i] += a * dt;
      h[i] += v[i] * dt;
    }
  }

  /** Inject vertical momentum (px/s, positive = push down) around x (px). */
  splash(x: number, velocity: number, radius = 22): void {
    const { n } = this;
    const dx = this.width / (n - 1);
    const c = x / dx;
    const r = Math.max(1, radius / dx);
    const i0 = Math.max(0, Math.floor(c - r));
    const i1 = Math.min(n - 1, Math.ceil(c + r));
    for (let i = i0; i <= i1; i++) {
      const d = (i - c) / r;
      const w = Math.exp(-d * d * 2.2);
      this.v[i] += velocity * w;
    }
  }

  /** Displacement (px, positive = down) at x including ambient swell. */
  offsetAt(x: number): number {
    const dx = this.width / (this.n - 1);
    const f = clamp(x / dx, 0, this.n - 1.0001);
    const i = Math.floor(f);
    const t = f - i;
    return this.h[i] + (this.h[i + 1] - this.h[i]) * t + this.swellAt(x);
  }

  swellAt(x: number): number {
    const t = this.time;
    const s = this.swell;
    return (
      s * Math.sin(x * 0.0105 - t * 1.25) +
      s * 0.55 * Math.sin(x * 0.023 + t * 1.9 + 1.3) +
      s * 0.25 * Math.sin(x * 0.051 - t * 2.7 + 0.4)
    );
  }

  energy(): number {
    let e = 0;
    for (let i = 0; i < this.n; i++) e += this.v[i] * this.v[i];
    return e / this.n;
  }
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

export interface Drop {
  x: number; y: number; vx: number; vy: number; r: number; alive: boolean;
}

export type SurfaceFn = (x: number) => number;

export class Droplets {
  readonly pool: Drop[] = [];
  /** Quadratic air-drag coefficient (1/px). */
  drag = 0.0009;
  /** Scales the momentum a drop hands to the surface (dense streams use < 1). */
  impact = 1;

  spawn(x: number, y: number, vx: number, vy: number, r: number): void {
    let d = this.pool.find(p => !p.alive);
    if (!d) {
      if (this.pool.length > 420) return;
      d = { x: 0, y: 0, vx: 0, vy: 0, r: 0, alive: false };
      this.pool.push(d);
    }
    d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.r = r; d.alive = true;
  }

  /**
   * Advance drops; on impact with the surface the drop transfers its
   * momentum (m·v ∝ r²·v) into the wave and, above a Weber-like threshold,
   * throws a crown of secondary droplets.
   */
  step(dt: number, surface: SurfaceFn | null, wave: WaveSurface | null, bottom: number): void {
    for (const d of this.pool) {
      if (!d.alive) continue;
      const sp = Math.hypot(d.vx, d.vy);
      const k = this.drag * sp;
      d.vx -= d.vx * k * dt;
      d.vy += (GRAVITY - d.vy * k) * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (surface && d.vy > 0 && d.y >= surface(d.x)) {
        d.alive = false;
        if (wave) {
          wave.splash(d.x, d.vy * (d.r * d.r) * 0.016 * this.impact, d.r * 4 + 10);
          if (d.vy > 380 && d.r > 1.6 && Math.random() < this.impact) {
            const crown = Math.min(7, Math.floor(d.r * 1.4));
            for (let c = 0; c < crown; c++) {
              const a = -Math.PI / 2 + rand(-1.05, 1.05);
              const s = d.vy * rand(0.18, 0.34);
              this.spawn(d.x, surface(d.x) - 2, Math.cos(a) * s, Math.sin(a) * s, d.r * rand(0.28, 0.5));
            }
          }
        }
      } else if (d.y > bottom + 40) {
        d.alive = false;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, tint = 'rgba(214,236,255,0.92)'): void {
    ctx.save();
    for (const d of this.pool) {
      if (!d.alive) continue;
      const sp = Math.hypot(d.vx, d.vy);
      const stretch = 1 + Math.min(2.2, sp / 900);
      const ang = Math.atan2(d.vy, d.vx);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(ang);
      ctx.scale(stretch, 1 / Math.sqrt(stretch));
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.r * 0.25, -d.r * 0.3, d.r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

export interface Bubble { x: number; y: number; r: number; phase: number; alive: boolean; }

export class Bubbles {
  readonly pool: Bubble[] = [];

  spawn(x: number, y: number, r: number): void {
    let b = this.pool.find(p => !p.alive);
    if (!b) {
      if (this.pool.length > 260) return;
      b = { x: 0, y: 0, r: 0, phase: 0, alive: false };
      this.pool.push(b);
    }
    b.x = x; b.y = y; b.r = r; b.phase = Math.random() * 6.28; b.alive = true;
  }

  /** Stokes-ish terminal velocity: v ∝ r², capped (bubbles flatten). */
  step(dt: number, surface: SurfaceFn, wave: WaveSurface | null): void {
    for (const b of this.pool) {
      if (!b.alive) continue;
      const vt = Math.min(210, 9 * b.r * b.r + 22);
      b.phase += dt * (3 + b.r * 0.4);
      b.y -= vt * dt;
      b.x += Math.sin(b.phase) * 18 * dt * Math.min(1, b.r / 3);
      b.r *= 1 + dt * 0.035; // expands as hydrostatic pressure drops
      if (b.y - b.r <= surface(b.x)) {
        b.alive = false;
        if (wave) wave.splash(b.x, -b.r * 9, b.r * 3 + 6);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, alpha = 1): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    for (const b of this.pool) {
      if (!b.alive) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(190,225,255,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

export interface WaterPalette {
  surface: string; // colour right under the crest
  body: string;    // mid-depth
  deep: string;    // bottom colour (should match the next section)
  alpha?: number;  // body opacity (lets submerged content show through)
}

export const SIGAT_WATER: WaterPalette = {
  surface: 'rgba(96,190,255,0.80)',
  body: 'rgba(18,108,196,0.90)',
  deep: '#04294f'
};

/** Trace the surface polyline (left→right) for a level y0. */
function traceSurface(ctx: CanvasRenderingContext2D, wave: WaveSurface, y0: number, w: number, phase = 0): void {
  const steps = Math.max(40, Math.min(200, Math.round(w / 8)));
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = y0 + (phase ? wave.swellAt(x + phase) * 0.8 : wave.offsetAt(x));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

/**
 * Draw a body of water whose rest level is `y0` inside a w×h box.
 * Layers (back→front): parallax back wave, body, light shafts, caustics,
 * crest highlight + foam on steep slopes.
 */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  wave: WaveSurface,
  y0: number,
  w: number,
  h: number,
  pal: WaterPalette = SIGAT_WATER,
  opts: { shafts?: boolean; caustics?: boolean } = {}
): void {
  if (y0 > h + 30) return;
  const t = wave.time;
  const top = Math.max(-40, y0 - 40);

  // 1. Back layer — slower parallax swell gives depth.
  ctx.beginPath();
  traceSurface(ctx, wave, y0 - 7, w, 140);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = 'rgba(70,160,235,0.35)';
  ctx.fill();

  // 2. Body.
  const g = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, h));
  g.addColorStop(0, pal.surface);
  g.addColorStop(Math.min(0.5, 220 / Math.max(1, h - top)), pal.body);
  g.addColorStop(1, pal.deep);
  ctx.beginPath();
  traceSurface(ctx, wave, y0, w, 0);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.save();
  ctx.globalAlpha = pal.alpha ?? 1;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Clip everything below to the water body.
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';

  // 3. Light shafts (god rays) refracted from the surface.
  if (opts.shafts !== false) {
    for (let i = 0; i < 6; i++) {
      const cx = ((i + 0.5) / 6) * w + Math.sin(t * 0.25 + i * 1.7) * w * 0.05;
      const sw = 40 + 50 * (0.5 + 0.5 * Math.sin(t * 0.4 + i));
      const len = Math.min(h - y0, 520);
      const sg = ctx.createLinearGradient(0, y0, 0, y0 + len);
      sg.addColorStop(0, `rgba(170,220,255,${0.10 + 0.05 * Math.sin(t * 0.7 + i * 2)})`);
      sg.addColorStop(1, 'rgba(170,220,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(cx - sw * 0.5, y0);
      ctx.lineTo(cx + sw * 0.5, y0);
      ctx.lineTo(cx + sw * 1.6 + 60, y0 + len);
      ctx.lineTo(cx - sw * 0.2 + 60, y0 + len);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 4. Caustic ribbons just under the surface.
  if (opts.caustics !== false) {
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 5; k++) {
      const yy = y0 + 18 + k * 22;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 18) {
        const y = yy + wave.offsetAt(x) * 0.5 +
          Math.sin(x * 0.03 + t * (1.2 + k * 0.2) + k) * 6 +
          Math.sin(x * 0.071 - t * 1.7) * 3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(190,235,255,${0.10 - k * 0.016})`;
      ctx.stroke();
    }
  }
  ctx.restore();

  // 5. Crest highlight + foam where the surface is steep.
  ctx.beginPath();
  traceSurface(ctx, wave, y0, w, 0);
  ctx.strokeStyle = 'rgba(235,248,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const dx = w / (wave.n - 1);
  for (let i = 1; i < wave.n - 1; i++) {
    const slope = Math.abs(wave.h[i + 1] - wave.h[i - 1]) / (2 * dx);
    if (slope > 0.35) {
      const x = i * dx;
      const y = y0 + wave.offsetAt(x);
      const n = Math.min(4, Math.floor(slope * 5));
      for (let f = 0; f < n; f++) {
        ctx.beginPath();
        ctx.arc(x + rand(-dx, dx), y + rand(-3, 2), rand(0.8, 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Canvas helper                                                       */
/* ------------------------------------------------------------------ */

/** Resize a canvas to its CSS box with a capped device-pixel ratio. */
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 1.5): { w: number; h: number; ctx: CanvasRenderingContext2D } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}
