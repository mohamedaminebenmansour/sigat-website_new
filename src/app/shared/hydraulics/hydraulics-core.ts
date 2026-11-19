/**
 * Shared hydraulic rendering & physics primitives (framework-free).
 */

export const G = 9.81;
export const SIGMA_RHO = 7.28e-5; // surface tension / density (m³/s²)

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ paths */
export type Seg =
  | ['L', number, number]
  | ['C', number, number, number, number, number, number]
  | ['Q', number, number, number, number];

export interface PathPoint { x: number; y: number; tx: number; ty: number; nx: number; ny: number; }

export class Path {
  readonly x: Float32Array; readonly y: Float32Array;
  readonly tx: Float32Array; readonly ty: Float32Array;
  readonly n: number; readonly length: number;
  constructor(readonly step: number, xs: number[], ys: number[]) {
    this.n = xs.length;
    this.x = Float32Array.from(xs); this.y = Float32Array.from(ys);
    this.tx = new Float32Array(this.n); this.ty = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(this.n - 1, i + 1);
      const dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a];
      const l = Math.hypot(dx, dy) || 1;
      this.tx[i] = dx / l; this.ty[i] = dy / l;
    }
    this.length = (this.n - 1) * step;
  }
  at(s: number): PathPoint {
    const f = Math.min(Math.max(s / this.step, 0), this.n - 1.0001);
    const i = Math.floor(f), t = f - i;
    const x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    const y = this.y[i] + (this.y[i + 1] - this.y[i]) * t;
    let tx = this.tx[i] + (this.tx[i + 1] - this.tx[i]) * t;
    let ty = this.ty[i] + (this.ty[i + 1] - this.ty[i]) * t;
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return { x, y, tx, ty, nx: -ty, ny: tx };
  }
  /** first arclength (searching from sFrom) where the path crosses the horizontal line y */
  sAtY(y: number, sFrom = 0): number {
    for (let i = Math.floor(sFrom / this.step); i < this.n - 1; i++) {
      const a = this.y[i] - y, b = this.y[i + 1] - y;
      if (a === 0) return i * this.step;
      if (a * b < 0) return (i + a / (a - b)) * this.step;
    }
    return this.length;
  }
}

export function buildPath(x0: number, y0: number, segs: Seg[], step = 2): Path {
  const rx: number[] = [x0], ry: number[] = [y0];
  let cx = x0, cy = y0;
  for (const s of segs) {
    if (s[0] === 'L') {
      const n = Math.max(2, Math.ceil(Math.hypot(s[1] - cx, s[2] - cy)));
      for (let i = 1; i <= n; i++) { rx.push(cx + (s[1] - cx) * i / n); ry.push(cy + (s[2] - cy) * i / n); }
      cx = s[1]; cy = s[2];
    } else if (s[0] === 'C') {
      const [, ax, ay, bx, by, ex, ey] = s;
      for (let i = 1; i <= 120; i++) {
        const t = i / 120, u = 1 - t;
        rx.push(u * u * u * cx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex);
        ry.push(u * u * u * cy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey);
      }
      cx = ex; cy = ey;
    } else {
      const [, ax, ay, ex, ey] = s;
      for (let i = 1; i <= 80; i++) {
        const t = i / 80, u = 1 - t;
        rx.push(u * u * cx + 2 * u * t * ax + t * t * ex);
        ry.push(u * u * cy + 2 * u * t * ay + t * t * ey);
      }
      cx = ex; cy = ey;
    }
  }
  const cum = [0];
  for (let i = 1; i < rx.length; i++) cum.push(cum[i - 1] + Math.hypot(rx[i] - rx[i - 1], ry[i] - ry[i - 1]));
  const total = cum[cum.length - 1];
  const xs: number[] = [], ys: number[] = [];
  let j = 0;
  for (let s = 0; s <= total; s += step) {
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    xs.push(rx[j] + (rx[j + 1] - rx[j]) * t); ys.push(ry[j] + (ry[j + 1] - ry[j]) * t);
  }
  if (xs.length < 2) { xs.push(cx); ys.push(cy); }
  return new Path(step, xs, ys);
}

export function tracePath(ctx: CanvasRenderingContext2D, p: Path, s0: number, s1: number, off: number) {
  const i0 = Math.max(0, Math.floor(s0 / p.step)), i1 = Math.min(p.n - 1, Math.ceil(s1 / p.step));
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const X = p.x[i] - p.ty[i] * off, Y = p.y[i] + p.tx[i] * off;
    i === i0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
  }
}

/* ------------------------------------------------------------------ glass pipe (brand style) */
export interface GlassPipeStyle {
  r: number;               // outer radius (px)
  flow: number;            // mean water velocity along the path (px/s), may be 0
  t: number;               // time (s)
  rings?: number[];        // arclengths of glowing coupling rings (manchettes)
  s0?: number; s1?: number;
  water?: boolean;         // filled with water (default true)
  hl?: 1 | -1;             // side of specular highlight
}

/**
 * Transparent glass pipe with turbulent water, white foam streaks advected by the flow and
 * glowing cyan coupling rings — matches the SIGAT pipe artwork.
 */
export function drawGlassPipe(ctx: CanvasRenderingContext2D, p: Path, st: GlassPipeStyle) {
  const r = st.r, s0 = st.s0 ?? 0, s1 = st.s1 ?? p.length, hl = st.hl ?? -1;
  if (s1 - s0 < 1) return;
  ctx.save();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  tracePath(ctx, p, s0, s1, 0);
  ctx.lineWidth = 2 * r + 10; ctx.strokeStyle = 'rgba(90,210,255,0.10)'; ctx.stroke();
  ctx.lineWidth = 2 * r; ctx.strokeStyle = 'rgba(185,232,255,0.38)'; ctx.stroke();
  if (st.water !== false) {
    ctx.lineWidth = 2 * r - 3; ctx.strokeStyle = 'rgba(20,130,230,0.62)'; ctx.stroke();
    ctx.lineWidth = r * 1.15; ctx.strokeStyle = 'rgba(70,185,255,0.5)'; ctx.stroke();
    ctx.lineWidth = r * 0.4; ctx.strokeStyle = 'rgba(175,235,255,0.32)'; ctx.stroke();
    // turbulent foam streaks: sinuous lines whose dashes are advected with the flow
    const i0 = Math.max(0, Math.floor(s0 / p.step)), i1 = Math.min(p.n - 1, Math.ceil(s1 / p.step));
    const v = st.flow;
    for (let k = 0; k < 4; k++) {
      const base = r * (-0.6 + 0.4 * k);
      const amp = r * (0.12 + 0.05 * k), fr = 0.035 + 0.012 * k, ph = k * 2.1;
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const s = i * p.step;
        const o = clamp(base + amp * Math.sin(s * fr - st.t * (1.5 + v * 0.02) + ph), -r + 2.5, r - 2.5);
        const X = p.x[i] - p.ty[i] * o, Y = p.y[i] + p.tx[i] * o;
        i === i0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.setLineDash([10 + k * 7, 16 + k * 5]);
      ctx.lineDashOffset = -st.t * v * (0.85 + 0.1 * k) - k * 13;
      ctx.lineWidth = 1.2 + (k % 2) * 0.6; ctx.strokeStyle = `rgba(255,255,255,${0.42 - k * 0.05})`; ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  tracePath(ctx, p, s0, s1, r); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(25,100,200,0.85)'; ctx.stroke();
  tracePath(ctx, p, s0, s1, -r); ctx.stroke();
  tracePath(ctx, p, s0, s1, hl * r * 0.55); ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.stroke();
  tracePath(ctx, p, s0, s1, -hl * r * 0.7); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  // glowing coupling rings
  for (const s of st.rings ?? []) {
    if (s < s0 || s > s1) continue;
    const a = p.at(s);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.ty, a.tx));
    ctx.shadowColor = 'rgba(80,240,255,0.95)'; ctx.shadowBlur = r * 0.9;
    ctx.strokeStyle = 'rgba(120,250,255,0.95)'; ctx.lineWidth = Math.max(1.6, r * 0.14);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 1.12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(200,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(r * 0.22, 0, r * 0.26, r * 1.05, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ droplet sprite */
export function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch = 0) {
  const tip = r * (1.2 + stretch);
  ctx.beginPath();
  ctx.moveTo(x, y - r - tip);
  ctx.bezierCurveTo(x + r * 0.35, y - r - tip * 0.4, x + r, y - r * 0.4, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.4, x - r * 0.35, y - r - tip * 0.4, x, y - r - tip);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.2, r * 0.1, x, y, r * 1.4);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(170,220,255,0.75)');
  g.addColorStop(1, 'rgba(40,130,230,0.7)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(20,90,190,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
}

/* ------------------------------------------------------------------ free-surface waves */
/**
 * Linear potential-flow water waves in a basin with reflecting walls, solved exactly per
 * cosine mode with the full gravity–capillary dispersion relation
 *   ω² = (g k + σ/ρ k³) tanh(k h),   damping γ = γ0 + 2 ν_eff k².
 * Units: metres internally, `ppm` pixels per metre for I/O.
 */
export class WaveField {
  readonly a: Float64Array; readonly b: Float64Array;
  L = 1; depth = 2;
  constructor(readonly M: number, public ppm: number, public gamma0 = 0.18, public nuEff = 1.5e-3) {
    this.a = new Float64Array(M + 1); this.b = new Float64Array(M + 1);
  }
  /** impulsive vertical surface-velocity kick at x (m), strength J (m/s), footprint w (m) */
  kick(x: number, J: number, w: number) {
    const L = this.L;
    for (let n = 1; n <= this.M; n++) {
      const k = (n * Math.PI) / L;
      this.b[n] += J * Math.cos(k * x) * Math.exp(-(((k * w) / 2) ** 2)) * (2 * w / L);
    }
  }
  step(dt: number) {
    const L = this.L, h = Math.max(0.05, this.depth);
    for (let n = 1; n <= this.M; n++) {
      const k = (n * Math.PI) / L;
      const w2 = (G * k + SIGMA_RHO * k * k * k) * Math.tanh(k * h);
      const gam = this.gamma0 + 2 * this.nuEff * k * k;
      for (let sub = 0; sub < 2; sub++) {
        const d = dt / 2;
        this.b[n] += (-w2 * this.a[n] - gam * this.b[n]) * d;
        this.a[n] += this.b[n] * d;
      }
    }
  }
  /** sample η (metres) at N+1 evenly spaced points across [0, L] */
  sample(out: Float32Array) {
    const N = out.length - 1;
    for (let i = 0; i <= N; i++) {
      const c1 = Math.cos((Math.PI * i) / N);
      let cPrev = 1, c = c1, eta = 0;
      for (let n = 1; n <= this.M; n++) { eta += this.a[n] * c; const nx = 2 * c1 * c - cPrev; cPrev = c; c = nx; }
      out[i] = eta;
    }
  }
}

/* ------------------------------------------------------------------ free jet */
export interface Slice { x: number; y: number; vx: number; vy: number; v0: number; w0: number; age: number; grp: number; id: number; dead: boolean; }

/** Free-falling jet: ballistic slices, continuity necking w = w0·√(v0/v), Plateau–Rayleigh break-up. */
export class Jet {
  slices: Slice[] = [];
  private grp = 0; private wasOn = false; private ids = 0;
  constructor(readonly breakAge: number, readonly g: number) { }
  emit(on: boolean, x: number, y: number, vx: number, vy: number, w: number) {
    if (!on) { this.wasOn = false; return; }
    if (!this.wasOn) this.grp++;
    this.wasOn = true;
    this.slices.push({ x, y, vx, vy, v0: Math.hypot(vx, vy), w0: w, age: 0, grp: this.grp, id: this.ids++, dead: false });
  }
  update(dt: number, hit: (s: Slice) => boolean, maxY = 1e9) {
    for (const s of this.slices) {
      s.vy += this.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
      if (!s.dead && hit(s)) s.dead = true;
    }
    this.slices = this.slices.filter(s => !s.dead && s.y < maxY);
  }
  width(s: Slice) { return s.w0 * Math.sqrt(s.v0 / Math.max(1, Math.hypot(s.vx, s.vy))); }
  get active() { return this.wasOn; }
  draw(ctx: CanvasRenderingContext2D, nozzle: { x: number; y: number } | null) {
    const sl = this.slices;
    let i = sl.length - 1;
    while (i >= 0) {
      const g = sl[i].grp;
      const pts: Slice[] = [];
      while (i >= 0 && sl[i].grp === g && sl[i].age < this.breakAge) { pts.push(sl[i]); i--; }
      while (i >= 0 && sl[i].grp === g) i--;
      if (pts.length < 1) continue;
      const all: { x: number; y: number; vx: number; vy: number; w: number }[] = [];
      if (nozzle && g === this.grp && this.wasOn) all.push({ x: nozzle.x, y: nozzle.y, vx: pts[0].vx, vy: pts[0].vy, w: pts[0].w0 });
      for (const p of pts) all.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, w: this.width(p) });
      if (all.length < 2) continue;
      const left: number[] = [], right: number[] = [];
      for (const p of all) {
        const v = Math.hypot(p.vx, p.vy) || 1;
        const nx = -p.vy / v, ny = p.vx / v, hw = p.w / 2;
        left.push(p.x + nx * hw, p.y + ny * hw); right.push(p.x - nx * hw, p.y - ny * hw);
      }
      ctx.beginPath();
      ctx.moveTo(left[0], left[1]);
      for (let k = 2; k < left.length; k += 2) ctx.lineTo(left[k], left[k + 1]);
      for (let k = right.length - 2; k >= 0; k -= 2) ctx.lineTo(right[k], right[k + 1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(110,190,255,0.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < all.length; k++) {
        const p = all[k]; const v = Math.hypot(p.vx, p.vy) || 1;
        const X = p.x - (p.vy / v) * p.w * 0.18, Y = p.y + (p.vx / v) * p.w * 0.18;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    for (const s of sl) {
      if (s.age < this.breakAge) continue;
      const w = this.width(s);
      const j = ((s.id * 9301 + 49297) % 233280) / 233280;
      if (s.id % 2 === 1 && j < 0.6) continue;
      drawDrop(ctx, s.x + (j - 0.5) * w * 0.8, s.y, Math.max(1, w * (0.42 + 0.25 * j)), Math.min(1.6, Math.hypot(s.vx, s.vy) / 500));
    }
  }
}
