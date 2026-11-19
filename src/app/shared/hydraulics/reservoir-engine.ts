/**
 * SIGAT — Hydraulic reservoir animation engine (framework-free, Canvas 2D).
 *
 * Scene built on the SIGAT logo: the ring is the reservoir, the long right leg is the
 * borehole rising main (pump -> gooseneck inlet), the two short legs are the
 * distribution main and the drain line (the logo's drop = a leaking drain valve).
 *
 * Physics actually computed every frame:
 *  - Pump / system curve intersection  H_p = s²·H0 − k·Q²  ,  H_s = Δz + K·Q²  (affinity laws for speed s)
 *  - Borehole drawdown (Thiem / Dupuit):  s_w = Q/(2πT)·ln(R/r_w), cone of depression drawn with ln(R/r)
 *  - Darcy radial flow in the aquifer (tracer speed ∝ Q / r)
 *  - Tank mass balance  A(h)·dh/dt = Q_in − Q_out  with the real elliptical cross-section
 *  - Outflows by Torricelli / orifice law  Q = Cd·A·√(2g·Δh), gate-valve circular-segment opening,
 *    butterfly valve quasi equal-percentage characteristic
 *  - Free-surface waves: linear potential-flow theory solved in cosine (Neumann) modes with the exact
 *    gravity–capillary dispersion  ω² = (gk + σk³/ρ)·tanh(kh), viscous damping 2νk²
 *  - Free jets: ballistic slices, continuity necking  w = w0·√(v0/v), Plateau–Rayleigh break-up into drops
 *  - Plunging-jet air entrainment, bubbles rising at size-dependent terminal velocity with zig-zag
 *  - Turbulent 1/7-power velocity profile in pipes (Reynolds number reported)
 *  - Siphon drain-back of the gooseneck after pump stop, check-valve closure surge (Joukowsky with rundown)
 *  - Pressure gauge needle as a damped 2nd-order instrument
 */

import { Path, buildPath, clamp, rand, drawDrop, Jet, drawGlassPipe } from './hydraulics-core';

export type PumpMode = 'auto' | 'on' | 'off';

export type ReservoirLabelKey =
  | 'reservoir' | 'riser' | 'pump' | 'borehole' | 'aquifer' | 'waterTable' | 'checkValve'
  | 'coupling' | 'gauge' | 'wallSleeve' | 'drainValve' | 'flowMeter' | 'butterfly'
  | 'distribution' | 'flange' | 'manhole' | 'staffGauge' | 'inlet';

export type ReservoirLabels = Partial<Record<ReservoirLabelKey, string>>;

export interface ReservoirStats {
  level: number;          // m
  levelPct: number;       // % of operating range (0 → high set-point)
  volume: number;         // m³
  qIn: number;            // L/s into tank
  qOut: number;           // L/s distribution
  qDrain: number;         // L/s drain
  pressure: number;       // bar (gauge on rising main)
  velocity: number;       // m/s in distribution main
  reynolds: number;       // distribution main
  drawdown: number;       // m
  pumpOn: boolean;
  pumpSpeed: number;      // 0..1
  mode: PumpMode;
  timeScale: number;
}

export interface ReservoirEngineOptions {
  labels?: ReservoirLabels;
  showLabels?: boolean;
  onStats?: (s: ReservoirStats) => void;
}

const DEFAULT_LABELS: Required<ReservoirLabels> = {
  reservoir: 'Réservoir',
  riser: 'Conduite de refoulement',
  pump: 'Pompe immergée',
  borehole: 'Forage (tubage + crépine)',
  aquifer: 'Nappe aquifère',
  waterTable: 'Niveau piézométrique',
  checkValve: 'Clapet anti-retour',
  coupling: 'Manchette de raccordement',
  gauge: 'Manomètre',
  wallSleeve: 'Traversée de paroi',
  drainValve: 'Vanne de vidange',
  flowMeter: 'Débitmètre électromagnétique',
  butterfly: 'Vanne papillon',
  distribution: 'Conduite de distribution',
  flange: 'Bride',
  manhole: 'Regard',
  staffGauge: 'Règle limnimétrique',
  inlet: 'Arrivée en col de cygne',
};

/* ------------------------------------------------------------------ constants */
const W = 800;
const H = 1100;
const PX = 50;               // pixels per metre
const G = 9.81;
const GPX = G * PX;          // gravity in px/s²
const RHO = 1000;
const NU = 1.0e-6;           // kinematic viscosity of water, m²/s
const SIGMA_RHO = 7.28e-5;   // surface tension / density, m³/s²

// Reservoir (logo ring)
const CX = 400, CY = 270, RX = 322, RY = 196, TW = 34;
const RXI = RX - TW / 2, RYI = RY - TW / 2;
const Y_BOTTOM = CY + RYI;   // 449
const DEPTH_M = 12;          // tank length perpendicular to the screen
const TIME_SCALE = 100;      // level dynamics accelerated so a fill/draw cycle is watchable
const H_LOW = 1.2, H_HIGH = 3.1;

// Pipes
const PIPE_R = 15;                       // DN600
const PIPE_D = (2 * PIPE_R) / PX;        // m
const PIPE_A = Math.PI * (PIPE_D / 2) ** 2;
const GROUND = 830;
const WT_Y = 925;                        // static water table
const GAUGE_Y = 520;

// Pump & system
const H0 = 22, K_PUMP = 68, K_SYS = 20;
const TRANSMISSIVITY = 0.35, R_INFL = 200, R_WELL = 0.15;

// Distribution and drain
const C_DIST = 0.045;
const CD_DRAIN = 0.62;
const DRAIN_ORIFICE = 0.12;   // restriction orifice plate on the drain line (area ratio)

/* ------------------------------------------------------------------ helpers */
function halfWidthAtY(y: number, rx = RXI, ry = RYI): number {
  const d = (y - CY) / ry;
  return d >= 1 || d <= -1 ? 0 : rx * Math.sqrt(1 - d * d);
}

/* ------------------------------------------------------------------ particles */
interface Tracer { s: number; rf: number; }
interface Drop { x: number; y: number; vx: number; vy: number; r: number; life: number; floor: number; }
interface Bubble { x: number; y: number; r: number; ph: number; }
interface AqParticle { x: number; y: number; }

class Pipe {
  tracers: Tracer[] = [];
  fill0 = 0; fill1 = 0; vel = 0; // vel in px/s (mean velocity)
  rings: number[] = [];
  constructor(readonly path: Path, readonly r: number, readonly hl: 1 | -1, density = 7) {
    const n = Math.floor(path.length / density);
    for (let i = 0; i < n; i++) this.tracers.push({ s: Math.random() * path.length, rf: rand(-0.9, 0.9) });
  }
  update(dt: number) {
    const L = this.path.length;
    for (const t of this.tracers) {
      // turbulent 1/7 power-law profile: u(r) = umax (1-r/R)^(1/7),  umean ≈ 0.817 umax
      const u = (this.vel / 0.817) * Math.pow(1 - Math.abs(t.rf), 1 / 7);
      t.s += u * dt;
      t.rf = clamp(t.rf + rand(-1, 1) * dt * (0.4 + Math.abs(this.vel) * 0.01), -0.92, 0.92);
      if (t.s > L) { t.s -= L; t.rf = rand(-0.9, 0.9); }
      if (t.s < 0) t.s += L;
    }
  }
}

function metalGrad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, base = 'blue') {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  if (base === 'blue') { // epoxy-coated ductile iron
    g.addColorStop(0, '#0d3a80'); g.addColorStop(0.3, '#3a7bd5'); g.addColorStop(0.45, '#9cc8ff');
    g.addColorStop(0.6, '#2c66c0'); g.addColorStop(1, '#0a2f6b');
  } else if (base === 'steel') {
    g.addColorStop(0, '#5b6673'); g.addColorStop(0.35, '#c9d2dc'); g.addColorStop(0.5, '#f2f5f8');
    g.addColorStop(0.7, '#8d98a5'); g.addColorStop(1, '#4a5360');
  } else { // dark grey (pump motor)
    g.addColorStop(0, '#2a2f36'); g.addColorStop(0.4, '#7c8794'); g.addColorStop(0.55, '#b9c3cd');
    g.addColorStop(1, '#2a2f36');
  }
  return g;
}

/* ------------------------------------------------------------------ engine */
export class ReservoirEngine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0; private last = 0; private running = false;
  private scale = 1; private ox = 0; private oy = 0; private dpr = 1;
  private viewX0 = 0; private viewX1 = W;
  private labels: Required<ReservoirLabels>;
  private showLabels: boolean;
  private onStats?: (s: ReservoirStats) => void;
  private statT = 0; private t = 0;

  // controls
  private mode: PumpMode = 'auto';
  private distOpen = 0.6;
  private drainCmd = false;

  // state
  private h = 2.2;              // water level (m)
  private pumpCmd = true;
  private pumpSpeed = 0;
  private qPump = 0;            // m³/s
  private fillS = 0;            // rising main water front (px along path)
  private sStatic = 0;          // equilibrium front after siphon drain-back
  private qSpout = 0;
  private drawdown = 0;
  private qDist = 0; private qDrain = 0;
  private drainOpen = 0;        // 0..1 gate travel
  private wheelAngle = 0; private impeller = 0;
  private surgeT = 99; private surgeAmp = 0; private lastQ = 0;
  private pressure = 0; private needle = 0; private needleV = 0;
  private dripR = 0; private leak = 0.9; // px/s radius growth

  // waves (cosine modes, metres)
  private readonly M = 110;
  private a = new Float64Array(111); private b = new Float64Array(111);
  private surfX = new Float32Array(181); private surfY = new Float32Array(181);
  private foam = 0; private impactX = 0;

  // geometry
  private riser!: Pipe; private dist!: Pipe; private drain!: Pipe;
  private sGauge = 0; private sCheck = 0; private sCoupling = 0; private sWall = 0; private sWellFl = 0;
  private sMeter = 0; private sButterfly = 0; private sDistFl = 0; private sDrainValve = 0;
  private spoutJet = new Jet(0.75, GPX); private drainJet = new Jet(0.3, GPX);
  private drops: Drop[] = []; private bubbles: Bubble[] = []; private falling: Drop[] = [];
  private aq: AqParticle[] = [];
  private volTable = new Float64Array(401);
  private soil?: HTMLCanvasElement;
  private pointer: { x: number; y: number; t: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, opts: ReservoirEngineOptions = {}) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D not supported');
    this.ctx = c;
    this.labels = { ...DEFAULT_LABELS, ...(opts.labels ?? {}) };
    this.showLabels = opts.showLabels ?? true;
    this.onStats = opts.onStats;
    this.buildGeometry();
    this.buildVolumeTable();
    for (let i = 0; i < 140; i++) this.aq.push({ x: rand(-400, 1200), y: rand(WT_Y + 10, H) });
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerdown', this.onPointer);
    this.resize();
    // settle: pre-run a few seconds so first frame already flows
    this.pumpSpeed = 1; this.fillS = this.riser.path.length;
    for (let i = 0; i < 180; i++) this.step(1 / 60);
  }

  /* ---------- public API */
  start() { if (this.running) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    this.stop();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }
  renderOnce() { this.draw(); }
  setPumpMode(m: PumpMode) { this.mode = m; }
  setDistributionOpening(v: number) { this.distOpen = clamp(v, 0, 1); }
  setDrainOpen(open: boolean) { this.drainCmd = open; }
  setShowLabels(v: boolean) { this.showLabels = v; if (!this.running) this.draw(); }
  setLabels(l: ReservoirLabels) { this.labels = { ...DEFAULT_LABELS, ...l }; if (!this.running) this.draw(); }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(r.width * this.dpr)), ch = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.scale = Math.min(cw / W, ch / H);
    this.ox = (cw - W * this.scale) / 2; this.oy = (ch - H * this.scale) / 2;
    this.viewX0 = -this.ox / this.scale; this.viewX1 = (cw - this.ox) / this.scale;
    if (!this.running) this.draw();
  }

  /* ---------- setup */
  private buildGeometry() {
    const riserPath = buildPath(500, 1000, [
      ['L', 500, 790],
      ['C', 500, 700, 530, 680, 530, 610],
      ['L', 530, 420],
      ['C', 530, 262, 505, 190, 440, 188],
      ['C', 380, 186, 344, 206, 334, 256],
    ]);
    this.riser = new Pipe(riserPath, PIPE_R, -1, 6);
    // left leg = distribution main (goes underground), middle leg = drain (vidange) with the logo drop
    this.dist = new Pipe(buildPath(282, 440, [['C', 283, 600, 290, 700, 290, 800], ['L', 290, 905], ['Q', 290, 940, 255, 940], ['L', -1400, 940]]), PIPE_R, 1, 7);
    this.drain = new Pipe(buildPath(400, 440, [['L', 400, 745]]), PIPE_R, -1, 6);
    const sH = this.dist.path.sAtY(939.5);
    for (let s = sH + 70; s < this.dist.path.length; s += 150) this.dist.rings.push(s);

    const rp = riserPath;
    this.sWellFl = rp.sAtY(812);
    this.sCheck = rp.sAtY(770);
    this.sCoupling = rp.sAtY(565);
    this.sGauge = rp.sAtY(GAUGE_Y);
    this.sWall = rp.sAtY(CY + RY * Math.sqrt(1 - ((530 - CX) / RX) ** 2));
    const apexS = this.findApex(rp);
    this.sStatic = rp.sAtY(rp.y[rp.n - 1]); // siphon drains back to spout elevation
    if (this.sStatic > apexS) this.sStatic = apexS;
    this.sDistFl = this.dist.path.sAtY(500);
    this.sMeter = this.dist.path.sAtY(565);
    this.sButterfly = this.dist.path.sAtY(645);
    this.sDrainValve = this.drain.path.sAtY(690);
  }
  private findApex(p: Path) { let m = 0; for (let i = 0; i < p.n; i++) if (p.y[i] < p.y[m]) m = i; return m * p.step; }

  private buildVolumeTable() {
    // V(h) = D·∫ width(z) dz  over the elliptical tank section
    let v = 0;
    for (let i = 1; i <= 400; i++) {
      const z = (i / 400) * (2 * RYI / PX);
      const wM = (2 * halfWidthAtY(Y_BOTTOM - z * PX)) / PX;
      v += DEPTH_M * wM * ((2 * RYI / PX) / 400);
      this.volTable[i] = v;
    }
  }
  private volume(h: number) { const f = clamp(h / (2 * RYI / PX), 0, 1) * 400; const i = Math.floor(f); return this.volTable[i] + (this.volTable[Math.min(400, i + 1)] - this.volTable[i]) * (f - i); }

  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * this.dpr - this.ox) / this.scale;
    const y = ((e.clientY - r.top) * this.dpr - this.oy) / this.scale;
    const ys = this.surfaceY();
    const hw = halfWidthAtY(ys);
    if (Math.abs(x - CX) < hw && Math.abs(y - ys) < 40) {
      const now = performance.now();
      const p = this.pointer;
      const speed = p ? Math.hypot(x - p.x, y - p.y) / Math.max(8, now - p.t) : 0.3;
      this.kick((x - (CX - hw)) / PX, -clamp(speed, 0.1, 2) * (e.type === 'pointerdown' ? 0.5 : 0.12), 0.35);
      this.pointer = { x, y, t: now };
    } else this.pointer = null;
  };

  /* ---------- physics */
  private surfaceY() { return Y_BOTTOM - this.h * PX; }
  private widthM() { return Math.max(0.5, (2 * halfWidthAtY(this.surfaceY())) / PX); }

  /** impulsive surface forcing at position x0 (m from left wall); J in m/s of surface velocity, w = footprint (m) */
  private kick(x0: number, J: number, w: number) {
    const L = this.widthM();
    for (let n = 1; n <= this.M; n++) {
      const k = (n * Math.PI) / L;
      this.b[n] += J * Math.cos(k * x0) * Math.exp(-(((k * w) / 2) ** 2)) * (2 * w / L);
    }
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number) {
    this.t += dt;
    const h = this.h;

    // --- pump control (float switches with hysteresis)
    if (this.mode === 'auto') { if (h <= H_LOW) this.pumpCmd = true; else if (h >= H_HIGH) this.pumpCmd = false; }
    else this.pumpCmd = this.mode === 'on' && h < 2 * RYI / PX - 0.6;
    const target = this.pumpCmd ? 1 : 0;
    this.pumpSpeed += (target - this.pumpSpeed) * dt / (target > this.pumpSpeed ? 0.7 : 1.1);
    if (this.pumpSpeed < 0.002) this.pumpSpeed = 0;
    this.impeller += this.pumpSpeed * dt * 40;

    // --- pump curve ∩ system curve (affinity: H ∝ n²) with live drawdown
    const zWl = (WT_Y + this.drawdown * PX);
    const staticLift = (zWl - this.riser.path.y[this.riser.path.n - 1]) / PX;
    const s2 = this.pumpSpeed * this.pumpSpeed;
    const q = Math.sqrt(Math.max(0, s2 * H0 - staticLift) / (K_PUMP + K_SYS));
    // check-valve closure surge on rundown: Δp ≈ ρ·2L·Δv / t_c (slow closure Joukowsky)
    if (this.lastQ > 0.05 && q < 0.005 && this.surgeT > 1) {
      const Lm = this.riser.path.length / PX, dv = this.lastQ / PIPE_A;
      this.surgeAmp = (RHO * 2 * Lm * dv / 1.2) / 1e5; this.surgeT = 0;
    }
    this.lastQ = q; this.qPump = q; this.surgeT += dt;

    // drawdown (Thiem) with first-order transient
    const sTarget = (q / (2 * Math.PI * TRANSMISSIVITY)) * Math.log(R_INFL / R_WELL);
    this.drawdown += (sTarget - this.drawdown) * dt / 4;

    // --- rising-main water front & gooseneck siphon drain-back
    const L = this.riser.path.length;
    const vPx = (q / PIPE_A) * PX;
    if (q > 0.002) {
      this.fillS = Math.min(L, this.fillS + Math.max(vPx, 25) * dt);
      this.qSpout = this.fillS >= L - 0.5 ? q : 0;
    } else if (this.fillS > this.sStatic) {
      const frac = (this.fillS - this.sStatic) / (L - this.sStatic);
      this.fillS = Math.max(this.sStatic, this.fillS - (8 + 70 * frac) * dt);
      this.qSpout = 0.22 * frac * frac;
    } else this.qSpout = 0;
    this.riser.fill0 = 0; this.riser.fill1 = this.fillS; this.riser.vel = q > 0.002 ? vPx : (this.qSpout / PIPE_A) * PX;

    // --- outflows
    const fOpen = Math.pow(this.distOpen, 1.8); // butterfly inherent characteristic
    this.qDist = h > 0.01 ? C_DIST * fOpen * Math.sqrt(2 * G * (h + 2)) : 0;
    this.drainOpen = clamp(this.drainOpen + (this.drainCmd ? 1 : -1) * dt / 2.5, 0, 1);
    this.wheelAngle += (this.drainCmd ? 1 : -1) * (this.drainOpen > 0 && this.drainOpen < 1 ? dt * 6 : 0);
    // gate valve: open area = circular segment uncovered by the rising gate
    const th = 2 * Math.acos(clamp(1 - 2 * this.drainOpen, -1, 1));
    const segA = (PIPE_D / 2) ** 2 / 2 * (th - Math.sin(th));
    const headDrain = h + (745 - Y_BOTTOM) / PX;
    this.qDrain = h > 0.01 ? CD_DRAIN * DRAIN_ORIFICE * segA * Math.sqrt(2 * G * headDrain) : 0;
    this.dist.fill0 = 0; this.dist.fill1 = this.dist.path.length; this.dist.vel = (this.qDist / PIPE_A) * PX;
    this.drain.fill0 = 0;
    this.drain.fill1 = this.qDrain > 0.001 ? this.drain.path.length : this.sDrainValve;
    this.drain.vel = (this.qDrain / PIPE_A) * PX;

    // --- tank mass balance (accelerated)
    const area = DEPTH_M * this.widthM();
    this.h = clamp(h + ((this.qSpout - this.qDist - this.qDrain) * dt * TIME_SCALE) / area, 0, 2 * RYI / PX - 0.2);

    // --- free-surface modes
    const Lw = this.widthM(), depth = Math.max(0.05, this.h);
    for (let n = 1; n <= this.M; n++) {
      const k = (n * Math.PI) / Lw;
      const w2 = (G * k + SIGMA_RHO * k * k * k) * Math.tanh(k * depth);
      const gam = 0.18 + 2 * 1.5e-3 * k * k; // effective viscous + wall boundary-layer damping
      for (let sub = 0; sub < 2; sub++) {
        const d = dt / 2;
        this.b[n] += (-w2 * this.a[n] - gam * this.b[n]) * d;
        this.a[n] += this.b[n] * d;
      }
    }
    // micro ambient agitation (wind / inflow turbulence)
    if (Math.random() < dt * 8) this.kick(Math.random() * Lw, rand(-0.02, 0.02), 0.5);
    this.computeSurface();

    // --- jets
    const ys = this.surfaceY();
    const end = this.riser.path.at(L);
    const qs = this.qSpout;
    const vExit = Math.max(0.35, qs / PIPE_A);
    const wExit = Math.min(2 * PIPE_R, 2 * Math.sqrt(qs / vExit / Math.PI) * PX);
    this.spoutJet.emit(qs > 0.003, end.x, end.y, end.tx * vExit * PX, end.ty * vExit * PX, wExit);
    this.spoutJet.update(dt, s => {
      const yS = this.surfaceAt(s.x);
      if (s.y < yS) return false;
      const v = Math.hypot(s.vx, s.vy) / PX;
      const hw = halfWidthAtY(ys);
      const w = this.spoutJet.width(s) / PX;
      this.kick((s.x - (CX - hw)) / PX, -0.03 * v * w * 6, Math.max(0.25, w));
      this.impactX = s.x; this.foam = Math.min(1, this.foam + 0.05 * w * 3);
      // plunging-jet air entrainment
      const nb = Math.random() < v * w * 1.8 ? 1 + (Math.random() * 3 | 0) : 0;
      for (let i = 0; i < nb; i++) {
        const r = rand(0.8, 3.2);
        this.bubbles.push({ x: s.x + rand(-1, 1) * w * PX, y: yS + rand(4, 14 + v * v * 14), r, ph: Math.random() * 6 });
      }
      if (Math.random() < 0.35 * w * 3) {
        this.drops.push({ x: s.x + rand(-6, 6), y: yS - 1, vx: rand(-60, 60), vy: -rand(40, 40 + v * 70), r: rand(1, 2.4), life: 2, floor: 0 });
      }
      return true;
    }, H + 50);
    this.foam *= Math.exp(-dt * 1.4);

    const dEnd = this.drain.path.at(this.drain.path.length);
    const vd = (this.qDrain / PIPE_A);
    const vdx = Math.max(0.35, vd);
    this.drainJet.emit(this.qDrain > 0.004, dEnd.x, dEnd.y, dEnd.tx * vdx * PX, dEnd.ty * vdx * PX, Math.min(2 * PIPE_R - 4, 2 * Math.sqrt(this.qDrain / vdx / Math.PI) * PX));
    this.drainJet.update(dt, s => {
      if (s.y < GROUND + 4) return false;
      if (Math.random() < 0.5) this.drops.push({ x: s.x + rand(-8, 8), y: GROUND + 2, vx: rand(-90, 90), vy: -rand(40, 160), r: rand(1, 2.2), life: 1.5, floor: GROUND + 4 });
      return true;
    }, H + 50);

    // --- leaking drain valve drip (the logo drop): grows, necks, detaches (scaled ×20 for visibility)
    if (this.qDrain < 0.004) {
      this.dripR += this.leak * dt;
      if (this.dripR > 7.5) {
        this.falling.push({ x: dEnd.x, y: dEnd.y + 7.5 * 1.6, vx: 0, vy: 40, r: 7.5, life: 5, floor: GROUND + 4 });
        this.dripR = 0.5;
      }
    } else this.dripR = 0;
    for (const d of this.falling) { d.vy += GPX * dt; d.y += d.vy * dt; }
    this.falling = this.falling.filter(d => {
      if (d.y + d.r < GROUND + 4) return true;
      for (let i = 0; i < 6; i++) this.drops.push({ x: d.x, y: GROUND + 2, vx: rand(-70, 70), vy: -rand(50, 140), r: rand(0.8, 2), life: 1.2, floor: GROUND + 4 });
      return false;
    });

    // --- splash drops
    for (const d of this.drops) { d.vy += GPX * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    this.drops = this.drops.filter(d => {
      if (d.life <= 0) return false;
      if (d.floor) return d.y < d.floor;
      if (d.vy > 0 && d.y > this.surfaceAt(d.x)) { this.kick((d.x - (CX - halfWidthAtY(ys))) / PX, -0.004, 0.08); return false; }
      return true;
    });

    // --- bubbles: terminal rise velocity grows with radius, helical/zig-zag path
    for (const bb of this.bubbles) {
      const vt = 22 + bb.r * 9;
      bb.y -= vt * dt; bb.ph += dt * (5 + bb.r);
      bb.x += Math.sin(bb.ph) * bb.r * 6 * dt;
    }
    this.bubbles = this.bubbles.filter(bb => {
      if (bb.y - bb.r > this.surfaceAt(bb.x) + 1) return true;
      this.kick((bb.x - (CX - halfWidthAtY(ys))) / PX, 0.0025 * bb.r, 0.05);
      return false;
    });
    if (this.bubbles.length > 400) this.bubbles.splice(0, this.bubbles.length - 400);

    // --- pipe tracers
    this.riser.update(dt); this.dist.update(dt); this.drain.update(dt);

    // --- aquifer: Darcy radial flow toward the screen, v ∝ Q/(2π r b)
    for (const p of this.aq) {
      const dx = 500 - p.x, dy = 1030 - p.y;
      const r = Math.max(30, Math.hypot(dx, dy));
      const v = 5 + q * 26000 / r;
      p.x += (dx / r) * v * dt * (q > 0.01 ? 1 : 0.15) + (q > 0.01 ? 0 : 6 * dt);
      p.y += (dy / r) * v * dt * (q > 0.01 ? 1 : 0.15);
      const wt = this.waterTableAt(p.x);
      if (r < 34 || p.y < wt + 3 || p.x > this.viewX1 + 20) {
        const side = Math.random() < 0.5 ? -1 : 1;
        p.x = side < 0 ? this.viewX0 - rand(0, 30) : this.viewX1 + rand(0, 30);
        p.y = rand(WT_Y + 20, H);
        if (q < 0.01) p.x = this.viewX0 - rand(0, 30);
      }
    }

    // --- rising-main pressure at the gauge + instrument dynamics
    let pBar: number;
    const end2 = this.riser.path.y[this.riser.path.n - 1];
    if (this.fillS >= L - 1) pBar = ((GAUGE_Y - end2) / PX + 0.3 * K_SYS * q * q) * RHO * G / 1e5;
    else {
      const p2 = this.riser.path.at(this.fillS);
      pBar = Math.max(0, (GAUGE_Y - p2.y) / PX) * RHO * G / 1e5;
      if (this.fillS < this.sGauge) pBar = 0;
    }
    const Tw = 4 * (L / PX) / 1000;
    pBar += this.surgeAmp * Math.exp(-this.surgeT / 0.5) * Math.cos(2 * Math.PI * this.surgeT / Math.max(Tw, 0.06));
    this.pressure = Math.max(0, pBar);
    const wn = 11, z = 0.38;
    this.needleV += (wn * wn * (this.pressure - this.needle) - 2 * z * wn * this.needleV) * dt;
    this.needle += this.needleV * dt;

    // --- stats
    this.statT += dt;
    if (this.onStats && this.statT > 0.2) {
      this.statT = 0;
      const v = this.qDist / PIPE_A;
      this.onStats({
        level: this.h, levelPct: clamp((this.h / H_HIGH) * 100, 0, 100), volume: this.volume(this.h),
        qIn: this.qSpout * 1000, qOut: this.qDist * 1000, qDrain: this.qDrain * 1000,
        pressure: Math.max(0, this.needle), velocity: v, reynolds: (v * PIPE_D) / NU,
        drawdown: this.drawdown, pumpOn: this.pumpCmd, pumpSpeed: this.pumpSpeed, mode: this.mode, timeScale: TIME_SCALE,
      });
    }
  }

  private computeSurface() {
    const ys = this.surfaceY();
    const hw = halfWidthAtY(ys);
    const Lw = this.widthM();
    const N = this.surfX.length - 1;
    for (let i = 0; i <= N; i++) {
      const xm = (i / N) * Lw;
      const th = (Math.PI * xm) / Lw;
      const c1 = Math.cos(th);
      let cPrev = 1, c = c1, eta = 0;
      for (let n = 1; n <= this.M; n++) { eta += this.a[n] * c; const nx = 2 * c1 * c - cPrev; cPrev = c; c = nx; }
      this.surfX[i] = CX - hw + (i / N) * 2 * hw;
      this.surfY[i] = ys + clamp(eta, -0.35, 0.35) * PX;
    }
  }
  private surfaceAt(x: number) {
    const N = this.surfX.length - 1;
    const x0 = this.surfX[0], x1 = this.surfX[N];
    if (x1 - x0 < 1) return this.surfaceY();
    const f = clamp((x - x0) / (x1 - x0), 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return this.surfY[i] + (this.surfY[i + 1] - this.surfY[i]) * (f - i);
  }
  private waterTableAt(x: number) {
    const rpx = Math.max(Math.abs(x - 500), 30);
    const Rpx = 420, rw = 30;
    const s = rpx >= Rpx ? 0 : this.drawdown * Math.log(Rpx / rpx) / Math.log(Rpx / rw);
    return WT_Y + s * PX;
  }

  /* ---------- rendering */
  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    this.drawBackground(ctx);
    this.drawUnderground(ctx);
    this.drawStaffGauge(ctx);
    this.drawWater(ctx);
    this.drawRing(ctx);
    this.drawPipeBody(ctx, this.dist);
    this.drawPipeBody(ctx, this.drain);
    this.drawFittingsDist(ctx);
    this.drawFittingsDrain(ctx);
    this.drawPipeBody(ctx, this.riser);
    this.drawFittingsRiser(ctx);
    this.spoutJet.draw(ctx, this.qSpout > 0.003 ? this.riser.path.at(this.riser.path.length) : null);
    this.drainJet.draw(ctx, this.qDrain > 0.004 ? this.drain.path.at(this.drain.path.length) : null);
    this.drawDrip(ctx);
    for (const d of this.drops) drawDrop(ctx, d.x, d.y, d.r, 0);
    if (this.showLabels) this.drawLabels(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const x0 = this.viewX0 - 2, x1 = this.viewX1 + 2;
    const y0 = -this.oy / this.scale - 2;
    const g = ctx.createLinearGradient(0, y0, 0, GROUND);
    g.addColorStop(0, '#9fd6f7'); g.addColorStop(0.55, '#cdeeff'); g.addColorStop(1, '#e9f8ff');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, GROUND - y0);
    // soft caustic shimmer (as in the brand visuals)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 12) {
        const y = 80 + k * 140 + Math.sin(x * 0.012 + this.t * 0.6 + k) * 18 + Math.sin(x * 0.031 - this.t * 0.9 + k * 2) * 8;
        x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.restore();
  }

  private buildSoil(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = H - GROUND;
    const g = c.getContext('2d')!;
    const lay = (y0: number, y1: number, a: string, b: string) => {
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.fillRect(0, y0, c.width, y1 - y0);
    };
    lay(0, 26, '#7a5a3c', '#8d6a47');      // topsoil
    lay(26, 90, '#b78f62', '#a8825a');      // clay / silt
    lay(90, H - GROUND, '#d7c29a', '#c8b083'); // sand & gravel aquifer
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * c.height, x = Math.random() * c.width;
      const inAq = y > 90;
      g.fillStyle = inAq ? `rgba(${110 + Math.random() * 60 | 0},${90 + Math.random() * 50 | 0},${60 + Math.random() * 40 | 0},0.45)` : 'rgba(60,40,20,0.25)';
      g.beginPath(); g.arc(x, y, inAq ? rand(0.6, 2.4) : rand(0.4, 1.2), 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(70,45,25,0.35)'; g.lineWidth = 1;
    for (const yy of [26, 90]) { g.beginPath(); for (let x = 0; x <= c.width; x += 8) g.lineTo(x, yy + Math.sin(x * 0.05) * 2); g.stroke(); }
    return c;
  }

  private drawUnderground(ctx: CanvasRenderingContext2D) {
    if (!this.soil) this.soil = this.buildSoil();
    const x0 = this.viewX0 - 2, x1 = this.viewX1 + 2;
    for (let x = Math.floor(x0 / 1200) * 1200; x < x1; x += 1200) ctx.drawImage(this.soil, x, GROUND);
    // grass/ground line
    ctx.fillStyle = '#5c8f3d'; ctx.fillRect(x0, GROUND - 3, x1 - x0, 5);

    // saturated zone with Thiem cone of depression
    ctx.beginPath();
    ctx.moveTo(x0, H);
    for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, this.waterTableAt(x));
    ctx.lineTo(x1, H); ctx.closePath();
    ctx.fillStyle = 'rgba(70,160,240,0.22)'; ctx.fill();
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, this.waterTableAt(x));
    ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(20,90,200,0.9)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
    // water-table symbol ▽
    ctx.fillStyle = 'rgba(20,90,200,0.95)';
    ctx.beginPath(); ctx.moveTo(700, WT_Y - 14); ctx.lineTo(712, WT_Y - 14); ctx.lineTo(706, WT_Y - 4); ctx.closePath(); ctx.fill();

    // aquifer tracers (Darcy flow)
    ctx.fillStyle = 'rgba(30,110,230,0.75)';
    for (const p of this.aq) { if (p.y > this.waterTableAt(p.x) + 2) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, 7); ctx.fill(); } }

    // borehole: gravel pack, casing, screen
    ctx.fillStyle = '#cfc2a6'; ctx.fillRect(452, GROUND, 96, H - GROUND);
    ctx.fillStyle = 'rgba(120,100,70,0.6)';
    for (let i = 0; i < 260; i++) { const yy = GROUND + ((i * 37) % (H - GROUND)); const xx = 454 + ((i * 53) % 92); if (xx > 466 && xx < 534) continue; ctx.beginPath(); ctx.arc(xx, yy, 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(230,240,250,0.55)'; ctx.fillRect(470, GROUND, 60, H - GROUND);
    const wl = WT_Y + this.drawdown * PX * 1.08; // well loss
    const wg = ctx.createLinearGradient(0, wl, 0, H); wg.addColorStop(0, 'rgba(90,170,245,0.75)'); wg.addColorStop(1, 'rgba(20,80,180,0.85)');
    ctx.fillStyle = wg; ctx.fillRect(470, wl, 60, H - wl);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(470, wl); ctx.lineTo(530, wl); ctx.stroke();
    // casing walls (steel) and slotted screen
    for (const x of [466, 530]) { ctx.fillStyle = metalGrad(ctx, x, 0, x + 4, 0, 'steel'); ctx.fillRect(x, GROUND - 6, 4, H - GROUND + 6); }
    ctx.fillStyle = '#2b3440';
    for (let y = 960; y < H; y += 7) { ctx.fillRect(466, y, 4, 2); ctx.fillRect(530, y, 4, 2); }
    // wellhead plate
    ctx.fillStyle = metalGrad(ctx, 0, GROUND - 10, 0, GROUND, 'steel');
    ctx.fillRect(448, GROUND - 10, 104, 9);

    // submersible pump (pump end + intake + motor) and power cable
    const px = 484, pw = 32;
    ctx.fillStyle = metalGrad(ctx, px, 0, px + pw, 0, 'steel');
    ctx.fillRect(px, 995, pw, 48);
    for (let y = 1000; y < 1040; y += 9) { ctx.fillStyle = 'rgba(60,70,80,0.5)'; ctx.fillRect(px, y, pw, 1.5); }
    // intake screen with rotating shaft stripes
    ctx.fillStyle = '#1e2731'; ctx.fillRect(px, 1043, pw, 14);
    ctx.save(); ctx.beginPath(); ctx.rect(px + 2, 1045, pw - 4, 10); ctx.clip();
    ctx.strokeStyle = '#9aa7b5'; ctx.lineWidth = 2;
    const off = (this.impeller * 6) % 8;
    for (let x = px - 10 + off; x < px + pw + 10; x += 8) { ctx.beginPath(); ctx.moveTo(x, 1045); ctx.lineTo(x + 6, 1055); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = metalGrad(ctx, px - 2, 0, px + pw + 2, 0, 'dark'); ctx.fillRect(px - 2, 1057, pw + 4, H - 1057);
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + pw + 1, 1060); ctx.lineTo(519, 995); ctx.lineTo(519, GROUND - 10); ctx.stroke();
    // inflow arrows into intake when pumping
    if (this.pumpSpeed > 0.2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4;
      const o = (this.t * 30) % 10;
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
        const x = 500 + sx * (30 - o - k * 10);
        ctx.beginPath(); ctx.moveTo(x, 1050); ctx.lineTo(x + sx * 5, 1046); ctx.moveTo(x, 1050); ctx.lineTo(x + sx * 5, 1054); ctx.stroke();
      }
    }

    // manhole (regard) under drain outlet
    ctx.fillStyle = '#a7a9ab'; ctx.fillRect(355, GROUND - 4, 90, 74);
    ctx.fillStyle = '#5b6168'; ctx.fillRect(365, GROUND, 70, 62);
    const pud = clamp(GROUND + 56 - this.qDrain * 40, GROUND + 20, GROUND + 56);
    ctx.fillStyle = 'rgba(40,120,210,0.7)'; ctx.fillRect(365, pud, 70, GROUND + 62 - pud);
    ctx.fillStyle = '#2f343a';
    for (let x = 357; x < 443; x += 7) ctx.fillRect(x, GROUND - 6, 3, 5);
    ctx.fillRect(355, GROUND - 7, 90, 2);

    // trench bedding around buried distribution main
    ctx.fillStyle = 'rgba(236,222,180,0.85)';
    ctx.fillRect(264, GROUND, 52, 128);
    ctx.fillRect(this.viewX0 - 10, 912, 316 - this.viewX0, 56);
  }

  private drawStaffGauge(ctx: CanvasRenderingContext2D) {
    const x = 458;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(CX, CY, RXI, RYI, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#f7f9fb'; ctx.fillRect(x, 190, 14, Y_BOTTOM - 190);
    ctx.fillStyle = '#d0302f';
    for (let m = 0; m * PX < Y_BOTTOM - 190; m += 0.1) {
      const y = Y_BOTTOM - m * PX;
      const major = Math.abs(m - Math.round(m)) < 0.01, half = Math.abs(m * 2 - Math.round(m * 2)) < 0.01;
      ctx.fillRect(x, y - 0.6, major ? 14 : half ? 9 : 5, major ? 1.6 : 1);
      if (major && m > 0.5) { ctx.font = 'bold 9px Inter, system-ui, sans-serif'; ctx.fillText(String(Math.round(m)), x + 16, y + 3); }
    }
    // set-points
    ctx.fillStyle = 'rgba(234,88,12,0.9)';
    for (const hh of [H_LOW, H_HIGH]) { ctx.fillRect(x - 6, Y_BOTTOM - hh * PX - 1, 6, 2); }
    ctx.restore();
  }

  private drawWater(ctx: CanvasRenderingContext2D) {
    const N = this.surfX.length - 1;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(CX, CY, RXI, RYI, 0, 0, Math.PI * 2); ctx.clip();
    // faint back wall
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(CX - RXI, CY - RYI, RXI * 2, RYI * 2);
    if (this.h > 0.02) {
      ctx.beginPath();
      ctx.moveTo(this.surfX[0], this.surfY[0]);
      for (let i = 1; i <= N; i++) ctx.lineTo(this.surfX[i], this.surfY[i]);
      ctx.lineTo(CX + RXI, Y_BOTTOM + 4); ctx.lineTo(CX - RXI, Y_BOTTOM + 4); ctx.closePath();
      const ys = this.surfaceY();
      const g = ctx.createLinearGradient(0, ys - 10, 0, Y_BOTTOM);
      g.addColorStop(0, 'rgba(140,210,255,0.72)'); g.addColorStop(0.4, 'rgba(60,150,240,0.78)'); g.addColorStop(1, 'rgba(15,80,190,0.9)');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // caustics + light shafts refracted through the moving surface
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        for (let x = CX - RXI; x <= CX + RXI; x += 8) {
          const y = ys + 18 + k * 22 + Math.sin(x * 0.045 + this.t * 1.3 + k * 1.7) * 5 + Math.sin(x * 0.11 - this.t * 2.1 + k) * 2.5;
          x === CX - RXI ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(200,240,255,${0.10 - k * 0.011})`; ctx.lineWidth = 2; ctx.stroke();
      }
      for (let k = 0; k < 6; k++) {
        const x = CX - RXI + 60 + k * 95 + Math.sin(this.t * 0.4 + k) * 20;
        const gr = ctx.createLinearGradient(0, ys, 0, Y_BOTTOM);
        gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, ys); ctx.lineTo(x + 18, ys); ctx.lineTo(x - 30, Y_BOTTOM); ctx.lineTo(x - 60, Y_BOTTOM); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // bubbles
      for (const bb of this.bubbles) {
        ctx.beginPath(); ctx.arc(bb.x, bb.y, bb.r, 0, 7);
        ctx.fillStyle = 'rgba(220,245,255,0.35)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bb.x - bb.r * 0.45, bb.y - bb.r * 0.5, Math.max(0.6, bb.r * 0.35), Math.max(0.6, bb.r * 0.35));
      }
      ctx.restore();
      // surface: meniscus band + specular line modulated by slope
      ctx.globalAlpha = clamp((this.h - 0.04) / 0.2, 0, 1);
      ctx.beginPath(); ctx.moveTo(this.surfX[0], this.surfY[0] + 3);
      for (let i = 1; i <= N; i++) ctx.lineTo(this.surfX[i], this.surfY[i] + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 6; ctx.stroke();
      for (let i = 1; i <= N; i++) {
        const sl = this.surfY[i] - this.surfY[i - 1];
        ctx.beginPath(); ctx.moveTo(this.surfX[i - 1], this.surfY[i - 1]); ctx.lineTo(this.surfX[i], this.surfY[i]);
        ctx.strokeStyle = `rgba(255,255,255,${clamp(0.65 - sl * 0.35, 0.3, 1)})`; ctx.lineWidth = 1.8; ctx.stroke();
      }
      // foam patch at jet impact
      if (this.foam > 0.03) {
        const y = this.surfaceAt(this.impactX);
        for (let k = 0; k < 14; k++) {
          const fx = this.impactX + Math.sin(k * 12.9898 + this.t * 3) * 22 * this.foam;
          const fy = y + 2 + Math.abs(Math.cos(k * 4.1 + this.t * 2)) * 10 * this.foam;
          ctx.beginPath(); ctx.arc(fx, fy, 2 + (k % 4) * this.foam * 1.5, 0, 7);
          ctx.fillStyle = `rgba(255,255,255,${0.35 * this.foam})`; ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const ell = (rx: number, ry: number) => { ctx.beginPath(); ctx.ellipse(CX, CY, rx, ry, 0, 0, Math.PI * 2); };
    ell(RX, RY); ctx.lineWidth = TW; ctx.strokeStyle = 'rgba(14,82,200,0.62)'; ctx.stroke();
    ctx.lineWidth = TW * 0.66; ctx.strokeStyle = 'rgba(40,130,240,0.6)'; ctx.stroke();
    ctx.lineWidth = TW * 0.3; ctx.strokeStyle = 'rgba(120,195,255,0.55)'; ctx.stroke();
    ell(RX + TW / 2, RY + TW / 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,48,140,0.9)'; ctx.stroke();
    ell(RX - TW / 2, RY - TW / 2); ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(CX, CY, RX + TW * 0.25, RY + TW * 0.25, 0, Math.PI * 1.05, Math.PI * 1.42);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(CX, CY, RX + TW * 0.25, RY + TW * 0.25, 0, Math.PI * 1.55, Math.PI * 1.7);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(CX, CY, RX - TW * 0.25, RY - TW * 0.25, 0, Math.PI * 0.08, Math.PI * 0.42);
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    ctx.restore();
  }

  private drawPipeBody(ctx: CanvasRenderingContext2D, p: Pipe) {
    const path = p.path, r = p.r, L = path.length;
    const hl = (-p.hl) as 1 | -1;
    // empty glass portions, then the water-filled portion in the brand glass-pipe style
    if (p.fill0 > 1) drawGlassPipe(ctx, path, { r, flow: 0, t: this.t, water: false, s0: 0, s1: p.fill0, rings: p.rings, hl });
    if (p.fill1 < L - 1) drawGlassPipe(ctx, path, { r, flow: 0, t: this.t, water: false, s0: p.fill1, s1: L, rings: p.rings, hl });
    if (p.fill1 > p.fill0 + 1) {
      drawGlassPipe(ctx, path, { r, flow: p.vel, t: this.t, s0: p.fill0, s1: p.fill1, rings: p.rings, hl });
      ctx.save();
      if (p.fill1 < L - 1) { // water front meniscus
        const f = path.at(p.fill1);
        ctx.beginPath(); ctx.moveTo(f.x + f.nx * r, f.y + f.ny * r);
        ctx.quadraticCurveTo(f.x + f.tx * 5, f.y + f.ty * 5, f.x - f.nx * r, f.y - f.ny * r);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // turbulent tracers following the 1/7 power-law profile
      ctx.strokeStyle = 'rgba(235,250,255,0.55)'; ctx.lineWidth = 1.2;
      for (const t of p.tracers) {
        if (t.s < p.fill0 || t.s > p.fill1) continue;
        const a = path.at(t.s);
        const off = t.rf * (r - 3);
        const x = a.x + a.nx * off, y = a.y + a.ny * off;
        const u = (p.vel / 0.817) * Math.pow(1 - Math.abs(t.rf), 1 / 7);
        const len = Math.min(16, Math.abs(u) * 0.05) + 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - a.tx * len, y - a.ty * len); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** run a local drawing in the pipe frame (x along flow, y across) */
  private local(ctx: CanvasRenderingContext2D, p: Path, s: number, fn: () => void) {
    const a = p.at(s);
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.ty, a.tx)); fn(); ctx.restore();
  }

  private flangePair(ctx: CanvasRenderingContext2D, p: Path, s: number, r = PIPE_R) {
    this.local(ctx, p, s, () => {
      const R = r + 8;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R);
      ctx.fillRect(-7, -R, 6, 2 * R); ctx.fillRect(1, -R, 6, 2 * R);
      ctx.fillStyle = '#20262d'; ctx.fillRect(-1, -R + 1, 2, 2 * R - 2); // gasket
      ctx.fillStyle = metalGrad(ctx, 0, -3, 0, 3, 'steel');
      for (const yy of [-R + 3.5, R - 3.5]) { ctx.fillRect(-11, yy - 1.6, 22, 3.2); ctx.fillRect(-11, yy - 2.6, 3, 5.2); ctx.fillRect(8, yy - 2.6, 3, 5.2); }
    });
  }

  private drawFittingsRiser(ctx: CanvasRenderingContext2D) {
    const p = this.riser.path;
    // wellhead flange & check valve flanges
    this.flangePair(ctx, p, this.sWellFl);
    this.flangePair(ctx, p, this.sCheck - 30);
    this.flangePair(ctx, p, this.sCheck + 30);
    // swing check valve (body cut-away shows the disc)
    this.local(ctx, p, this.sCheck, () => {
      const R = PIPE_R + 11;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R);
      ctx.beginPath(); ctx.ellipse(0, 0, 24, R, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-6, -R - 7, 14, 8); // bonnet
      ctx.fillStyle = 'rgba(200,235,255,0.85)';
      ctx.beginPath(); ctx.ellipse(0, 0, 15, PIPE_R - 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(40,130,230,0.6)'; ctx.fill();
      const open = this.qPump > 0.003 ? clamp(Math.sqrt(this.qPump / 0.3), 0, 1) : 0;
      const ang = -Math.PI / 2 + open * 1.15;
      ctx.save(); ctx.translate(-4, -PIPE_R + 2); ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#1b2f55'; ctx.fillRect(-1.8, 0, 3.6, 2 * PIPE_R - 6); ctx.restore();
      ctx.fillStyle = '#e8eef5'; ctx.beginPath(); ctx.moveTo(10, -R + 4); ctx.lineTo(20, -R + 7); ctx.lineTo(10, -R + 10); ctx.closePath(); ctx.fill();
    });
    // coupling sleeve (manchette, Gibault/Dresser type)
    this.local(ctx, p, this.sCoupling, () => {
      const R = PIPE_R + 5;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R); ctx.fillRect(-20, -R, 40, 2 * R);
      for (const x of [-24, 17]) { ctx.fillStyle = metalGrad(ctx, 0, -R - 5, 0, R + 5); ctx.fillRect(x, -R - 5, 7, 2 * R + 10); }
      ctx.fillStyle = metalGrad(ctx, 0, -2, 0, 2, 'steel');
      for (const yy of [-R - 3, R + 3]) { ctx.fillRect(-30, yy - 1.4, 60, 2.8); ctx.fillRect(-31, yy - 2.6, 5, 5.2); ctx.fillRect(26, yy - 2.6, 5, 5.2); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-20, -R + 3, 40, 3);
    });
    // tee + isolating cock + Bourdon gauge
    const a = p.at(this.sGauge);
    const gx = a.x + 62, gy = a.y;
    ctx.fillStyle = metalGrad(ctx, 0, gy - 5, 0, gy + 5, 'steel'); ctx.fillRect(a.x + PIPE_R, gy - 4, gx - a.x - PIPE_R - 22, 8);
    ctx.fillStyle = '#c83a2a'; ctx.fillRect(a.x + 26, gy - 9, 4, 6);
    ctx.save(); ctx.translate(gx, gy);
    ctx.fillStyle = metalGrad(ctx, -25, -25, 25, 25, 'steel'); ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5, pMax = 2.5;
    ctx.strokeStyle = '#d12d2d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 17.5, a0 + span * 1.6 / pMax, a0 + span); ctx.stroke();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
    for (let v = 0; v <= pMax + 1e-6; v += 0.25) {
      const an = a0 + span * v / pMax, maj = Math.abs(v - Math.round(v * 2) / 2) < 1e-6;
      ctx.beginPath(); ctx.moveTo(Math.cos(an) * (maj ? 14 : 16.5), Math.sin(an) * (maj ? 14 : 16.5)); ctx.lineTo(Math.cos(an) * 19.5, Math.sin(an) * 19.5); ctx.stroke();
    }
    ctx.fillStyle = '#1f2937'; ctx.font = 'bold 5.5px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const v of [0, 1, 2]) { const an = a0 + span * v / pMax; ctx.fillText(String(v), Math.cos(an) * 10.5, Math.sin(an) * 10.5 + 2); }
    ctx.fillText('bar', 0, 13);
    const an = a0 + span * clamp(this.needle, -0.05, pMax + 0.05) / pMax;
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-Math.cos(an) * 4, -Math.sin(an) * 4); ctx.lineTo(Math.cos(an) * 17, Math.sin(an) * 17); ctx.stroke();
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-7, -9, 10, 5, -0.5, 0, 7); ctx.fill();
    ctx.restore();
    // wall penetration sleeve with puddle flange
    this.local(ctx, p, this.sWall, () => {
      const R = PIPE_R + 4;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R); ctx.fillRect(-14, -R, 28, 2 * R);
      ctx.fillStyle = metalGrad(ctx, 0, -R - 7, 0, R + 7); ctx.fillRect(-3, -R - 7, 6, 2 * R + 14);
    });
    // spout end ring
    const L = p.length;
    this.local(ctx, p, L - 3, () => { ctx.fillStyle = metalGrad(ctx, 0, -PIPE_R - 4, 0, PIPE_R + 4); ctx.fillRect(-3, -PIPE_R - 4, 6, 2 * PIPE_R + 8); });
  }

  private drawFittingsDist(ctx: CanvasRenderingContext2D) {
    const p = this.dist.path;
    this.flangePair(ctx, p, this.sDistFl);
    // electromagnetic flow meter (flanged spool + converter head)
    this.flangePair(ctx, p, this.sMeter - 30); this.flangePair(ctx, p, this.sMeter + 30);
    this.local(ctx, p, this.sMeter, () => {
      const R = PIPE_R + 9;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R); ctx.fillRect(-24, -R, 48, 2 * R);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-24, -R + 3, 48, 3);
    });
    const m = p.at(this.sMeter);
    ctx.fillStyle = metalGrad(ctx, 0, m.y - 6, 0, m.y + 6, 'steel'); ctx.fillRect(m.x + PIPE_R + 9, m.y - 5, 12, 10);
    const bx = m.x + PIPE_R + 21, by = m.y - 22;
    ctx.fillStyle = '#e5e9ee'; ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, 58, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0f2a1d'; ctx.fillRect(bx + 5, by + 6, 48, 22);
    ctx.fillStyle = '#7CFFB2'; ctx.font = 'bold 10px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right';
    ctx.fillText((this.qDist * 1000).toFixed(0), bx + 40, by + 21);
    ctx.font = '6px ui-monospace, Menlo, monospace'; ctx.fillText('L/s', bx + 51, by + 21);
    ctx.fillStyle = '#334155'; ctx.font = 'bold 6px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('SIGAT  EMF', bx + 6, by + 38);

    // butterfly valve: wafer body, disc rotating with opening, lever on notched quadrant
    this.flangePair(ctx, p, this.sButterfly - 9); this.flangePair(ctx, p, this.sButterfly + 9);
    const bv = p.at(this.sButterfly);
    this.local(ctx, p, this.sButterfly, () => {
      const R = PIPE_R + 6;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R); ctx.fillRect(-2, -R, 4, 2 * R);
      const phi = (1 - this.distOpen) * Math.PI / 2;
      ctx.save(); ctx.rotate(phi);
      ctx.fillStyle = '#c7d2de'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, PIPE_R - 2, 3, Math.PI / 2, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
    });
    const lx = bv.x + PIPE_R + 6;
    ctx.fillStyle = metalGrad(ctx, 0, bv.y - 4, 0, bv.y + 4, 'steel'); ctx.fillRect(lx, bv.y - 3, 10, 6);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(lx + 10, bv.y, 22, -Math.PI / 2, 0); ctx.stroke();
    for (let k = 0; k <= 9; k++) { const an = -Math.PI / 2 + k * Math.PI / 18; ctx.beginPath(); ctx.moveTo(lx + 10 + Math.cos(an) * 20, bv.y + Math.sin(an) * 20); ctx.lineTo(lx + 10 + Math.cos(an) * 24, bv.y + Math.sin(an) * 24); ctx.stroke(); }
    const lev = -this.distOpen * Math.PI / 2;
    ctx.strokeStyle = '#d23b2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lx + 10, bv.y); ctx.lineTo(lx + 10 + Math.cos(lev) * 30, bv.y + Math.sin(lev) * 30); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  private drawFittingsDrain(ctx: CanvasRenderingContext2D) {
    const p = this.drain.path;
    this.flangePair(ctx, p, this.drain.path.sAtY(500));
    this.flangePair(ctx, p, this.sDrainValve - 24); this.flangePair(ctx, p, this.sDrainValve + 24);
    // gate valve (vanne à opercule): body, bonnet, rising wedge visible in cut-away, handwheel
    this.local(ctx, p, this.sDrainValve, () => {
      const R = PIPE_R + 9;
      ctx.fillStyle = metalGrad(ctx, 0, -R, 0, R);
      ctx.fillRect(-17, -R, 34, 2 * R);
      ctx.fillRect(-10, R - 2, 20, 30); // bonnet toward local +y (world left)
      ctx.fillRect(-14, R + 26, 28, 5);
      ctx.fillStyle = metalGrad(ctx, -2, 0, 2, 0, 'steel'); ctx.fillRect(-1.6, R + 30, 3.2, 16); // stem
      // cut-away window
      ctx.fillStyle = 'rgba(40,130,230,0.75)'; ctx.fillRect(-9, -PIPE_R + 1, 18, 2 * PIPE_R - 2);
      const gateBottom = -PIPE_R + 1 + (2 * PIPE_R - 2) * this.drainOpen; // gate travels toward +y as it opens
      ctx.fillStyle = '#1c2e52';
      ctx.fillRect(-3.5, gateBottom, 7, (PIPE_R - 1) - gateBottom);
    });
    const v = p.at(this.sDrainValve);
    const wx = v.x - (PIPE_R + 9 + 46), wy = v.y;
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(this.wheelAngle);
    ctx.strokeStyle = '#c62f24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke();
    ctx.lineWidth = 2.5; for (let k = 0; k < 5; k++) { const an = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * 15, Math.sin(an) * 15); ctx.stroke(); }
    ctx.fillStyle = '#8b1e17'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(wx, wy, 17.5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
    // outlet end flange
    this.local(ctx, p, p.length - 3, () => { ctx.fillStyle = metalGrad(ctx, 0, -PIPE_R - 7, 0, PIPE_R + 7); ctx.fillRect(-3, -PIPE_R - 7, 6, 2 * PIPE_R + 14); });
  }

  private drawDrip(ctx: CanvasRenderingContext2D) {
    const e = this.drain.path.at(this.drain.path.length);
    if (this.dripR > 0.6) {
      const r = this.dripR;
      // pendant drop with neck (shape approaches pinch-off as weight ≈ surface tension)
      const neck = Math.max(1.5, 5 - r * 0.45);
      const cy = e.y + r * 1.25 + 1;
      ctx.beginPath();
      ctx.moveTo(e.x - 7, e.y);
      ctx.quadraticCurveTo(e.x - neck, e.y + 2, e.x - neck * 0.8, cy - r * 0.8);
      ctx.arc(e.x, cy, r, Math.PI * 1.25, Math.PI * 1.75, true);
      ctx.quadraticCurveTo(e.x + neck, e.y + 2, e.x + 7, e.y);
      ctx.closePath();
      const g = ctx.createRadialGradient(e.x - r * 0.3, cy - r * 0.2, 0.5, e.x, cy, r * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(170,220,255,0.75)'); g.addColorStop(1, 'rgba(40,130,230,0.75)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,90,190,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    for (const d of this.falling) drawDrop(ctx, d.x, d.y, d.r, Math.min(1.2, d.vy / 600));
  }

  private drawLabels(ctx: CanvasRenderingContext2D) {
    const L = this.labels;
    const rp = this.riser.path, dp = this.dist.path;
    const at = (p: Path, s: number) => p.at(s);
    const g = at(rp, this.sGauge);
    const items: [string, number, number, number, number][] = [
      [L.reservoir, 175, 130, 22, 40],
      [L.inlet, 345, 215, 22, 80],
      [L.staffGauge, 470, 215, 560, 120],
      [L.wallSleeve, at(rp, this.sWall).x + 18, at(rp, this.sWall).y, 640, 430],
      [L.gauge, g.x + 87, g.y, 640, 480],
      [L.coupling, at(rp, this.sCoupling).x + 32, at(rp, this.sCoupling).y, 640, 565],
      [L.riser, at(rp, rp.sAtY(680)).x + 16, 680, 640, 650],
      [L.checkValve, at(rp, this.sCheck).x + 26, at(rp, this.sCheck).y, 640, 740],
      [L.flange, at(rp, this.sWellFl).x + 24, at(rp, this.sWellFl).y, 640, 795],
      [L.borehole, 534, 900, 640, 880],
      [L.waterTable, 706, WT_Y - 9, 640, 945],
      [L.pump, 516, 1020, 640, 1010],
      [L.aquifer, 620, 1060, 640, 1070],
      [L.flowMeter, at(dp, this.sMeter).x - 24, at(dp, this.sMeter).y, 22, 520],
      [L.butterfly, at(dp, this.sButterfly).x - 21, at(dp, this.sButterfly).y, 22, 630],
      [L.drainValve, at(this.drain.path, this.sDrainValve).x - 86, at(this.drain.path, this.sDrainValve).y, 22, 720],
      [L.manhole, 357, GROUND + 20, 22, 860],
      [L.distribution, 120, 940, 22, 1000],
    ];
    ctx.save();
    ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (const [text, ax, ay, lx, ly] of items) {
      if (!text) continue;
      const tw = ctx.measureText(text).width + 14;
      const right = lx > 400;
      let bx = right ? lx : lx;
      bx = clamp(bx, this.viewX0 + 6, this.viewX1 - tw - 6);
      const by = ly - 11;
      const cxl = right ? bx : bx + tw;
      ctx.strokeStyle = 'rgba(15,40,90,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cxl, ly); ctx.stroke();
      ctx.fillStyle = '#0f2a5a'; ctx.beginPath(); ctx.arc(ax, ay, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = 'rgba(15,60,140,0.35)';
      ctx.beginPath(); ctx.roundRect(bx, by, tw, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b2350'; ctx.fillText(text, bx + 7, ly + 0.5);
    }
    ctx.restore();
  }
}
