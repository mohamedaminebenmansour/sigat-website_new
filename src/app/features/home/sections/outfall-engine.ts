/**
 * OUTFALL — a PE100 main discharging into a pool, drawn to be read by a hydraulic engineer.
 *
 * In the pipe: open-channel flow arriving near critical depth yc; at the free overfall the surface draws
 * down and the brink depth is yb ≈ 0.75·yc (end-depth ratio of a circular free overfall).
 *   Q = Vc·Ac with Vc = √(g·A/T) at yc;  brink velocity Vb = Q / A(yb).
 * The nappe: every water parcel is a projectile, x = x0 − Vb·τ, y = y0 + ½·g·τ² (τ = time of flight).
 *   Thickness by continuity, q = h·|v| → h(τ) = yb·Vb / |v(τ)|: the jet thins as it accelerates.
 *   Surface disturbances are carried WITH the water (they are functions of the parcel's exit time t − τ)
 *   and their amplitude grows with the fall (turbulence from the pipe, Ervine & Falvey); the nappe
 *   aerates (whitens) and its edges shed ligaments and drops.
 * The plunge: the momentum flux pushes the surface down (cavity, waves both ways); air is entrained
 *   into a bubble plume that follows the jet direction, decelerates as a submerged jet and penetrates to
 *   a depth set by the impact momentum (Clanet & Lasheras); bubbles then rise at their terminal speed
 *   (bigger = faster), the plume boils up downstream, bubbles burst into foam that drifts away on the
 *   surface outflow. Splash drops are thrown up mostly forward and fall back (their own little splashes).
 * Scale: 1 m ≈ 170 px, g = 1650 px/s².
 */
import { GRAVITY, WaveSurface, clamp, drawWater, rand } from '../../../shared/hydro/hydro-physics';

const G = GRAVITY;
interface Drop { x: number; y: number; vx: number; vy: number; r: number; }
interface Bub { x: number; y: number; vx: number; vy: number; r: number; ph: number; age: number; }
interface Foam { x: number; vx: number; r: number; life: number; max: number; }
interface Mark { te: number; k: number; len: number; }
interface Ring { x: number; r: number; v: number; a: number; }

/** area of a circular segment of depth y in a pipe of diameter D */
const segA = (y: number, D: number) => { const th = 2 * Math.acos(clamp(1 - 2 * y / D, -1, 1)); return D * D / 8 * (th - Math.sin(th)); };
/** top width of the water surface at depth y */
const segT = (y: number, D: number) => 2 * Math.sqrt(Math.max(0, y * (D - y)));

export class OutfallEngine {
  private ctx: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1; private narrow = false;
  readonly wave = new WaveSurface({ columns: 220, speed: 300, stiffness: 7, damping: 1.4 });
  // geometry
  private R = 60; private Ri = 50; private ox = 0; private oy = 0; private yP = 0;
  // hydraulics
  private flow = 0; private target = 1;
  private yb = 0; private vb = 0; private fall = 0.5; private xi = 0; private vxi = 0; private vyi = 0;
  // life
  private t = 0;
  private drops: Drop[] = []; private spray: Drop[] = []; private bubs: Bub[] = []; private foam: Foam[] = []; private marks: Mark[] = []; private rings: Ring[] = [];
  private shed = 0; private markClock = 0; private sprayClock = 0; private bubClock = 0; private lipClock = 0.6; private ringClock = 0;

  constructor(private canvas: HTMLCanvasElement, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.wave.swell = 2.6;
    if (reduced) this.flow = 1;
  }

  /** more or less flow (the CTA "opens the valve") */
  setDemand(f: number) { this.target = f; }

  resize(w: number, h: number) {
    this.W = w; this.H = h; this.narrow = w < 768;
    this.dpr = Math.min(1.75, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const n = this.narrow;
    this.R = n ? clamp(w * 0.105, 28, 44) : clamp(Math.min(w * 0.062, h * 0.1), 44, 92);
    this.Ri = this.R * (1 - 2 / 17);                         // PE100 SDR 17: wall = OD / 17
    this.ox = w * (n ? 0.7 : 0.74);
    this.oy = h * (n ? 0.3 : 0.42);
    this.yP = h * (n ? 0.72 : 0.77);
    this.wave.resize(w);
    this.hydraulics();
  }

  /* ------------------------------------------------------------------ hydraulics */
  private hydraulics() {
    const D = 2 * this.Ri;
    const yc = clamp(0.5 * Math.pow(Math.max(0.05, this.flow), 0.6), 0.05, 0.62) * D;
    const Ac = segA(yc, D), Vc = Math.sqrt(G * Ac / Math.max(1, segT(yc, D)));
    const Q = Vc * Ac;
    this.yb = 0.75 * yc;                                      // end-depth ratio of a circular free overfall
    this.vb = Q / Math.max(1, segA(this.yb, D));
    const y0 = this.oy + this.Ri;                             // invert at the brink
    this.fall = Math.sqrt(2 * Math.max(1, this.yP - y0) / G);
    this.xi = this.ox - this.vb * this.fall;
    this.vxi = -this.vb; this.vyi = G * this.fall;
  }

  /** a parcel that left the brink τ seconds ago, on the lower (k = 0) or upper (k = 1) nappe surface */
  private parcel(tau: number, k: number) {
    const x = this.ox - this.vb * tau, y = this.oy + this.Ri + 0.5 * G * tau * tau;
    const vx = -this.vb, vy = G * tau, v = Math.hypot(vx, vy);
    const h = this.yb * this.vb / v;                          // continuity
    const nx = -vy / v, ny = vx / v;                          // normal pointing to the upper/outer side
    return { x: x - nx * h * k, y: y + ny * h * k, vx, vy, v, h, nx: -nx, ny };
  }

  /** advected roughness: a function of the parcel's exit time u = t − τ, growing with the fall */
  private rough(tau: number, side: number) {
    const u = this.t - tau, s = tau / this.fall;
    const h = this.yb * this.vb / Math.hypot(this.vb, G * tau);        // local thickness: roughness never cuts the jet
    const amp = h * (0.05 + 0.32 * s * s) * (0.6 + 0.4 * this.flow);
    return amp * (Math.sin(u * 19 + side * 2.1) * 0.55 + Math.sin(u * 37 + side * 0.7) * 0.3 + Math.sin(u * 71 + side * 4.4) * 0.15);
  }

  private surfaceY = (x: number) => this.yP + this.wave.offsetAt(x);

  /* ------------------------------------------------------------------ frame */
  frame(dt: number) {
    dt = Math.min(dt, 1 / 30);
    if (dt > 0) {
      this.t += dt;
      this.flow += (this.target - this.flow) * Math.min(1, dt * 0.8);   // valve opened slowly (no surge)
      this.hydraulics();
      this.simulate(dt);
    }
    this.draw();
  }

  private simulate(dt: number) {
    const { flow, wave } = this;
    wave.step(dt);
    if (flow < 0.03) return;
    const vi = Math.hypot(this.vxi, this.vyi), hi = this.yb * this.vb / vi;
    // momentum flux of the nappe pushes the surface down at the plunge point; the plume boils up downstream
    wave.splash(this.xi, this.vyi * flow * dt * 0.9, Math.max(14, hi * 1.6));
    wave.splash(this.xi - this.vb * 0.22, -this.vyi * flow * dt * 0.28, hi * 3);
    if (Math.random() < dt * 3) wave.splash(this.xi + rand(-hi, hi), rand(40, 110) * flow, rand(8, 16));

    this.ringClock -= dt;
    if (this.ringClock <= 0) { this.ringClock = rand(0.16, 0.32); this.rings.push({ x: this.xi + rand(-hi, hi) * 0.5, r: hi * 0.6, v: rand(55, 75), a: 0.55 * flow }); }
    for (const r of this.rings) { r.r += r.v * dt; r.a -= dt * 0.22; r.v *= Math.exp(-dt * 0.35); }
    this.rings = this.rings.filter(r => r.a > 0.01);
    // streak marks carried by the water (stretch as the jet accelerates)
    this.markClock -= dt;
    if (this.markClock <= 0) { this.markClock = rand(0.03, 0.07); this.marks.push({ te: this.t, k: rand(0.15, 0.85), len: rand(0.012, 0.03) }); }
    this.marks = this.marks.filter(m => this.t - m.te < this.fall + m.len);

    // break-up: ligaments and drops leave the roughened edges in the lower half of the fall
    this.shed -= dt;
    while (this.shed <= 0 && this.drops.length < 260) {
      this.shed += 0.012 / flow;
      const tau = this.fall * rand(0.45, 0.97), k = Math.random() < 0.6 ? 1 : 0, p = this.parcel(tau, k);
      const push = rand(15, 70) * (k ? 1 : -1);
      this.drops.push({ x: p.x, y: p.y, vx: p.vx + p.nx * push + rand(-15, 15), vy: p.vy + p.ny * push, r: rand(0.9, 2.6) * (0.7 + 0.3 * flow) });
    }
    // a thin film clings to the outer wall below the lip and drips (low-velocity part of the profile)
    this.lipClock -= dt;
    if (this.lipClock <= 0) { this.lipClock = rand(0.25, 0.7); this.drops.push({ x: this.ox - this.R * 0.05, y: this.oy + this.R, vx: -rand(5, 25), vy: rand(10, 40), r: rand(1.6, 2.6) }); }

    // splash crown at the plunge: thrown up, mostly forward (the jet's horizontal momentum)
    this.sprayClock -= dt;
    while (this.sprayClock <= 0 && this.spray.length < 220) {
      this.sprayClock += 0.01 / flow;
      const up = rand(0.12, 0.42) * vi;
      this.spray.push({ x: this.xi + rand(-hi, hi), y: this.surfaceY(this.xi) - 2, vx: (Math.random() < 0.72 ? -1 : 0.6) * rand(0.05, 0.28) * vi, vy: -up, r: rand(0.8, 2.4) });
    }

    // air entrainment: bubbles enter along the jet direction, decelerate as a submerged jet
    this.bubClock -= dt;
    const depth = this.H - this.yP, k = (this.vyi / Math.max(40, depth * 0.55));     // penetration ≈ 0.55 × pool depth
    while (this.bubClock <= 0 && this.bubs.length < 380) {
      this.bubClock += 0.006 / flow;
      const s = rand(0.35, 0.8), r = Math.random() < 0.12 ? rand(3.5, 6.5) : rand(0.8, 3);
      this.bubs.push({ x: this.xi + rand(-hi, hi) * 0.7, y: this.surfaceY(this.xi) + rand(2, 10), vx: this.vxi * s, vy: this.vyi * s, r, ph: rand(0, 6.28), age: 0 });
    }
    for (const b of this.bubs) {
      b.age += dt;
      const decay = Math.exp(-k * dt);
      b.vx *= decay; b.vy *= decay;
      const rise = clamp(14 * Math.sqrt(b.r), 18, 48);               // terminal rise ≈ 0.1–0.28 m/s
      b.x += (b.vx + Math.sin(b.ph + b.age * 9) * 18 * (1 - Math.exp(-b.age * 3))) * dt;
      b.y += (b.vy - rise) * dt;
      b.ph += dt * 3;
    }
    const keep: Bub[] = [];
    for (const b of this.bubs) {
      if (b.y <= this.surfaceY(b.x) + 1 && b.age > 0.15) {          // burst → foam
        if (this.foam.length < 240 && Math.random() < 0.6) this.foam.push({ x: b.x, vx: 0, r: b.r * rand(1, 1.8), life: 0, max: rand(1.8, 4.5) });
      } else if (b.age < 6) keep.push(b);
    }
    this.bubs = keep;
    // foam rides the radial surface outflow away from the plunge and decays
    for (const f of this.foam) {
      const d = f.x - this.xi, dir = Math.sign(d) || -1;
      f.vx += (dir * 70 * Math.exp(-Math.abs(d) / 220) - f.vx * 0.9) * dt;
      f.x += f.vx * dt; f.life += dt;
    }
    this.foam = this.foam.filter(f => f.life < f.max);
    // ballistic drops (jet drops + splash) — on reaching the water they make their own small splash
    for (const list of [this.drops, this.spray]) {
      for (const d of list) { d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
    }
    const land = (d: Drop) => {
      if (d.y < this.surfaceY(d.x)) return true;
      wave.splash(d.x, d.vy * d.r * 0.025, 5 + d.r * 2);
      if (d.r > 1.3 && this.rings.length < 90) this.rings.push({ x: d.x, r: d.r, v: rand(35, 55), a: 0.4 });
      if (d.r > 1.6 && this.bubs.length < 380) this.bubs.push({ x: d.x, y: this.surfaceY(d.x) + 3, vx: 0, vy: 20, r: d.r * 0.5, ph: 0, age: 0.1 });
      return false;
    };
    this.drops = this.drops.filter(d => d.x > -20 && land(d));
    this.spray = this.spray.filter(d => d.x > -20 && land(d));
  }

  /* ------------------------------------------------------------------ drawing */
  private draw() {
    const g = this.ctx, { W, H } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    this.drawPipeBody(g);
    this.drawOutlet(g);
    this.drawNappe(g);
    this.drawDrops(g, this.drops);
    // pool (deep colour = the colour the footer takes over)
    drawWater(g, this.wave, this.yP, W, H, { surface: 'rgba(120,205,250,0.78)', body: 'rgba(22,112,200,0.9)', deep: '#0b4c91' }, { shafts: !this.narrow });
    this.drawReflection(g);
    this.drawRings(g);
    this.drawGlints(g);
    this.drawPlume(g);
    this.drawBubbles(g);
    this.drawFoam(g);
    this.drawDrops(g, this.spray);
    this.drawMist(g);
  }

  /** the pipe mirrored in the pool: a weak (Fresnel) reflection that fades with distance from the surface.
   *  The jet is not mirrored — the surface under it is too churned to give a clean image. */
  private drawReflection(g: CanvasRenderingContext2D) {
    const { yP, W } = this, band = Math.min(this.H - yP, (yP - (this.oy - this.R)) * 0.9);
    if (band <= 4) return;
    g.save();
    g.beginPath(); g.rect(this.xi + 60, yP + 3, W, band); g.clip();
    g.globalAlpha = 0.12;
    g.translate(0, 2 * yP + 4 + Math.sin(this.t * 1.3) * 1.5); g.scale(1, -1);
    this.drawPipeBody(g);
    g.restore();
  }

  /** rings spreading on the surface, seen at a grazing angle (flattened ellipses) */
  private drawRings(g: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      const y = this.surfaceY(r.x) + 1;
      g.strokeStyle = `rgba(240,250,255,${r.a})`; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(r.x, y, r.r, Math.max(1, r.r * 0.11), 0, 0, 7); g.stroke();
    }
  }

  /** sun glints: specular sparkles where a wave facet faces the light */
  private drawGlints(g: CanvasRenderingContext2D) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 34; i++) {
      const x = ((i * 0.6180339 * this.W) + this.t * (8 + (i % 5) * 4)) % this.W;
      const a = Math.pow(Math.max(0, Math.sin(this.t * (1.6 + (i % 7) * 0.3) + i * 2.3)), 10);
      if (a < 0.05) continue;
      g.globalAlpha = a * 0.9;
      g.fillRect(x - 4, this.surfaceY(x) + 2 + (i % 4) * 5, 8, 1.4);
    }
    g.globalAlpha = 1;
  }

  private drawPipeBody(g: CanvasRenderingContext2D) {
    const { ox, oy, R, W } = this;
    const body = g.createLinearGradient(0, oy - R, 0, oy + R);
    body.addColorStop(0, '#0e1318'); body.addColorStop(0.2, '#3d4955'); body.addColorStop(0.32, '#1f2730');
    body.addColorStop(0.8, '#0a0d11'); body.addColorStop(1, '#161c22');
    g.fillStyle = body; g.fillRect(ox, oy - R, W - ox + 4, 2 * R);
    // blue co-extruded stripes = potable water PE (seen on the visible half: two of the four)
    g.strokeStyle = '#2f8fe0'; g.lineWidth = Math.max(2, R * 0.045);
    for (const f of [-0.55, 0.42]) { g.beginPath(); g.moveTo(ox + R * 0.3 * Math.sqrt(1 - f * f), oy + f * R); g.lineTo(W + 4, oy + f * R); g.stroke(); }
    // electrofusion coupler (thicker band, terminal pin)
    const cx = ox + R * 0.45;
    g.fillStyle = '#1b2229'; g.fillRect(cx, oy - R * 1.05, R * 0.4, R * 2.1);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(cx, oy - R * 1.05, R * 0.4, R * 0.35);
    g.fillStyle = '#ff7a1a'; g.fillRect(cx + R * 0.15, oy - R * 1.2, R * 0.1, R * 0.18);
    const cx2 = ox + R * 4.2;
    if (cx2 < W - R * 0.5) { g.fillStyle = '#1b2229'; g.fillRect(cx2, oy - R * 1.05, R * 0.4, R * 2.1); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(cx2, oy - R * 1.05, R * 0.4, R * 0.35); }
  }

  /** the outlet seen at three-quarter: wall thickness, dark bore, the free-surface flow drawn down to yb */
  private drawOutlet(g: CanvasRenderingContext2D) {
    const { ox, oy, R, Ri } = this, rx = R * 0.32, ri = Ri / R;
    g.beginPath(); g.ellipse(ox, oy, rx, R, 0, 0, Math.PI * 2); g.fillStyle = '#2a333c'; g.fill();
    const bore = g.createLinearGradient(ox - rx, 0, ox + rx, 0);
    bore.addColorStop(0, '#030507'); bore.addColorStop(1, '#141b22');
    g.beginPath(); g.ellipse(ox, oy, rx * ri, Ri, 0, 0, Math.PI * 2); g.fillStyle = bore; g.fill();
    if (this.flow > 0.03) {
      g.save(); g.beginPath(); g.ellipse(ox, oy, rx * ri, Ri, 0, 0, Math.PI * 2); g.clip();
      const top = oy + Ri - this.yb, wob = Math.sin(this.t * 6) * 0.8;
      // the drawdown seen through the bore: deeper inside the pipe (yc), down to yb at the lip
      g.beginPath(); g.moveTo(ox + rx, oy + Ri - this.yb / 0.75 + wob); g.lineTo(ox - rx, top + wob); g.lineTo(ox - rx, oy + R); g.lineTo(ox + rx, oy + R); g.closePath();
      const wg = g.createLinearGradient(0, top, 0, oy + Ri);
      wg.addColorStop(0, 'rgba(150,215,255,0.95)'); wg.addColorStop(1, 'rgba(20,95,180,0.95)');
      g.fillStyle = wg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(ox + rx, oy + Ri - this.yb / 0.75 + wob); g.lineTo(ox - rx, top + wob); g.stroke();
      g.restore();
    }
    g.beginPath(); g.ellipse(ox, oy, rx, R, 0, Math.PI * 0.55, Math.PI * 1.45);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.6; g.stroke();
  }

  /** the nappe: two roughened surfaces, clear and glassy at the lip, aerated and white near the pool */
  private drawNappe(g: CanvasRenderingContext2D) {
    if (this.flow < 0.03) return;
    const n = 48, lo: number[][] = [], up: number[][] = [];
    let tEnd = this.fall;
    for (let i = 0; i <= n; i++) {
      const tau = (i / n) * this.fall * 1.02;
      const a = this.parcel(tau, 0), b = this.parcel(tau, 1);
      const ra = this.rough(tau, 0), rb = this.rough(tau, 1);
      const pa = [a.x - a.nx * ra, a.y - a.ny * ra], pb = [b.x + b.nx * rb, b.y + b.ny * rb];
      if (pa[1] > this.surfaceY(pa[0]) + 4) { tEnd = tau; lo.push([pa[0], this.surfaceY(pa[0]) + 4]); up.push([pb[0], Math.min(pb[1], this.surfaceY(pb[0]) + 4)]); break; }
      lo.push(pa); up.push(pb);
    }
    const xe = this.ox - this.vb * tEnd, ye = this.yP;
    const path = () => { g.beginPath(); up.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = lo.length - 1; i >= 0; i--) g.lineTo(lo[i][0], lo[i][1]); g.closePath(); };
    // body: glassy blue at the lip → aerated white at the plunge
    const body = g.createLinearGradient(this.ox, this.oy + this.Ri, xe, ye);
    body.addColorStop(0, 'rgba(40,140,230,0.92)'); body.addColorStop(0.5, 'rgba(95,180,245,0.92)'); body.addColorStop(0.85, 'rgba(200,232,255,0.95)'); body.addColorStop(1, 'rgba(245,251,255,0.97)');
    path(); g.fillStyle = body; g.fill();
    g.save(); path(); g.clip();
    // darker refracting core near the lip (the jet is a thick lens of water there)
    g.globalAlpha = 0.35; g.strokeStyle = '#1565c0'; g.lineWidth = Math.max(1, this.yb * 0.35);
    g.beginPath(); for (let i = 0; i < lo.length * 0.5; i++) { const x = (lo[i][0] + up[i][0]) / 2, y = (lo[i][1] + up[i][1]) / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.globalAlpha = 1;
    // streaks advected with the parcels (each spans exit times [te, te+len] → it stretches as it accelerates)
    g.lineCap = 'round';
    for (const m of this.marks) {
      const t0 = this.t - m.te, t1 = Math.max(0, t0 - m.len * (1 + t0 * 3));
      if (t0 <= 0) continue;
      g.beginPath();
      for (let j = 0; j <= 4; j++) {
        const tau = t1 + (Math.min(t0, tEnd) - t1) * j / 4, a = this.parcel(tau, m.k);
        j ? g.lineTo(a.x, a.y) : g.moveTo(a.x, a.y);
      }
      g.strokeStyle = `rgba(255,255,255,${0.35 + 0.45 * Math.min(1, t0 / this.fall)})`; g.lineWidth = 1.3; g.stroke();
    }
    // aeration texture in the lower fall: white flecks travelling with the flow
    for (let i = 0; i < 40; i++) {
      const tau = ((i * 0.618 + this.t * 1.7) % 1) * tEnd;
      if (tau < this.fall * 0.4) continue;
      const a = this.parcel(tau, (i * 0.37) % 1);
      g.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * tau / this.fall})`;
      g.beginPath(); g.ellipse(a.x, a.y, 1.6 + 2 * tau / this.fall, 1, Math.atan2(a.vy, a.vx), 0, 7); g.fill();
    }
    g.restore();
    // edges: a bright specular line on the upper (outer) surface, a softer one below
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6; g.beginPath(); up.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = 'rgba(230,245,255,0.5)'; g.lineWidth = 1; g.beginPath(); lo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }

  /** drops drawn with their motion blur (a 1/90 s streak along the velocity) */
  private drawDrops(g: CanvasRenderingContext2D, list: Drop[]) {
    g.lineCap = 'round';
    for (const d of list) {
      const bl = 1 / 90;
      g.strokeStyle = 'rgba(225,242,255,0.85)'; g.lineWidth = d.r * 1.6;
      g.beginPath(); g.moveTo(d.x - d.vx * bl, d.y - d.vy * bl); g.lineTo(d.x, d.y); g.stroke();
    }
  }

  /** the aerated plume under the plunge: white water following the jet direction, fading with depth */
  private drawPlume(g: CanvasRenderingContext2D) {
    if (this.flow < 0.03) return;
    const depth = (this.H - this.yP) * 0.55, ang = Math.atan2(this.vyi, this.vxi);
    const s = this.surfaceY(this.xi);
    g.save();
    g.translate(this.xi, s); g.rotate(ang - Math.PI / 2);
    const L = depth / Math.max(0.3, Math.sin(ang)), wdt = L * 0.28 * (0.9 + 0.1 * Math.sin(this.t * 7));
    const gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, `rgba(235,248,255,${0.6 * this.flow})`); gr.addColorStop(0.5, `rgba(200,232,255,${0.25 * this.flow})`); gr.addColorStop(1, 'rgba(200,232,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-wdt, L * 0.6, 0, L); g.quadraticCurveTo(wdt, L * 0.6, 6, 0); g.closePath(); g.fill();
    g.restore();
    // white water on the surface around the plunge (more on the downstream side)
    const wg = g.createRadialGradient(this.xi - 18, s, 0, this.xi - 18, s, 70);
    wg.addColorStop(0, `rgba(255,255,255,${0.55 * this.flow})`); wg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wg; g.beginPath(); g.ellipse(this.xi - 18, s + 2, 80, 12, 0, 0, 7); g.fill();
  }

  private drawBubbles(g: CanvasRenderingContext2D) {
    for (const b of this.bubs) {
      const a = Math.min(1, b.age * 4) * 0.8;
      g.strokeStyle = `rgba(235,248,255,${a})`; g.lineWidth = b.r > 3 ? 1.2 : 0.9;
      g.beginPath(); g.ellipse(b.x, b.y, b.r * (1 + Math.sin(b.ph) * 0.08 * (b.r > 3 ? 2 : 0)), b.r, 0, 0, 7); g.stroke();
      if (b.r > 1.6) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, 7); g.fill(); }
    }
  }

  private drawFoam(g: CanvasRenderingContext2D) {
    for (const f of this.foam) {
      const a = Math.min(1, f.life * 3) * (1 - f.life / f.max);
      const y = this.surfaceY(f.x);
      g.fillStyle = `rgba(255,255,255,${0.8 * a})`;
      g.beginPath(); g.ellipse(f.x, y - 0.5, f.r * 1.6, f.r * 0.55, 0, 0, 7); g.fill();
    }
  }

  private drawMist(g: CanvasRenderingContext2D) {
    if (this.flow < 0.03) return;
    const s = this.surfaceY(this.xi), m = g.createRadialGradient(this.xi - 10, s - 18, 0, this.xi - 10, s - 18, 90);
    m.addColorStop(0, `rgba(255,255,255,${0.22 * this.flow})`); m.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = m; g.fillRect(this.xi - 110, s - 110, 220, 120);
  }

  /** a tap on the pool */
  poke(x: number, y: number) { if (Math.abs(y - this.yP) < 70) this.wave.splash(x, 420, 30); }
}
