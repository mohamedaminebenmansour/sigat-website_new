/**
 * PIPE LAYING — a time-driven (looping) long section of a real water-main trench (ductile iron, DN ~300).
 * The scene follows the real sequence (AWWA C600 / EN 805 practice):
 *   0 excavation      the excavator digs the trench, spoil goes to a heap on the far bank
 *   1 bedding         sand bed placed by the bucket and compacted by a plate compactor
 *   2 laying/jointing each pipe is lifted from the bank in slings (it swings as a damped pendulum),
 *                     lowered onto the bed and its spigot pushed into the previous socket, through the
 *                     rubber gasket, until the white insertion mark reaches the socket mouth
 *   3 thrust block    90° bend + riser to an air valve; a concrete block poured against undisturbed soil
 *                     on the outside of the bend takes the thrust (F = P·A)
 *   4 initial fill    haunch + 30 cm over the crown in compacted lifts; joints left open for inspection
 *   5 pressure test   the line valve is opened: water fills slowly from the network, air leaves at the
 *                     air valve until water spurts; the hand pump raises the pressure stroke by stroke
 *                     to STP = 1.5 × PN and it is held (no visible drop)
 *   6 final fill      joints covered, backfill to grade in lifts, road reinstated, the line in service
 * Mechanics: two-link inverse kinematics for the excavator arm, a damped pendulum driven by the hook's
 * acceleration (φ'' = −(g/L)φ − 2ζω φ' − a/L), ballistic particles (g = 1650 px/s²), spoil volume
 * conserved (heap shrinks as the trench is backfilled).
 */
import { clamp, rand } from '../../../shared/hydro/hydro-physics';
import { Path, Seg, buildPath, tracePath } from '../../../shared/hydraulics/hydraulics-core';

const G = 1650;
/** scroll-progress boundaries of the 7 stages */
export const LAY_BOUNDS = [0, 0.13, 0.23, 0.52, 0.59, 0.69, 0.87, 1];
const lin = (a: number, b: number, x: number) => clamp((x - a) / (b - a), 0, 1);
const ss = (a: number, b: number, x: number) => { const t = lin(a, b, x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Part { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string; g: number; stopY: number; }

function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class PipeLayingEngine {
  private ctx: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  private p = 0; private t = 0;
  // geometry
  private narrow = false;
  private gy = 0; private D = 0; private yb = 0; private R = 0; private ri = 0; private bt = 0; private yc = 0;
  private tx0 = 0; private tx1 = 0; private e = 0; private xs = 0; private xe = 0; private Lp = 0;
  private sockL = 0; private ins = 0; private k = 1; private Rb = 0; private xv = 0;
  private line?: Path; private sValve = 0; private sBend = 0;
  private soilC = document.createElement('canvas');
  private farC = document.createElement('canvas');
  private parts: Part[] = [];
  // hanging load pendulum + excavator travel
  private phi = 0; private om = 0; private hx: number[] = [];
  private exX = NaN; private exPrev = 0; private trackPh = 0;
  private dumpClock = 0; private sandClock = 0; private airClock = 0;
  step = 0;
  onStep?: (i: number) => void;

  constructor(private canvas: HTMLCanvasElement, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number) {
    this.W = w; this.H = h;
    this.dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const n = this.narrow = w < 768;
    // desktop: ground high, trench bottom at ~70 % — the bottom band (stage rail) stays on deep soil
    this.gy = h * (n ? 0.44 : 0.42);
    this.D = clamp(h * (n ? 0.22 : 0.28), 110, 300);
    this.yb = this.gy + this.D;
    this.R = clamp(this.D * (n ? 0.13 : 0.12), 11, 30);
    this.ri = this.R * 0.78;
    this.bt = this.R * 0.55;
    this.yc = this.yb - this.bt - this.R;
    this.tx0 = w * (n ? 0.03 : 0.05); this.tx1 = w * (n ? 0.97 : 0.95);
    this.e = this.D * 0.06;
    this.k = clamp(this.D / 230, 0.55, 1.15) * (n ? 0.85 : 1);
    this.Rb = this.R * 2;
    this.sockL = this.R * 1.5; this.ins = this.sockL * 0.8;
    this.xs = this.tx0 + this.R * 3.4;
    this.xe = this.tx1 - this.e - this.Rb - this.R * 1.7;
    this.Lp = (this.xe - this.xs) / 3;
    this.xv = this.tx0 + this.R * 1.5;
    // the water line: existing main → new line → 90° bend → riser up to the air valve
    const top = this.gy - this.R * 0.9;
    this.line = buildPath(-this.R * 2, this.yc, [
      ['L', this.xe, this.yc] as Seg,
      ['Q', this.xe + this.Rb, this.yc, this.xe + this.Rb, this.yc - this.Rb] as Seg,
      ['L', this.xe + this.Rb, top] as Seg,
    ], 1.5);
    this.sValve = this.xv + this.R * 2;
    this.sBend = this.xe + this.R * 2;
    this.buildSoil();
    if (isNaN(this.exX)) this.exX = this.tx0 + 210 * this.k;
  }

  /** soil cut face (outside the trench) and the shaded far wall (inside it), pre-rendered */
  private buildSoil() {
    const { W, H, gy, D } = this;
    for (const [c, dark] of [[this.soilC, 0], [this.farC, 1]] as const) {
      c.width = Math.max(1, Math.round(W * this.dpr)); c.height = Math.max(1, Math.round((H - gy + 2) * this.dpr));
      const g = c.getContext('2d')!;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, -gy * this.dpr);
      const strata: [number, string, string][] = [
        [gy, '#6b4d33', '#4c3524'], [gy + D * 0.1, '#9b7650', '#6d5136'], [gy + D * 0.5, '#b38d5c', '#7e6240'],
        [gy + D * 0.85, '#8f6f4a', '#654c33'], [H + 2, '', ''],
      ];
      for (let i = 0; i < strata.length - 1; i++) {
        const [y0, c0, c1] = strata[i], y1 = strata[i + 1][0];
        // wavy boundaries, like real strata
        g.beginPath(); g.moveTo(0, y0 + (i ? Math.sin(0) * 3 : 0));
        for (let x = 0; x <= W; x += 20) g.lineTo(x, y0 + (i ? Math.sin(x * 0.013 + i) * 4 : 0));
        g.lineTo(W, y1 + 6); g.lineTo(0, y1 + 6); g.closePath();
        g.fillStyle = dark ? c1 : c0; g.fill();
      }
      const rnd = mulberry(dark ? 11 : 7);
      for (let i = 0; i < (W * (H - gy)) / 180; i++) {             // grains, pebbles
        const x = rnd() * W, y = gy + rnd() * (H - gy), r = rnd() < 0.08 ? 1.5 + rnd() * 2.5 : 0.6 + rnd() * 0.9;
        g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${dark ? 0.18 : 0.12})` : `rgba(255,240,210,${dark ? 0.08 : 0.16})`;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      if (dark) {                                                     // bucket-tooth marks on the far wall
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
        for (let x = 0; x < W; x += 9 + rnd() * 6) { g.beginPath(); g.moveTo(x, gy + 6); g.lineTo(x + rnd() * 6 - 3, gy + D * (0.6 + rnd() * 0.4)); g.stroke(); }
      }
    }
  }

  /** a new site: back to undisturbed ground (used when the looping hero starts over) */
  restart() {
    this.p = 0; this.parts = []; this.phi = 0; this.om = 0; this.hx = [];
    this.exX = this.tx0 + 210 * this.k; this.dumpClock = this.sandClock = this.airClock = 0;
  }

  frame(dt: number, target: number) {
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    this.p = this.reduced ? target : this.p + (target - this.p) * Math.min(1, dt * 5);
    let s = 0; while (s < 6 && this.p >= LAY_BOUNDS[s + 1]) s++;
    if (s !== this.step) { this.step = s; this.onStep?.(s); }
    this.simulate(dt);
    this.draw();
  }

  /* ======================================================================== state */
  private get xf() { return lerp(this.tx0, this.tx1, ss(0.005, 0.12, this.p)); }                 // excavation front
  private get xbed() { return lerp(this.tx0, this.tx1, lin(0.135, 0.215, this.p)); }             // bedding front
  private pipeSpan(i: number) { const a = this.xs + i * this.Lp - this.ins; return [a, this.xs + (i + 1) * this.Lp] as const; }
  private layU(i: number) { return (this.p - 0.23) / ((0.52 - 0.23) / 3) - i; }
  /** where pipe i is: on the bank, hanging, resting, pushed home */
  private pipePose(i: number): { x0: number; x1: number; cy: number; hang: boolean; hook?: [number, number] } {
    const [a, b] = this.pipeSpan(i), u = this.layU(i), R = this.R, L = R * 3;
    const bankY = this.gy - R * 1.05, bankDx = R * 0.9, gap = R * 1.5, liftY = this.gy - R * 5.5;
    if (u <= 0.12) return { x0: a + bankDx, x1: b + bankDx, cy: bankY, hang: false, hook: u > 0 ? [lerp(a + bankDx + (b - a) / 2 + 40 * this.k, (a + b) / 2 + bankDx, ss(0, 0.12, u)), lerp(liftY - L, bankY - L, ss(0, 0.12, u))] : undefined };
    if (u < 0.62) {
      const cx = lerp((a + b) / 2 + bankDx, (a + b) / 2 + gap, ss(0.3, 0.42, u));
      const cy = u < 0.42 ? lerp(bankY, liftY, ss(0.12, 0.3, u)) : lerp(liftY, this.yc, ss(0.42, 0.62, u));
      return { x0: cx - (b - a) / 2, x1: cx + (b - a) / 2, cy, hang: true, hook: [cx, cy - L] };
    }
    const push = ss(0.66, 0.9, u);
    const off = gap * (1 - push);
    const hook: [number, number] | undefined = u < 0.95 ? [(a + b) / 2 + off, lerp(this.yc - L, this.gy - R * 7, ss(0.9, 0.95, u))] : undefined;
    return { x0: a + off, x1: b + off, cy: this.yc, hang: false, hook };
  }

  private simulate(dt: number) {
    const k = this.k, p = this.p;
    // ----- pendulum of the load currently in the slings
    const cur = [0, 1, 2].find(i => { const u = this.layU(i); return u > 0.12 && u < 0.62; });
    if (cur !== undefined && !this.reduced) {
      const pose = this.pipePose(cur);
      this.hx.push(pose.hook![0]); if (this.hx.length > 3) this.hx.shift();
      const ax = this.hx.length === 3 ? (this.hx[2] - 2 * this.hx[1] + this.hx[0]) / (dt * dt) : 0;
      const L = this.R * 3, w2 = (G * 0.6) / L, zeta = 0.07;
      this.om += (-w2 * Math.sin(this.phi) - 2 * zeta * Math.sqrt(w2) * this.om - clamp(ax, -6000, 6000) / L * Math.cos(this.phi)) * dt;
      this.phi = clamp(this.phi + this.om * dt, -0.45, 0.45);
      if (this.layU(cur) > 0.56) { this.phi *= 0.9; this.om *= 0.9; }           // guided by hand onto the bed
    } else { this.phi *= 0.9; this.om = 0; this.hx = []; }

    // ----- excavator position: follows the work (it travels; the tracks turn)
    const work = this.workX();
    const want = clamp(work + 215 * k, -400, this.W + 400 * k);
    const prev = this.exX;
    this.exX = this.reduced ? want : this.exX + (want - this.exX) * Math.min(1, dt * 2.2);
    this.trackPh += (this.exX - prev);
    this.exPrev = prev;

    if (this.reduced) { this.parts = []; return; }
    // ----- particles: soil dumped on the heap, sand into the trench, concrete, air, spray
    const bucket = this.bucketTip();
    if (p < 0.125 && bucket.dump) {
      this.dumpClock -= dt;
      if (this.dumpClock <= 0) { this.dumpClock = 0.03; for (let q = 0; q < 2; q++) this.parts.push({ x: bucket.x + rand(-8, 8) * k, y: bucket.y, vx: rand(-30, 30), vy: rand(0, 40), r: rand(1.5, 3.5) * k, life: 2, c: rand(0, 1) < 0.5 ? '#7a5a3a' : '#9b7650', g: 1, stopY: this.gy - this.heapH(bucket.x) + rand(0, 6) }); }
    }
    if (p > 0.13 && p < 0.22) {
      this.sandClock -= dt;
      if (this.sandClock <= 0) { this.sandClock = 0.02; this.parts.push({ x: this.xbed + 14 * k + rand(-6, 6) * k, y: this.gy - 70 * k, vx: rand(-10, 10), vy: rand(0, 30), r: rand(1, 2.2) * k, life: 2, c: '#e2c38a', g: 1, stopY: this.yb - this.bt + rand(0, 3) }); }
    }
    const tb = lin(0.555, 0.585, p);
    if (tb > 0 && tb < 1) for (let q = 0; q < 2; q++) this.parts.push({ x: this.xe + this.Rb + this.R * 1.6 + rand(-4, 4), y: this.gy - 40 * k, vx: rand(-8, 8), vy: 30, r: rand(1.2, 2.4) * k, life: 2, c: '#a9adb1', g: 1, stopY: this.blockTop() });
    // air valve: air out while the line fills, then a spurt when water arrives
    const ut = lin(0.69, 0.87, p);
    const [vx, vy] = this.ventTop();
    if (ut > 0.1 && ut < 0.55) {
      this.airClock -= dt;
      if (this.airClock <= 0) { this.airClock = 0.05; this.parts.push({ x: vx + rand(-2, 2), y: vy, vx: rand(-15, 15), vy: -rand(50, 90), r: rand(2, 4) * k, life: 1, c: 'air', g: 0, stopY: -1e9 }); }
    }
    if (ut > 0.55 && ut < 0.6) for (let q = 0; q < 3; q++) this.parts.push({ x: vx + rand(-2, 2), y: vy, vx: rand(-60, 60), vy: -rand(220, 380), r: rand(1.2, 2.6) * k, life: 1.5, c: '#bfe6ff', g: 1, stopY: this.gy - 2 });
    for (const q of this.parts) {
      q.vy += G * q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.c === 'air') { q.r += dt * 8 * k; q.vy *= 0.97; }
      if (q.g && q.vy > 0 && q.y >= q.stopY) q.life = 0;
    }
    this.parts = this.parts.filter(q => q.life > 0).slice(-500);
  }

  private heapH(x: number): number {
    const fe = lin(this.tx0, this.tx1, this.xf);                                 // excavated fraction
    const back = 0.35 * lin(0.59, 0.69, this.p) + 0.65 * lin(0.87, 0.97, this.p);  // returned to the trench
    const amt = Math.max(0, fe - back * fe) ;
    const x0 = this.tx0 + this.D * 0.3, x1 = this.xf - this.D * 0.3;
    if (x < x0 || x > x1 || amt <= 0) return 0;
    const edge = Math.min(1, (x - x0) / (this.D * 0.6), (x1 - x) / (this.D * 0.6));
    return this.D * 0.42 * amt * edge * (0.9 + 0.1 * Math.sin(x * 0.05));
  }

  private workX(): number {
    const p = this.p, k = this.k;
    if (p < 0.13) return this.xf + 20 * k;
    if (p < 0.23) return this.xbed;
    if (p < 0.52) { for (const i of [0, 1, 2]) { const u = this.layU(i); if (u < 1) { const po = this.pipePose(i); return po.hook ? po.hook[0] - 40 * k : (po.x0 + po.x1) / 2; } } }
    if (p < 0.6) return this.xe + this.Rb - 40 * k;
    if (p < 0.87) return this.W + 400 * k;                                       // parked off to the side during the test
    return lerp(this.tx0 + this.D * 0.6, this.tx1, lin(0.87, 0.97, p)) * (p < 0.97 ? 1 : 0) + (p >= 0.97 ? this.W + 500 * k : 0);
  }

  /** the excavator's working point (bucket tip / lifting hook) and whether it is dumping */
  private bucketTip(): { x: number; y: number; dump: boolean; curl: number; hook: boolean } {
    const p = this.p, k = this.k, t = this.t;
    if (p < 0.13) {
      const xf = this.xf, c = this.reduced ? 0.6 : (t * 0.5) % 1;
      const P = [[xf - 6 * k, this.gy - 40 * k], [xf, this.yb - 6 * k], [xf + 40 * k, this.yb - 16 * k], [xf + 70 * k, this.gy - 85 * k], [xf + 20 * k, this.gy - 120 * k]];
      const seg = [0.0, 0.2, 0.45, 0.65, 0.82, 1.0];
      let i = 0; while (i < 4 && c > seg[i + 1]) i++;
      const f = ss(seg[i], seg[i + 1], c), A = P[i], B = P[(i + 1) % 5];
      return { x: lerp(A[0], B[0], f), y: lerp(A[1], B[1], f), dump: i === 4 && f < 0.7, curl: i === 4 ? -0.9 : i >= 2 ? 0.7 : 0, hook: false };
    }
    if (p < 0.23) return { x: this.xbed + 14 * k, y: this.gy - 70 * k, dump: true, curl: -0.7, hook: false };
    if (p < 0.52) {
      for (const i of [0, 1, 2]) { const u = this.layU(i); if (u > 0 && u < 1) { const po = this.pipePose(i); if (po.hook) return { x: po.hook[0], y: po.hook[1], dump: false, curl: 0.4, hook: true }; } }
      return { x: this.exX - 150 * k, y: this.gy - 160 * k, dump: false, curl: 0.4, hook: true };
    }
    if (p < 0.6) { const u = lin(0.52, 0.555, p); return { x: this.xe + this.Rb, y: lerp(this.gy - this.R * 9, this.yc - this.Rb - this.R * 3, ss(0, 1, u)) - (u >= 1 ? lin(0.555, 0.6, p) * this.R * 6 : 0), dump: false, curl: 0.4, hook: true }; }
    return { x: this.exX - 140 * k, y: this.gy - 150 * k, dump: false, curl: 0.5, hook: false };
  }

  private blockTop(): number { return lerp(this.yb, this.yc - this.R * 1.4, ss(0.555, 0.59, this.p)); }
  private ventTop(): [number, number] { return [this.xe + this.Rb, this.gy - this.R * 0.9 - this.R * 1.7]; }

  /* ======================================================================== render */
  private trenchPoly(g: CanvasRenderingContext2D) {
    const { tx0, gy, yb, e } = this, xf = this.xf;
    if (xf <= tx0 + 2) return false;
    const done = xf >= this.tx1 - 0.5;
    const xb = Math.max(tx0 + e, xf - (done ? e : this.D * 0.45));
    g.beginPath(); g.moveTo(tx0, gy); g.lineTo(tx0 + e, yb); g.lineTo(xb, yb); g.lineTo(xf, gy); g.closePath();
    return true;
  }

  private draw() {
    const g = this.ctx, { W, H, gy, R, k, p } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // sky
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#7cc8f4'); sky.addColorStop(0.7, '#b6e3fa'); sky.addColorStop(1, '#d8f1fd');
    g.fillStyle = sky; g.fillRect(0, 0, W, gy + 1);
    const sun = g.createRadialGradient(W * 0.78, gy * 0.35, 0, W * 0.78, gy * 0.35, W * 0.35);
    sun.addColorStop(0, 'rgba(255,255,255,0.6)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, gy);
    // spoil heap on the far bank (volume follows the excavation and the backfill)
    g.beginPath(); g.moveTo(0, gy);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, gy - this.heapH(x));
    g.lineTo(W, gy); g.closePath();
    const hg = g.createLinearGradient(0, gy - this.D * 0.45, 0, gy);
    hg.addColorStop(0, '#a98257'); hg.addColorStop(1, '#7d5d3c'); g.fillStyle = hg; g.fill();
    // pipes strung out on the bank, waiting
    for (const i of [0, 1, 2]) if (this.layU(i) <= 0.12) { const po = this.pipePose(i); this.drawPipe(po.x0, po.x1, po.cy, true, false, 0); }
    // soil face
    g.drawImage(this.soilC, 0, gy - 1, W, H - gy + 2);
    g.fillStyle = '#5d7d33'; g.fillRect(0, gy - 2, W, 3);                        // topsoil / grass line

    // ---- inside the trench
    g.save();
    if (this.trenchPoly(g)) {
      g.clip();
      g.drawImage(this.farC, 0, gy - 1, W, H - gy + 2);
      this.drawFills(g);
    }
    g.restore();

    // ---- the line
    this.drawStub();
    for (const i of [0, 1, 2]) { const u = this.layU(i); if (u > 0.12) { const po = this.pipePose(i); this.drawSlung(po, i); } }
    this.drawBend();
    this.drawWater();
    this.drawCompactor();
    this.drawTestRig();
    this.drawExcavator();
    // reinstatement: asphalt patch over the trench, then the surface box of the air valve
    const ra = lin(0.965, 1, p);
    if (ra > 0) { g.fillStyle = '#3b4046'; g.fillRect(this.tx0, gy - 1, (this.tx1 - this.tx0) * ra, Math.max(3, R * 0.35)); }
    // particles
    for (const q of this.parts) {
      if (q.c === 'air') { g.fillStyle = `rgba(255,255,255,${(0.5 * q.life).toFixed(2)})`; }
      else g.fillStyle = q.c;
      g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
    }
    void k;
  }

  /** sand bed, concrete block, backfill lifts (inside the trench clip) */
  private drawFills(g: CanvasRenderingContext2D) {
    const { tx0, tx1, yb, bt, R, yc, gy, p } = this;
    // sand bedding
    const xb = this.xbed;
    if (xb > tx0) {
      g.fillStyle = '#e2c38a'; g.fillRect(tx0, yb - bt, xb - tx0, bt + 2);
      g.fillStyle = 'rgba(120,90,40,0.25)';
      for (let x = tx0; x < xb; x += 7) { g.fillRect(x, yb - bt + ((x * 7) % 5) + 2, 1.4, 1.4); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(tx0, yb - bt, xb - tx0, 1.2);
    }
    // concrete thrust block (behind the bend, against undisturbed soil)
    const bTop = this.blockTop();
    if (bTop < yb - 1) {
      const x0 = this.xe + this.R * 0.2;
      const cg = g.createLinearGradient(0, bTop, 0, yb);
      cg.addColorStop(0, '#c3c7cb'); cg.addColorStop(1, '#8d9399');
      g.fillStyle = cg; g.fillRect(x0, bTop, tx1 - x0, yb - bTop);
      g.fillStyle = 'rgba(60,65,70,0.25)';
      for (let i = 0; i < 40; i++) g.fillRect(x0 + ((i * 37) % (tx1 - x0)), bTop + ((i * 53) % Math.max(1, yb - bTop)), 1.5, 1.5);
    }
    // initial backfill: 3 compacted lifts up to 30 cm over the crown, joints left open
    const yTop0 = yb - bt, yTopI = yc - R - R * 1.1;
    const joints = [this.xs, this.pipeSpan(0)[1], this.pipeSpan(1)[1], this.pipeSpan(2)[1]];
    const winOpen = 1 - lin(0.87, 0.895, p);
    let level = yTop0;
    for (let j = 0; j < 3; j++) {
      const u = lin(0.59 + j * 0.033, 0.59 + (j + 1) * 0.033, p);
      if (u <= 0) break;
      const y1 = lerp(yTop0, yTopI, (j + 1) / 3), xr = lerp(tx0, tx1, u);
      g.fillStyle = j % 2 ? '#c9a673' : '#c09b68'; g.fillRect(tx0, y1, xr - tx0, level - y1 + 0.5);
      g.fillStyle = 'rgba(90,60,30,0.3)'; g.fillRect(tx0, y1, xr - tx0, 1);
      level = u >= 1 ? y1 : level;
    }
    // final backfill to grade, lifts with their compaction lines
    let lv = yTopI;
    for (let j = 0; j < 4; j++) {
      const u = lin(0.895 + j * 0.018, 0.895 + (j + 1) * 0.018, p);
      if (u <= 0) break;
      const y1 = lerp(yTopI, gy, (j + 1) / 4), xr = lerp(tx0, tx1, u);
      g.fillStyle = j % 2 ? '#a07a50' : '#96714a'; g.fillRect(tx0, y1, xr - tx0, lv - y1 + 0.5);
      g.fillStyle = 'rgba(60,40,20,0.3)'; g.fillRect(tx0, y1, xr - tx0, 1);
      lv = y1;
    }
    // joint holes kept open for the test (dug into the bed and the fill)
    if (lin(0.59, 0.62, p) > 0 && winOpen > 0) {
      for (const jx of joints) {
        const w = R * 1.7 * winOpen;
        g.save(); g.beginPath(); g.rect(jx - w, yc - R * 1.6, w * 2, yb - (yc - R * 1.6) - bt * 0.3); g.clip();
        g.drawImage(this.farC, 0, this.gy - 1, this.W, this.H - this.gy + 2); g.restore();
      }
    }
  }

  /** one ductile-iron pipe in long section: blue epoxy walls, cement-mortar lining, socket at the right end */
  private drawPipe(x0: number, x1: number, cy: number, socket: boolean, mark: boolean, markX: number) {
    const g = this.ctx, R = this.R, ri = this.ri;
    const body = g.createLinearGradient(0, cy - R, 0, cy + R);
    body.addColorStop(0, '#6aa6ea'); body.addColorStop(0.18, '#2f74c8'); body.addColorStop(0.82, '#1c56a0'); body.addColorStop(1, '#0f3566');
    g.fillStyle = body; g.fillRect(x0, cy - R, x1 - x0, R * 2);
    const lin_ = g.createLinearGradient(0, cy - ri, 0, cy + ri);
    lin_.addColorStop(0, '#9da3a8'); lin_.addColorStop(0.5, '#d6d9dc'); lin_.addColorStop(1, '#a4aaaf');
    g.fillStyle = lin_; g.fillRect(x0, cy - ri, x1 - x0, ri * 2);
    if (socket) {                                                                   // bell
      const Rs = R * 1.3, sx = x1 - this.sockL;
      g.fillStyle = body; g.beginPath(); g.roundRect(sx, cy - Rs, this.sockL, Rs * 2, R * 0.25); g.fill();
      g.fillStyle = lin_; g.fillRect(sx + R * 0.2, cy - R * 1.02, this.sockL - R * 0.2, R * 2.04);
      g.fillStyle = '#16181a';                                                      // EPDM gasket in its groove
      g.fillRect(x1 - this.sockL * 0.32, cy - R * 1.14, R * 0.28, R * 0.16); g.fillRect(x1 - this.sockL * 0.32, cy + R * 0.98, R * 0.28, R * 0.16);
    }
    if (mark) { g.fillStyle = '#ffffff'; g.fillRect(markX - 1, cy - R, 2, R * 2); }   // insertion depth mark
    g.strokeStyle = 'rgba(8,30,60,0.55)'; g.lineWidth = 1; g.strokeRect(x0, cy - R, x1 - x0, R * 2);
  }

  /** a pipe in the slings or in place */
  private drawSlung(po: ReturnType<PipeLayingEngine['pipePose']>, i: number) {
    const g = this.ctx, L = this.R * 3;
    let x0 = po.x0, x1 = po.x1, cy = po.cy;
    if (po.hang && po.hook) { const dx = Math.sin(this.phi) * L; x0 += dx; x1 += dx; cy = po.hook[1] + Math.cos(this.phi) * L; }
    this.drawPipe(x0, x1, cy, true, true, x0 + this.ins);
    // slings (two-leg bridle) while it is on the hook
    if (po.hook) {
      const [hx, hy] = po.hook, m = (x1 - x0);
      g.strokeStyle = '#f2b705'; g.lineWidth = Math.max(1.5, this.R * 0.12);
      g.beginPath(); g.moveTo(x0 + m * 0.28, cy - this.R); g.lineTo(hx, hy); g.lineTo(x0 + m * 0.72, cy - this.R); g.stroke();
    }
    void i;
  }

  /** the existing main coming from the network, with its line valve */
  private drawStub() {
    const g = this.ctx, { R, yc, xs, xv } = this;
    const body = g.createLinearGradient(0, yc - R, 0, yc + R);
    body.addColorStop(0, '#7b8794'); body.addColorStop(0.5, '#4b5562'); body.addColorStop(1, '#2c333b');
    g.fillStyle = body; g.fillRect(-R, yc - R, xs + R, R * 2);
    g.fillStyle = '#b9bfc4'; g.fillRect(-R, yc - this.ri, xs + R, this.ri * 2);
    // socket of the stub at xs (receives pipe 1)
    const Rs = R * 1.3;
    g.fillStyle = body; g.beginPath(); g.roundRect(xs - this.sockL, yc - Rs, this.sockL, Rs * 2, R * 0.25); g.fill();
    g.fillStyle = '#b9bfc4'; g.fillRect(xs - this.sockL + R * 0.2, yc - R * 1.02, this.sockL - R * 0.2, R * 2.04);
    // flanged gate valve (blue epoxy) with handwheel; turns open for the test
    const open = ss(0.69, 0.71, this.p), turn = open * Math.PI * 6;
    const vw = R * 1.6, vh = R * 2.7;
    g.fillStyle = '#8fa4b8'; g.fillRect(xv - vw * 0.62, yc - vh / 2, R * 0.3, vh); g.fillRect(xv + vw * 0.62 - R * 0.3, yc - vh / 2, R * 0.3, vh);
    const vg = g.createLinearGradient(xv - vw / 2, 0, xv + vw / 2, 0);
    vg.addColorStop(0, '#12407c'); vg.addColorStop(0.4, '#3d86d6'); vg.addColorStop(1, '#0f3566');
    g.fillStyle = vg; g.beginPath(); g.roundRect(xv - vw / 2, yc - R * 1.2, vw, R * 2.4, R * 0.3); g.fill();
    g.fillRect(xv - R * 0.45, yc - R * 2.4, R * 0.9, R * 1.3);                       // bonnet
    g.strokeStyle = '#c9d3dc'; g.lineWidth = Math.max(2, R * 0.16);
    g.beginPath(); g.moveTo(xv, yc - R * 2.4); g.lineTo(xv, yc - R * 3); g.stroke();
    g.strokeStyle = '#c0392b'; g.lineWidth = Math.max(2, R * 0.18);
    g.beginPath(); g.ellipse(xv, yc - R * 3.05, R * 1.1, R * 0.3, 0, 0, Math.PI * 2); g.stroke();
    const sx = Math.cos(turn) * R * 1.1;                                             // a spoke shows the wheel turning
    g.beginPath(); g.moveTo(xv - sx, yc - R * 3.05 - Math.sin(turn) * R * 0.3 * 0.5); g.lineTo(xv + sx, yc - R * 3.05 + Math.sin(turn) * R * 0.3 * 0.5); g.stroke();
  }

  /** 90° bend + riser + air valve, lowered in during the thrust-block stage */
  private drawBend() {
    if (!this.line || this.p < 0.52) return;
    const g = this.ctx, { R, ri, xe, Rb, yc, gy } = this;
    const u = ss(0.52, 0.555, this.p), drop = (1 - u) * R * 8;
    g.save(); g.translate(0, -drop);
    const P = buildPath(xe - R * 0.2, yc, [['L', xe, yc] as Seg, ['Q', xe + Rb, yc, xe + Rb, yc - Rb] as Seg, ['L', xe + Rb, gy - R * 0.9] as Seg], 1.5);
    g.lineCap = 'butt';
    tracePath(g, P, 0, P.length, 0); g.lineWidth = R * 2; g.strokeStyle = '#2a6fc4'; g.stroke();
    tracePath(g, P, 0, P.length, -R * 0.62); g.lineWidth = R * 0.4; g.strokeStyle = 'rgba(140,195,250,0.7)'; g.stroke();
    tracePath(g, P, 0, P.length, 0); g.lineWidth = ri * 2; g.strokeStyle = '#c9cdd1'; g.stroke();
    // flanges at the bend outlet and at the riser top
    g.fillStyle = '#8fa4b8';
    g.fillRect(xe + Rb - R * 1.35, yc - Rb - R * 0.15, R * 2.7, R * 0.3);
    g.fillRect(xe + Rb - R * 1.35, gy - R * 0.9 - R * 0.3, R * 2.7, R * 0.3);
    // air valve (ventouse): blue body, dome, vent
    const vx = xe + Rb, vy = gy - R * 0.9 - R * 0.3;
    const ag = g.createLinearGradient(vx - R, 0, vx + R, 0);
    ag.addColorStop(0, '#12407c'); ag.addColorStop(0.45, '#4a90dd'); ag.addColorStop(1, '#0f3566');
    g.fillStyle = ag; g.beginPath(); g.roundRect(vx - R * 0.8, vy - R * 1.3, R * 1.6, R * 1.3, R * 0.3); g.fill();
    g.beginPath(); g.ellipse(vx, vy - R * 1.3, R * 0.8, R * 0.45, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#c9d3dc'; g.fillRect(vx - R * 0.15, vy - R * 1.95, R * 0.3, R * 0.35);
    g.restore();
  }

  /** water: always in the existing main up to the valve; fills the new line during the test; flows in service */
  private drawWater() {
    if (!this.line) return;
    const g = this.ctx, L = this.line.length, p = this.p, ut = lin(0.69, 0.87, p);
    const fill = ss(0.08, 0.55, ut);
    let s1 = this.sValve - this.R * 0.9;
    if (p >= 0.69) s1 = lerp(this.sValve, L, fill);
    if (p >= 0.87) s1 = L;
    const pressurised = ut > 0.6 && p < 0.87;
    g.save(); g.lineCap = 'butt';
    tracePath(g, this.line, 0, s1, 0);
    g.lineWidth = this.ri * 1.9; g.strokeStyle = pressurised ? 'rgba(18,96,200,0.88)' : 'rgba(30,128,230,0.82)'; g.stroke();
    g.lineWidth = this.ri * 0.8; g.strokeStyle = 'rgba(120,200,255,0.5)'; g.stroke();
    const moving = (p >= 0.69 && fill < 1) || p >= 0.87;
    if (moving && !this.reduced) {
      tracePath(g, this.line, 0, s1, -this.ri * 0.35);
      g.setLineDash([this.R * 0.9, this.R * 1.6]); g.lineDashOffset = -this.t * (p >= 0.87 ? 90 : 60);
      g.lineWidth = Math.max(1, this.R * 0.1); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke(); g.setLineDash([]);
    }
    // meniscus at the filling front
    if (p >= 0.69 && p < 0.87 && fill > 0 && fill < 1) {
      const a = this.line.at(s1);
      g.translate(a.x, a.y); g.rotate(Math.atan2(a.ty, a.tx));
      g.beginPath(); g.ellipse(0, 0, this.ri * 0.25, this.ri * 0.95, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(200,240,255,0.7)'; g.fill();
    }
    g.restore();
  }

  private drawCompactor() {
    const p = this.p; let x = NaN, y = 0;
    if (p > 0.135 && p < 0.225) { x = this.xbed - 30 * this.k; y = this.yb - this.bt; }
    else if (p > 0.59 && p < 0.69) { const j = Math.min(2, Math.floor((p - 0.59) / 0.033)); x = lerp(this.tx0, this.tx1, lin(0.59 + j * 0.033, 0.59 + (j + 1) * 0.033, p)) - 25 * this.k; y = lerp(this.yb - this.bt, this.yc - this.R * 2.1, (j + 1) / 3); }
    if (isNaN(x)) return;
    const g = this.ctx, k = this.k * 0.8, v = this.reduced ? 0 : Math.sin(this.t * 95) * 1.2;
    g.save(); g.translate(x, y + v);
    g.fillStyle = '#3b3f44'; g.fillRect(-26 * k, -6 * k, 52 * k, 6 * k);                  // vibrating plate
    g.fillStyle = '#f2b705'; g.beginPath(); g.roundRect(-18 * k, -24 * k, 36 * k, 18 * k, 4 * k); g.fill();   // engine housing
    g.fillStyle = '#2b2f33'; g.fillRect(-10 * k, -30 * k, 14 * k, 6 * k);
    g.strokeStyle = '#2b2f33'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(14 * k, -20 * k); g.lineTo(44 * k, -62 * k); g.lineTo(52 * k, -62 * k); g.stroke();   // handle
    g.restore();
  }

  /** hand test pump on the bank with its gauge; hose down to a tapping on the first pipe */
  private drawTestRig() {
    const p = this.p; const a = lin(0.69, 0.71, p) * (1 - lin(0.875, 0.9, p));
    if (a <= 0) return;
    const g = this.ctx, k = this.k, ut = lin(0.69, 0.87, p);
    const px = this.xs + this.Lp * 0.55, py = this.gy;
    g.save(); g.globalAlpha = a;
    // hose
    g.strokeStyle = '#1d1f22'; g.lineWidth = Math.max(2, 3 * k);
    g.beginPath(); g.moveTo(px - 18 * k, py - 10 * k); g.bezierCurveTo(px - 40 * k, py + 30 * k, this.xs + this.R * 2, this.yc - this.R * 3, this.xs + this.R * 2, this.yc - this.R); g.stroke();
    // pump body + lever (strokes while pressurising)
    const pumping = ut > 0.62 && ut < 0.85 && !this.reduced;
    const lever = pumping ? Math.sin(this.t * 7) * 0.5 : -0.2;
    g.fillStyle = '#c0392b'; g.beginPath(); g.roundRect(px - 22 * k, py - 26 * k, 44 * k, 26 * k, 4 * k); g.fill();
    g.fillStyle = '#7b8794'; g.fillRect(px - 4 * k, py - 44 * k, 8 * k, 18 * k);
    g.strokeStyle = '#2b2f33'; g.lineWidth = 4 * k; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px, py - 44 * k); g.lineTo(px + Math.cos(-0.6 + lever) * 46 * k, py - 44 * k + Math.sin(-0.6 + lever) * 46 * k); g.stroke();
    // pressure: network static on filling, then stroke by stroke to STP = 1.5 × PN10 = 15 bar, held
    let P = 0;
    if (ut > 0.55) P = 5;
    if (ut > 0.62) { const f = lin(0.62, 0.85, ut), n = 14, st = Math.floor(f * n), fr = (f * n) % 1; P = 5 + 10 * (st + ss(0, 0.4, fr)) / n; }
    if (ut >= 0.85) P = 15 - 0.06 * lin(0.85, 1, ut);
    const gr = clamp(this.R * 1.5, 16, 34), gx = px - 40 * k - gr, gyy = py - 30 * k - gr;
    g.fillStyle = '#f7fafc'; g.beginPath(); g.arc(gx, gyy, gr, 0, 7); g.fill();
    const held = ut >= 0.9;
    g.strokeStyle = held ? '#22a35a' : '#8fa4b8'; g.lineWidth = Math.max(2, gr * 0.14); g.stroke();
    const A = (v: number) => -Math.PI * 1.25 + (v / 25) * Math.PI * 1.5;
    g.strokeStyle = 'rgba(31,59,87,0.6)'; g.lineWidth = 1;
    for (let v = 0; v <= 25; v += 2.5) { const an = A(v); g.beginPath(); g.moveTo(gx + Math.cos(an) * gr * 0.66, gyy + Math.sin(an) * gr * 0.66); g.lineTo(gx + Math.cos(an) * gr * 0.82, gyy + Math.sin(an) * gr * 0.82); g.stroke(); }
    g.strokeStyle = '#ff7a1a'; g.lineWidth = Math.max(2, gr * 0.1);                    // STP mark
    g.beginPath(); g.arc(gx, gyy, gr * 0.74, A(14.5), A(15.5)); g.stroke();
    const an = A(P) + (pumping ? Math.sin(this.t * 14) * 0.015 : 0);
    g.strokeStyle = '#1f3b57'; g.lineWidth = Math.max(1.4, gr * 0.08);
    g.beginPath(); g.moveTo(gx, gyy); g.lineTo(gx + Math.cos(an) * gr * 0.72, gyy + Math.sin(an) * gr * 0.72); g.stroke();
    g.fillStyle = '#1f3b57'; g.beginPath(); g.arc(gx, gyy, gr * 0.1, 0, 7); g.fill();
    g.strokeStyle = '#7b8794'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx, gyy + gr); g.lineTo(gx, py); g.stroke();
    g.restore();
  }

  /** hydraulic excavator (facing left) — two-link inverse kinematics to the working point */
  private drawExcavator() {
    const g = this.ctx, k = this.k, gy = this.gy, xE = this.exX;
    if (xE - 110 * k > this.W + 20) return;
    const tip = this.bucketTip();
    g.save();
    // tracks
    g.fillStyle = '#2b2f33'; g.beginPath(); g.roundRect(xE - 95 * k, gy - 34 * k, 190 * k, 34 * k, 16 * k); g.fill();
    g.fillStyle = '#4b5056';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(xE - 72 * k + i * 36 * k, gy - 17 * k, 10 * k, 0, 7); g.fill(); }
    g.strokeStyle = '#1a1c1f'; g.lineWidth = 2 * k;
    const sp = 14 * k, off = ((-this.trackPh % sp) + sp) % sp;
    for (let x = xE - 90 * k + off; x < xE + 90 * k; x += sp) { g.beginPath(); g.moveTo(x, gy - 34 * k); g.lineTo(x, gy - 30 * k); g.stroke(); }
    // upper structure, counterweight, cab
    g.fillStyle = '#2b2f33'; g.fillRect(xE - 30 * k, gy - 44 * k, 60 * k, 10 * k);
    g.fillStyle = '#f2b705'; g.beginPath(); g.roundRect(xE - 75 * k, gy - 98 * k, 165 * k, 56 * k, 8 * k); g.fill();
    g.fillStyle = '#d99c00'; g.beginPath(); g.roundRect(xE + 55 * k, gy - 94 * k, 38 * k, 48 * k, 10 * k); g.fill();
    g.fillStyle = '#f2b705'; g.beginPath(); g.roundRect(xE - 75 * k, gy - 150 * k, 58 * k, 56 * k, 6 * k); g.fill();
    g.fillStyle = '#9fd3f0'; g.beginPath(); g.roundRect(xE - 70 * k, gy - 144 * k, 46 * k, 36 * k, 4 * k); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(xE - 66 * k, gy - 140 * k, 10 * k, 28 * k);
    g.fillStyle = '#2b2f33'; g.fillRect(xE + 10 * k, gy - 106 * k, 6 * k, 10 * k);       // exhaust
    // arm: boom pivot P, stick, tip T (IK)
    const Px = xE - 50 * k, Py = gy - 92 * k, L1 = 175 * k, L2 = 130 * k;
    const Tx = tip.x, Ty = tip.y - (tip.hook ? 34 * k : 0);
    let dx = Tx - Px, dy = Ty - Py, d = Math.hypot(dx, dy);
    const dc = clamp(d, Math.abs(L1 - L2) + 2, L1 + L2 - 2); dx *= dc / (d || 1); dy *= dc / (d || 1); d = dc;
    const base = Math.atan2(dy, dx), cb = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    // choose the elbow that stays up (smaller y)
    const a1 = base + cb, a2 = base - cb;
    const e1y = Py + Math.sin(a1) * L1, e2y = Py + Math.sin(a2) * L1;
    const ab = e1y < e2y ? a1 : a2;
    const Ex = Px + Math.cos(ab) * L1, Ey = Py + Math.sin(ab) * L1;
    const Sx = Px + dx, Sy = Py + dy;
    const beam = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
      const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
      g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath();
      g.fillStyle = '#f2b705'; g.fill(); g.strokeStyle = 'rgba(80,60,0,0.45)'; g.lineWidth = 1; g.stroke();
    };
    // hydraulic cylinders
    g.strokeStyle = '#9aa3ab'; g.lineWidth = 5 * k; g.lineCap = 'round';
    g.beginPath(); g.moveTo(xE - 30 * k, gy - 70 * k); g.lineTo(lerp(Px, Ex, 0.5), lerp(Py, Ey, 0.5)); g.stroke();
    beam(Px, Py, Ex, Ey, 13 * k, 9 * k);
    g.strokeStyle = '#9aa3ab'; g.lineWidth = 4 * k;
    g.beginPath(); g.moveTo(lerp(Px, Ex, 0.75), lerp(Py, Ey, 0.75) - 8 * k); g.lineTo(Ex + (Ex - Px) * 0.12, Ey + (Ey - Py) * 0.12 - 6 * k); g.stroke();
    beam(Ex, Ey, Sx, Sy, 8 * k, 6 * k);
    g.fillStyle = '#2b2f33'; for (const [x, y] of [[Px, Py], [Ex, Ey], [Sx, Sy]]) { g.beginPath(); g.arc(x, y, 4.5 * k, 0, 7); g.fill(); }
    // bucket (curled by the working phase) or lifting hook
    const sa = Math.atan2(Sy - Ey, Sx - Ex);
    g.save(); g.translate(Sx, Sy); g.rotate(sa + Math.PI / 2 + tip.curl);
    g.fillStyle = '#d99c00'; g.beginPath();
    g.moveTo(-14 * k, 0); g.lineTo(14 * k, 0); g.quadraticCurveTo(22 * k, 26 * k, 4 * k, 36 * k); g.lineTo(-16 * k, 30 * k); g.closePath(); g.fill();
    g.fillStyle = '#5b6168'; for (let i = 0; i < 3; i++) g.fillRect(-14 * k + i * 9 * k, 28 * k, 4 * k, 7 * k);   // teeth
    if (tip.dump || (this.p < 0.13 && tip.curl > 0.5)) { g.fillStyle = '#8a6844'; g.beginPath(); g.ellipse(-2 * k, 14 * k, 11 * k, 8 * k, 0, 0, 7); g.fill(); }
    g.restore();
    if (tip.hook) {
      g.strokeStyle = '#5b6168'; g.lineWidth = 2 * k; g.setLineDash([3 * k, 2 * k]);
      g.beginPath(); g.moveTo(Sx, Sy); g.lineTo(tip.x, tip.y - 6 * k); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#ff7a1a'; g.lineWidth = 3 * k;
      g.beginPath(); g.arc(tip.x, tip.y, 5 * k, -Math.PI * 0.5, Math.PI * 0.9); g.stroke();
    }
    g.restore();
  }
}
