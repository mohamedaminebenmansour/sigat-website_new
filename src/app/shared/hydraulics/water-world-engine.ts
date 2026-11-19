/**
 * SIGAT "water world" — one closed hydraulic cycle rendered behind the home-page content:
 *
 *   centrifugal pump (brand impeller in a glass volute)
 *     → glass rising main with glowing couplings → joins the logo's J-tail under water
 *       → the EXACT brand logo (artwork image) brought to life: water flows up the J,
 *         pours from the gooseneck into the ring reservoir (jet, ripples, bubbles)
 *         → the left outlet releases the logo's drop, carrying a company figure
 *           → pool impact: crater/cavity, crown sheet with rim jets, Worthington jet,
 *             capillary–gravity ripples, entrained bubble plume
 *             → each figure floats as a buoy riding the waves
 *   "SIGAT" water letters rise out of the pool letter by letter (crown splash each),
 *   stay forever, ride the waves, sparkle and catch a moving specular sheen.
 *   Company values orbit the pump like planets (3D, Kepler speeds ω ∝ R^-1.5).
 *
 * Layout comes from DOM anchors inside the section ([data-ww="logo|sigat|surface|orbit"]).
 * The canvas is viewport-sized and sticky: only the visible band is drawn each frame.
 */
import { G, Jet, Path, Seg, WaveField, buildPath, clamp, drawDrop, drawGlassPipe, rand } from './hydraulics-core';

export interface WWStat { value: string; label: string; }
export interface WWValue { title: string; icon: string; }
export interface WaterWorldOptions {
  stats: WWStat[];
  values: WWValue[];
  assetBase?: string;
  /** optional explicit URLs (e.g. data URIs) overriding assetBase */
  assetUrls?: Partial<Record<'impeller' | 'bubble' | 'logo', string>>;
  reducedMotion?: boolean;
  onFocus?: (index: number) => void;
  /** a value bubble was clicked / tapped (it stays selected until another is chosen) */
  onSelect?: (index: number) => void;
  /**
   * Picture mode: the section's CSS background is a photo (drawn at full
   * section width, top-aligned). The engine then stops painting its own sky,
   * pool body and SIGAT letters, and only animates ON the picture: caustics,
   * light rays, surface ripples, bubbles, drops, buoys and twinkling sparkles.
   * aspect = picture height / width; sparkles = [x, y] as fractions of the picture.
   */
  picture?: { aspect: number; sparkles: [number, number][] };
}

const PPM = 40;          // pixels per metre
const GPX = G * PPM;     // gravity, px/s²

/* The brand logo artwork (logo-live.webp = original image with its static drop removed).
   All coordinates are in ORIGINAL image pixels (1131 × 1600). */
const LOGO = {
  crop: { x: 40, y: 0, w: 1055, h: 1440 },   // region stored in logo-live.webp
  surf: 1360,                                 // pool surface: the J-tail dips into the water
  spout: { x: 462, y: 352 },
  water: 397,                                 // water level inside the ring
  inner: { cx: 565, cy: 362, rx: 440, ry: 262 },
  drip: { x: 463, y: 1136 },                  // left outlet — where the logo's drop forms
  tail: { x: 505, y: 1393, dx: 0.9, dy: -0.42 },
  legR: 36,
  sparks: [[250, 118], [168, 232], [905, 112], [420, 58], [1000, 300]] as [number, number][],
};
const J_LINE: [number, number][] = [[505, 1395], [600, 1325], [690, 1215], [760, 1050], [775, 900], [765, 750], [745, 600], [720, 480], [690, 330], [640, 250], [580, 232], [520, 252], [480, 300], [462, 350]];
const LEFT_LINE: [number, number][] = [[463, 1120], [440, 980], [415, 800], [400, 650], [395, 560]];
const MID_LINE: [number, number][] = [[575, 1120], [575, 700]];

interface Box { x: number; y: number; w: number; h: number; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; life: number; }
interface Bubble { x: number; y: number; r: number; ph: number; }
interface Ring { x: number; t: number; amp: number; }
interface Column { x: number; t: number; T: number; H: number; w: number; shed: boolean; }
interface Crown { x: number; t: number; T: number; R: number; H: number; n: number; seed: number; shed: boolean; }
interface Cavity { x: number; t: number; T: number; R: number; }
interface Buoy { i: number; x: number; y: number; vx: number; vy: number; ang: number; slot: number; sink: boolean; born: number; }
interface Letter { ch: string; x: number; w: number; sprite: HTMLCanvasElement | null; pad: number; at: number; sparkT: number; sx: number; sy: number; }
interface NumDrop { i: number; phase: 'grow' | 'fall'; t: number; x: number; y: number; vy: number; r: number; }
interface Tracer { line: 0 | 1 | 2; s: number; o: number; r: number; }

export class WaterWorldEngine {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1; private cw = 0; private ch = 0;
  private W = 1; private Hs = 1; private vy = 0;
  private running = false; private raf = 0; private last = 0; private t = 0;

  // layout
  private surfY = 400;
  private logoS = 0.4; private lx = 0; private ly = 0;
  private sigatBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private orbitBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private P = { x: 0, y: 0 }; private Rp = 60;
  private pipeR = 12;
  private main!: Path; private mainRings: number[] = [];
  private lines: Path[] = [];

  // physics
  private pool = new WaveField(160, PPM);
  private poolEta = new Float32Array(2);
  private jet = new Jet(0.6, GPX);
  private particles: Particle[] = [];
  private bubbles: Bubble[] = [];
  private ringBubbles: Bubble[] = [];
  private ringRipples: { x: number; t: number }[] = [];
  private tracers: Tracer[] = [];
  private ripples: Ring[] = [];
  private columns: Column[] = [];
  private crowns: Crown[] = [];
  private cavities: Cavity[] = [];
  private buoys: Buoy[] = [];
  private drop: NumDrop | null = null;
  private nextDropAt = 0.8; private nextIndex = 0;
  private letters: Letter[] = []; private lettersStarted = false; private letterFs = 100; private letterBase = 0;
  private sheenT = 0;
  private logoSpark = { t: -9, k: 0 };
  private swirl: { a: number; r: number; }[] = [];
  private hover = -1; private focus = -1; private pinned = -1;
  private logoBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private picBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private pointerX = -1; private pointerY = -1;

  // assets
  private imgImpeller = new Image(); private imgBubble = new Image(); private imgLogo = new Image();
  private caustA?: HTMLCanvasElement; private caustB?: HTMLCanvasElement;
  private scratch = document.createElement('canvas');

  constructor(private section: HTMLElement, private canvas: HTMLCanvasElement, private opts: WaterWorldOptions) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D not supported');
    this.ctx = c;
    const base = opts.assetBase ?? 'assets/brand/';
    const u = opts.assetUrls ?? {};
    this.imgImpeller.src = u.impeller ?? base + 'impeller.webp';
    this.imgBubble.src = u.bubble ?? base + 'bubble.webp';
    this.imgLogo.src = u.logo ?? base + 'logo-live.webp';
    for (const im of [this.imgImpeller, this.imgBubble, this.imgLogo]) im.onload = () => { if (!this.running) this.draw(); };
    this.caustA = this.buildCaustic(7); this.caustB = this.buildCaustic(13);
    for (let i = 0; i < 70; i++) this.swirl.push({ a: Math.random() * Math.PI * 2, r: Math.random() });
    for (let i = 0; i < 46; i++) this.tracers.push({ line: (i % 3) as 0 | 1 | 2, s: Math.random(), o: rand(-0.6, 0.6), r: rand(0.8, 2.4) });
    section.addEventListener('pointermove', this.onPointer);
    section.addEventListener('pointerleave', this.onLeave);
    section.addEventListener('pointerdown', this.onPointer);
    this.layout();
    if (opts.reducedMotion) {
      this.letters.forEach(l => (l.at = -10));
      for (let i = 0; i < this.opts.stats.length; i++) this.spawnBuoy(i, true);
      this.lettersStarted = true;
    }
  }

  /* ================================================================ API */
  start() {
    if (this.running || this.opts.reducedMotion) { this.draw(); return; }
    this.running = true; this.last = performance.now();
    if (!this.lettersStarted) { this.lettersStarted = true; this.letters.forEach((l, i) => (l.at = this.t + 0.5 + i * 0.6)); }
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    this.stop();
    this.section.removeEventListener('pointermove', this.onPointer);
    this.section.removeEventListener('pointerleave', this.onLeave);
    this.section.removeEventListener('pointerdown', this.onPointer);
  }
  renderOnce() { this.draw(); }
  /** select (pin) a value — from a click on its bubble or from an outside control */
  select(i: number) {
    this.pinned = i;
    this.opts.onSelect?.(i);
    if (i !== this.focus) { this.focus = i; this.opts.onFocus?.(i); }
    if (!this.running) this.draw();
  }
  setContent(stats: WWStat[], values: WWValue[]) {
    this.opts.stats = stats; this.opts.values = values;
    if (!this.running) this.draw();
  }

  /** read DOM anchors and rebuild geometry (call on resize / font load) */
  layout() {
    const sr = this.section.getBoundingClientRect();
    const box = (name: string): Box => {
      const el = this.section.querySelector<HTMLElement>(`[data-ww="${name}"]`);
      if (!el) return { x: 0, y: 0, w: 0, h: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };
    this.W = Math.max(1, sr.width); this.Hs = Math.max(1, this.section.offsetHeight);
    const logo = box('logo'); this.logoBox = logo; this.picBox = box('picture'); this.sigatBox = box('sigat'); this.orbitBox = box('orbit');
    this.surfY = box('surface').y;

    // canvas = viewport band
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.cw = this.W; this.ch = Math.min(window.innerHeight, this.Hs);
    this.canvas.style.height = this.ch + 'px';
    const pw = Math.round(this.cw * this.dpr), ph = Math.round(this.ch * this.dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }

    // logo placement: the J-tail dips into the pool at LOGO.surf
    const C = LOGO.crop;
    const s = Math.max(0.1, Math.min(logo.w / C.w, (this.surfY - logo.y) / (LOGO.surf - C.y)));
    this.logoS = s;
    this.lx = logo.x + (logo.w - C.w * s) / 2 - C.x * s;
    this.ly = this.surfY - LOGO.surf * s;
    this.pipeR = Math.max(5, LOGO.legR * s);
    const poly = (pts: [number, number][]) => {
      const [x0, y0] = this.M(pts[0][0], pts[0][1]);
      return buildPath(x0, y0, pts.slice(1).map(p => ['L', ...this.M(p[0], p[1])] as Seg));
    };
    this.lines = [poly(J_LINE), poly(LEFT_LINE), poly(MID_LINE)];

    // pump at the centre of the orbit system
    const ob = this.orbitBox;
    this.P = { x: ob.x + ob.w / 2, y: ob.y + ob.h / 2 };
    this.Rp = clamp(Math.min(ob.w, ob.h) * 0.16, 34, 96);
    const Rout = this.Rp * 1.24;
    const N = { x: this.P.x - this.Rp * 0.75, y: this.P.y - Rout + this.pipeR + 2 };

    // rising main: pump nozzle → riser → joins the logo's J-tail under water (tangent-continuous)
    const [tx, ty] = this.M(LOGO.tail.x, LOGO.tail.y);
    const k = Math.max(30, 90 * s);
    const Xv = tx - LOGO.tail.dx * k * 0.8;
    const yA = ty + Math.max(40, 120 * s);
    const segs: Seg[] = [];
    // picture mode: run along the left edge (clear of the centred headings),
    // then across under the logo, then up into the J — like a laid pipeline
    // with long-radius bends.
    const xL = this.W * 0.08, Rb = 36, yTurn = yA + Rb + 12;
    if (this.opts.picture && Xv > xL + Rb * 2 && N.x > xL + Rb * 2 && N.y - Rb > yTurn + Rb) {
      segs.push(['L', xL + Rb, N.y], ['Q', xL, N.y, xL, N.y - Rb], ['L', xL, yTurn + Rb], ['Q', xL, yTurn, xL + Rb, yTurn],
        ['L', Xv - Rb, yTurn], ['Q', Xv, yTurn, Xv, yTurn - Rb]);
    } else if (Math.abs(N.x - Xv) > 24) {
      const dir = Xv < N.x ? -1 : 1;
      const R = Math.max(8, Math.min(40, Math.abs(N.x - Xv) / 2));
      segs.push(['L', Xv - dir * R, N.y], ['Q', Xv, N.y, Xv, N.y - R]);
    }
    segs.push(['L', Xv, yA], ['C', Xv, yA - k, tx - LOGO.tail.dx * k, ty - LOGO.tail.dy * k, tx, ty]);
    this.main = buildPath(N.x, N.y, segs, 2);
    this.mainRings = [];
    for (let q = 50; q < this.main.length - 60; q += 150) this.mainRings.push(q);
    this.mainRings.push(this.main.length - 4); // coupling (manchette) where the main meets the logo

    // waves
    this.pool.L = this.W / PPM;
    this.pool.depth = Math.min(12, (this.Hs - this.surfY) / PPM);
    this.poolEta = new Float32Array(Math.max(40, Math.round(this.W / 5)) + 1);

    this.buildLetters();
    if (!this.running) this.draw();
  }

  /* ================================================================ helpers */
  private M(x: number, y: number): [number, number] { return [this.lx + x * this.logoS, this.ly + y * this.logoS]; }
  private surfaceAt(x: number) {
    const N = this.poolEta.length - 1;
    const f = clamp(x / this.W, 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return this.surfY + (this.poolEta[i] + (this.poolEta[i + 1] - this.poolEta[i]) * (f - i)) * PPM;
  }
  private slopeAt(x: number) { return (this.surfaceAt(x + 6) - this.surfaceAt(x - 6)) / 12; }
  private dropTip() { const [x, y] = this.M(LOGO.drip.x, LOGO.drip.y); return { x, y }; }
  private dropRadius() { return clamp(30 * this.logoS / 0.4, 16, 32); }
  private buoyRadius() { return clamp(this.dropRadius() * 1.3, 22, 44); }

  private slotX(slot: number): number {
    const n = Math.max(1, this.opts.stats.length);
    const impact = this.dropTip().x;
    const Rb = this.buoyRadius();
    const narrow = this.W < 700;
    // picture mode: figures float in the picture's splash, left of the logo lockup
    const pictureRight = this.opts.picture && this.logoBox.x > this.W * 0.25 ? this.logoBox.x - Rb * 0.6 : 0;
    const right = pictureRight || (!narrow && this.sigatBox.x > this.W * 0.4 ? this.sigatBox.x - Rb : this.W - Rb * 1.3);
    const left = narrow ? Rb * 1.3 : Math.max(Rb * 1.4, 84);
    const xs: number[] = [];
    for (let i = 0; i < n + 1; i++) xs.push(left + (right - left) * (i / n));
    let worst = 0; // keep the drip's impact point free
    xs.forEach((x, i) => { if (Math.abs(x - impact) < Math.abs(xs[worst] - impact)) worst = i; });
    xs.splice(worst, 1);
    return xs[slot % xs.length];
  }

  private buildCaustic(seed: number): HTMLCanvasElement {
    // tileable Worley-noise (F2−F1) network, softened: refracted sunlight on a pool floor
    const S = 256, cells = 6;
    let st = seed;
    const rnd = () => ((st = (st * 16807) % 2147483647) / 2147483647);
    const pts: number[][] = [];
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + rnd()) / cells, (j + rnd()) / cells]);
    const raw = document.createElement('canvas'); raw.width = S; raw.height = S;
    const g = raw.getContext('2d')!; const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S; let f1 = 9, f2 = 9;
      for (const p of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const d = Math.hypot(u - p[0] - ox, v - p[1] - oy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const e = Math.exp(-(f2 - f1) * cells * 11);
      const k = (y * S + x) * 4;
      img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = e * 255;
    }
    g.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g2 = c.getContext('2d')!;
    g2.filter = 'blur(1.4px)';
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g2.drawImage(raw, ox, oy); // wrap-around blur
    return c;
  }

  private buildLetters() {
    const word = 'SIGAT';
    const b = this.sigatBox;
    if (b.w < 10 || this.opts.picture) { this.letters = []; return; }
    const meas = document.createElement('canvas').getContext('2d')!;
    let fs = Math.min(b.h * 0.85, 200);
    const font = (f: number) => `900 ${f}px "Arial Rounded MT Bold", "Varela Round", "Nunito", Arial, sans-serif`;
    meas.font = font(fs);
    let total = meas.measureText(word).width + fs * 0.08 * (word.length - 1);
    if (total > b.w * 0.94) { fs *= (b.w * 0.94) / total; meas.font = font(fs); total = meas.measureText(word).width + fs * 0.08 * (word.length - 1); }
    this.letterFs = fs;
    this.letterBase = this.surfY + fs * 0.04;
    let x = b.x + (b.w - total) / 2;
    const old = this.letters;
    this.letters = [];
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const w = meas.measureText(ch).width;
      const { c, pad } = this.letterSprite(ch, fs, font(fs));
      this.letters.push({ ch, x, w, sprite: c, pad, at: old[i]?.at ?? 1e9, sparkT: 0, sx: 0, sy: 0 });
      x += w + fs * 0.08;
    }
  }

  /** clear glass letter filled with water: pale body, deep-blue water pockets with white rims, air bubbles */
  private letterSprite(ch: string, fs: number, font: string) {
    const pad = Math.ceil(fs * 0.12);
    const c = document.createElement('canvas');
    const g0 = c.getContext('2d')!; g0.font = font;
    const w = Math.ceil(g0.measureText(ch).width) + pad * 2, h = Math.ceil(fs * 1.02) + pad * 2;
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.font = font; g.textBaseline = 'alphabetic';
    const bx = pad, by = h - pad - fs * 0.02;
    const lg = g.createLinearGradient(0, pad, 0, h - pad);
    lg.addColorStop(0, 'rgba(245,253,255,0.93)'); lg.addColorStop(0.5, 'rgba(178,228,252,0.82)'); lg.addColorStop(1, 'rgba(110,190,245,0.88)');
    g.fillStyle = lg; g.fillText(ch, bx, by);
    g.globalCompositeOperation = 'source-atop';
    let seed = ch.charCodeAt(0) * 97 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) { // deep-blue water pockets with bright rims (brand water lettering)
      const x = rnd() * w, y = rnd() * h, r = fs * (0.035 + rnd() * 0.075);
      const rot = rnd() * 3, sq = 0.55 + rnd() * 0.6;
      g.fillStyle = `rgba(20,75,210,${0.45 + rnd() * 0.35})`;
      g.beginPath(); g.ellipse(x, y, r, r * sq, rot, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, fs * 0.008);
      g.beginPath(); g.ellipse(x, y, r, r * sq, rot, Math.PI * 1.05, Math.PI * 1.65); g.stroke();
    }
    for (let i = 0; i < 30; i++) { // trapped air bubbles
      const x = rnd() * w, y = rnd() * h, r = fs * (0.01 + rnd() * 0.03);
      const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.6, 'rgba(200,240,255,0.5)'); rg.addColorStop(1, 'rgba(40,120,220,0.7)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const hg = g.createLinearGradient(0, 0, w, h);
    hg.addColorStop(0, 'rgba(255,255,255,0.6)'); hg.addColorStop(0.3, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1.5, fs * 0.024); g.strokeText(ch, bx, by);
    g.strokeStyle = 'rgba(25,95,200,0.6)'; g.lineWidth = Math.max(1, fs * 0.008); g.strokeText(ch, bx, by);
    return { c, pad };
  }

  /* ================================================================ pointer */
  private onPointer = (e: PointerEvent) => {
    const r = this.section.getBoundingClientRect();
    this.pointerX = e.clientX - r.left; this.pointerY = e.clientY - r.top;
    if (e.type === 'pointerdown') {
      for (let i = 0; i < this.opts.values.length; i++) {
        const p = this.planet(i);
        if (Math.hypot(this.pointerX - p.x, this.pointerY - p.y) < p.pr) { this.select(i); break; }
      }
    }
    const ys = this.surfaceAt(this.pointerX);
    if (Math.abs(this.pointerY - ys) < 28) {
      this.pool.kick(this.pointerX / PPM, e.type === 'pointerdown' ? -0.5 : -0.06, 0.4);
      if (e.type === 'pointerdown') { this.ripples.push({ x: this.pointerX, t: 0, amp: 0.7 }); this.crown(this.pointerX, 10, 26); }
    }
  };
  private onLeave = () => { this.pointerX = -1; this.pointerY = -1; };

  /* ================================================================ simulation */
  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private spawnBuoy(i: number, settled = false) {
    const Rb = this.buoyRadius();
    const x = settled ? this.slotX(i) : this.dropTip().x;
    this.buoys = this.buoys.filter(b => b.i !== i || b.sink);
    this.buoys.push({ i, x, y: settled ? this.surfY - Rb * 0.25 : this.surfY + Rb * 1.6, vx: 0, vy: settled ? 0 : -40, ang: 0, slot: i, sink: false, born: this.t });
  }

  /** crown sheet (Edgerton crown) thrown up by an impact */
  private crown(x: number, R: number, H: number) {
    this.crowns.push({ x, t: 0, T: 0.8, R, H, n: 14 + (Math.random() * 6 | 0), seed: Math.random() * 100, shed: false });
  }

  /** drop impact on the pool: cavity, crown, Worthington jet, ripples, bubble plume */
  private splash(x: number, v: number, r: number) {
    const vm = v / PPM;
    const power = clamp(vm / 4.5, 0.6, 1.6);
    this.pool.kick(x / PPM, -0.09 * vm * (r / 20), (r * 1.8) / PPM);
    this.cavities.push({ x, t: 0, T: 0.42, R: r * 1.5 * power });
    this.crown(x, r * 1.05, r * 2.6 * power);
    for (let k = 0; k < 26; k++) { // spray from the crown rim
      const a = -Math.PI / 2 + (k / 25 - 0.5) * 2.4 + rand(-0.1, 0.1);
      const sp = rand(0.45, 1) * v * 0.6;
      this.particles.push({ x: x + Math.cos(a) * r * 0.8, y: this.surfY - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.2, 3.4) * (r / 24), life: 2 });
    }
    // Worthington jet rises when the cavity collapses (~0.3 s later)
    this.columns.push({ x, t: -0.3, T: 0.6, H: r * 3 * power, w: r * 0.6, shed: false });
    this.ripples.push({ x, t: 0, amp: 1.2 });
    // entrained-air plume trailing down-and-away (like a real plunging drop)
    for (let k = 0; k < 60; k++) {
      const d = Math.pow(Math.random(), 0.7) * r * 7 * power;
      this.bubbles.push({ x: x + rand(-r, r) * 0.8 - d * 0.35, y: this.surfY + 6 + d, r: rand(0.8, 4.2) * (1 - d / (r * 9)), ph: Math.random() * 6 });
    }
  }

  private step(dt: number) {
    this.t += dt;
    const t = this.t;
    const s = this.logoS;

    // --- gooseneck jet into the ring reservoir (pump-driven)
    const [sx, sy] = this.M(LOGO.spout.x, LOGO.spout.y);
    const vEx = 1.3 * PPM;
    this.jet.emit(true, sx, sy, -0.05 * vEx, vEx, 22 * s);
    const [, wy] = this.M(0, LOGO.water);
    this.jet.update(dt, sl => {
      if (sl.y < wy) return false;
      if (Math.random() < 0.25) this.ringRipples.push({ x: sl.x, t: 0 });
      for (let k = 0; k < 2; k++) if (Math.random() < 0.7) this.ringBubbles.push({ x: sl.x + rand(-6, 6) * s / 0.4, y: wy + rand(4, 40) * s / 0.4, r: rand(0.7, 2.3), ph: Math.random() * 6 });
      if (Math.random() < 0.3) this.particles.push({ x: sl.x, y: wy - 1, vx: rand(-40, 40), vy: -rand(30, 90), r: rand(0.8, 1.8), life: 0.8 });
      return true;
    }, this.Hs);
    for (const r of this.ringRipples) r.t += dt;
    this.ringRipples = this.ringRipples.filter(r => r.t < 1.4).slice(-40);
    const inner = LOGO.inner;
    const [icx, icy] = this.M(inner.cx, inner.cy);
    for (const b of this.ringBubbles) { b.y -= (14 + b.r * 9) * dt; b.ph += dt * 6; b.x += Math.sin(b.ph) * b.r * 5 * dt; }
    this.ringBubbles = this.ringBubbles.filter(b => b.y > wy + 1 && ((b.x - icx) / (inner.rx * s)) ** 2 + ((b.y - icy) / (inner.ry * s)) ** 2 < 1).slice(-160);
    if (Math.random() < dt * 8) this.ringBubbles.push({ x: icx + rand(-0.8, 0.8) * inner.rx * s, y: icy + inner.ry * s * rand(0.3, 0.85), r: rand(0.6, 1.8), ph: 0 });

    // --- water moving inside the logo pipes (bubble tracers)
    for (const tr of this.tracers) {
      const p = this.lines[tr.line];
      const v = tr.line === 0 ? 70 : 22; // J carries the pumped flow; legs: slow rising bubbles
      tr.s += (v * dt) / Math.max(1, p.length);
      if (tr.s > 1) { tr.s -= 1; tr.o = rand(-0.6, 0.6); }
    }

    // --- logo glint
    if (t - this.logoSpark.t > rand(2.2, 4)) { this.logoSpark.t = t; this.logoSpark.k = (Math.random() * LOGO.sparks.length) | 0; }

    // --- numbered drops from the left outlet (the logo's drop)
    const nStats = this.opts.stats.length;
    if (!this.drop && nStats && t >= this.nextDropAt) {
      const tip = this.dropTip();
      const i = this.nextIndex % nStats;
      this.buoys.forEach(b => { if (b.i === i) b.sink = true; });
      this.drop = { i, phase: 'grow', t: 0, x: tip.x, y: tip.y, vy: 0, r: 2 };
    }
    if (this.drop) {
      const d = this.drop, Rd = this.dropRadius();
      d.t += dt;
      if (d.phase === 'grow') {
        // pendant drop swelling until its weight beats surface tension at the rim (Tate's law) → pinch-off
        const f = clamp(d.t / 1.7, 0, 1);
        d.r = Rd * (0.15 + 0.85 * (1 - Math.pow(1 - f, 2)));
        const tip = this.dropTip(); d.x = tip.x; d.y = tip.y + d.r * 1.25 + 1;
        if (f >= 1) { d.phase = 'fall'; d.t = 0; d.vy = 30; }
      } else {
        d.vy += GPX * dt; d.y += d.vy * dt;
        if (d.y + d.r * 0.7 >= this.surfaceAt(d.x)) {
          this.splash(d.x, Math.max(d.vy, 4.5 * PPM), d.r);
          this.spawnBuoy(d.i);
          this.drop = null;
          this.nextIndex++;
          const settledAll = this.buoys.filter(b => !b.sink).length >= nStats;
          this.nextDropAt = t + (settledAll && this.nextIndex % nStats === 0 ? 7 : 1.4);
        }
      }
    }

    // --- pool waves
    if (Math.random() < dt * 5) this.pool.kick(Math.random() * this.pool.L, rand(-0.015, 0.015), 0.5);
    this.pool.step(dt); this.pool.sample(this.poolEta);

    // --- buoys: buoyancy spring to the free surface + wave-slope drift
    const Rb = this.buoyRadius();
    for (const b of this.buoys) {
      const target = b.sink ? this.surfY + Rb * 5 : this.surfaceAt(b.x) - Rb * 0.28;
      b.vy += ((target - b.y) * (b.sink ? 6 : 42) - b.vy * 4.2) * dt;
      b.y += b.vy * dt;
      const slope = this.slopeAt(b.x);
      b.vx += ((this.slotX(b.slot) - b.x) * 0.9 - b.vx * 1.4 - slope * GPX * 0.12) * dt;
      b.x += b.vx * dt;
      b.ang += (Math.atan(slope) * 0.9 - b.ang) * Math.min(1, dt * 6);
      if (!b.sink && Math.random() < dt * 0.6) this.bubbles.push({ x: b.x + rand(-Rb, Rb) * 0.6, y: b.y + Rb, r: rand(0.8, 1.8), ph: 0 });
    }
    this.buoys = this.buoys.filter(b => !(b.sink && b.y > this.surfY + Rb * 4.5));

    // --- splash particles, crowns, cavities, Worthington columns, ripples
    for (const p of this.particles) { p.vy += GPX * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter(p => {
      if (p.life <= 0) return false;
      if (p.vy > 0 && p.y > this.surfaceAt(p.x) && p.y < this.surfY + 60) { this.pool.kick(p.x / PPM, -0.006 * p.r, 0.06); return false; }
      return true;
    });
    for (const c of this.crowns) {
      c.t += dt;
      if (!c.shed && c.t > c.T * 0.42) { // rim fingers (Rayleigh–Plateau) pinch off into droplets
        c.shed = true;
        const rad = this.crownRadius(c);
        for (let k = 0; k < c.n; k++) {
          const a = (k / c.n) * Math.PI * 2;
          const h = this.crownHeight(c);
          this.particles.push({ x: c.x + Math.cos(a) * rad, y: this.surfY + Math.sin(a) * rad * 0.22 - h * 1.15, vx: Math.cos(a) * rand(40, 110), vy: -rand(40, 140), r: rand(1.2, 2.6), life: 2 });
        }
      }
    }
    this.crowns = this.crowns.filter(c => c.t < c.T);
    for (const c of this.cavities) c.t += dt;
    this.cavities = this.cavities.filter(c => c.t < c.T);
    for (const c of this.columns) {
      c.t += dt;
      if (!c.shed && c.t > c.T * 0.5) {
        c.shed = true;
        this.particles.push({ x: c.x, y: this.surfY - c.H * 0.98, vx: rand(-10, 10), vy: -c.H * 1.2, r: c.w * 0.55, life: 3 });
      }
    }
    this.columns = this.columns.filter(c => c.t < c.T);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 3.2);

    // --- bubbles (terminal velocity ~ radius) with zig-zag
    for (const bb of this.bubbles) { bb.y -= (20 + bb.r * 10) * dt; bb.ph += dt * (5 + bb.r); bb.x += Math.sin(bb.ph) * bb.r * 6 * dt; }
    this.bubbles = this.bubbles.filter(bb => {
      if (bb.y - bb.r > this.surfaceAt(bb.x) + 1) return true;
      if (Math.abs(bb.y - this.surfY) < 40) this.pool.kick(bb.x / PPM, 0.002 * bb.r, 0.05);
      return false;
    });
    if (Math.random() < dt * 6) this.bubbles.push({ x: this.P.x + rand(-this.Rp, this.Rp) * 0.4, y: this.P.y - this.Rp * 0.2, r: rand(1, 3), ph: 0 });
    if (Math.random() < dt * 3) this.bubbles.push({ x: Math.random() * this.W, y: Math.min(this.Hs - 10, this.vy + this.ch + 20), r: rand(1, 4), ph: 0 });
    if (this.bubbles.length > 600) this.bubbles.splice(0, this.bubbles.length - 600);

    // --- pump swirl particles
    for (const p of this.swirl) { p.a -= dt * (2.2 + 1.5 * (1 - p.r)); p.r += dt * 0.35; if (p.r > 1) { p.r = 0; p.a = Math.random() * 7; } }

    // --- letters: emergence crowns, sparkles, travelling sheen
    for (const l of this.letters) {
      const age = t - l.at;
      if (age >= 0 && age - dt < 0) { // letter starts to rise: crown splash + ripples
        const cx = l.x + l.w / 2;
        this.crown(cx, l.w * 0.32, this.letterFs * 0.35);
        this.ripples.push({ x: cx, t: 0, amp: 0.8 });
        this.pool.kick(cx / PPM, -0.3, l.w / PPM);
      }
      if (age > 1 && t > l.sparkT + rand(1.2, 3.2)) { l.sparkT = t; l.sx = rand(0.15, 0.85); l.sy = rand(0.1, 0.7); }
    }
    if (this.letters.length && t > this.letters[this.letters.length - 1].at + 1.2 && t - this.sheenT > 6.5) this.sheenT = t;

    // --- value focus (hovered planet, else the one nearest the viewer)
    const front = this.frontPlanet(); // also refreshes this.hover from the pointer
    const f = this.hover >= 0 ? this.hover : this.pinned >= 0 ? this.pinned : front;
    if (f !== this.focus) { this.focus = f; this.opts.onFocus?.(f); }
  }

  private crownRadius(c: Crown) { const u = c.t / c.T; return c.R + c.R * 1.9 * (1 - (1 - u) ** 2); }
  private crownHeight(c: Crown) { const u = c.t / c.T; return c.H * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.8); }

  /* ================================================================ orbits */
  private planet(i: number) {
    const n = Math.max(1, this.opts.values.length);
    const ob = this.orbitBox;
    const pr0 = clamp(this.Rp * 0.68, 30, 70);
    const r0 = this.Rp * 1.9 + pr0 * 0.4;
    const rMax = Math.max(r0 + 10, ob.w / 2 - pr0 * 1.05);
    const R = n > 1 ? r0 + (rMax - r0) * (i / (n - 1)) : r0;
    const q = clamp(ob.h / ob.w * 0.62, 0.26, 0.5);
    const om = 0.3 * Math.pow(r0 / R, 1.5); // Kepler's third law
    const th = i * 2.1 + 0.6 + (this.opts.reducedMotion ? 0 : this.t * om);
    const tilt = (i - (n - 1) / 2) * 0.05;
    const ex = R * Math.cos(th), ey = R * Math.sin(th) * q;
    const x = this.P.x + ex * Math.cos(tilt) - ey * Math.sin(tilt);
    const y = this.P.y + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    const d = Math.sin(th);
    const scale = (1 + 0.2 * d) * (this.hover === i ? 1.15 : 1);
    return { x, y, d, R, q, tilt, pr: pr0 * scale };
  }
  private frontPlanet() {
    let best = 0, bd = -9;
    for (let i = 0; i < this.opts.values.length; i++) { const p = this.planet(i); if (p.d > bd) { bd = p.d; best = i; } }
    if (this.pointerX >= 0) {
      let h = -1;
      for (let i = 0; i < this.opts.values.length; i++) { const p = this.planet(i); if (Math.hypot(this.pointerX - p.x, this.pointerY - p.y) < p.pr) h = i; }
      this.hover = h;
      this.section.style.cursor = h >= 0 ? 'pointer' : '';
      if (h >= 0) return h;
    } else this.hover = -1;
    return best;
  }

  /* ================================================================ rendering */
  private visible(y0: number, y1: number) { return y1 >= this.vy - 20 && y0 <= this.vy + this.ch + 20; }

  private draw() {
    const sr = this.section.getBoundingClientRect();
    this.vy = clamp(-sr.top, 0, Math.max(0, this.Hs - this.ch));
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, -this.vy * this.dpr);
    const v0 = this.vy, v1 = this.vy + this.ch;

    this.drawSkyAndWater(ctx, v0, v1);
    if (v1 > this.surfY) {
      this.drawOrbitTrails(ctx, true);
      this.drawPlanets(ctx, false);
      drawGlassPipe(ctx, this.main, { r: this.pipeR, flow: 2.2 * PPM, t: this.t, rings: this.mainRings });
      this.drawPump(ctx);
      this.drawOrbitTrails(ctx, false);
      this.drawPlanets(ctx, true);
      this.drawCavities(ctx);
      this.drawBubbles(ctx, false);
      this.drawCaustics(ctx, v0, Math.min(v1, this.surfY + 700), 0.07);
    }
    this.drawLetterReflections(ctx);
    if (this.visible(this.ly, this.surfY + 60)) this.drawLogo(ctx);
    this.drawSurface(ctx);
    this.drawCrowns(ctx, true);
    this.drawLetters(ctx);
    this.drawBuoys(ctx);
    this.drawCrowns(ctx, false);
    this.drawSplash(ctx);
    this.drawNumberedDrop(ctx);
    this.drawPictureSparkles(ctx);
  }

  private drawSkyAndWater(ctx: CanvasRenderingContext2D, v0: number, v1: number) {
    if (this.opts.picture) { this.drawOverPicture(ctx, v0, v1); return; }
    const W = this.W, s = this.logoS;
    if (v0 < this.surfY) {
      // aqua "all water" backdrop, matching the logo artwork's radial light
      const g = ctx.createLinearGradient(0, 0, 0, this.surfY);
      g.addColorStop(0, '#7fcdf7'); g.addColorStop(0.55, '#a4dcf8'); g.addColorStop(1, '#c4eafb');
      ctx.fillStyle = g; ctx.fillRect(0, v0, W, Math.min(v1, this.surfY + 30) - v0);
      const [bx, by] = this.M(565, 800);
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, 720 * s);
      rg.addColorStop(0, 'rgb(232,246,250)'); rg.addColorStop(0.45, 'rgba(214,242,253,0.95)'); rg.addColorStop(0.8, 'rgba(165,224,252,0.55)'); rg.addColorStop(1, 'rgba(150,220,252,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, v0, W, Math.min(v1, this.surfY) - v0);
      this.drawCaustics(ctx, v0, Math.min(v1, this.surfY), 0.1, true);
    }
    if (v1 > this.surfY) {
      const N = this.poolEta.length - 1;
      ctx.beginPath(); ctx.moveTo(0, this.surfaceAt(0));
      for (let i = 1; i <= N; i++) ctx.lineTo((i / N) * W, this.surfY + this.poolEta[i] * PPM);
      ctx.lineTo(W, this.Hs); ctx.lineTo(0, this.Hs); ctx.closePath();
      const g = ctx.createLinearGradient(0, this.surfY, 0, this.Hs);
      g.addColorStop(0, '#bdeafb'); g.addColorStop(0.06, '#8ed6f6'); g.addColorStop(0.4, '#6cc4f1'); g.addColorStop(1, '#45a2e4');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        const x = (k + 0.5) * W / 7 + Math.sin(this.t * 0.35 + k * 1.3) * 40;
        const len = Math.min(this.Hs - this.surfY, 900);
        const gr = ctx.createLinearGradient(0, this.surfY, 0, this.surfY + len);
        gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(x - 18, this.surfY); ctx.lineTo(x + 26, this.surfY); ctx.lineTo(x - 60, this.surfY + len); ctx.lineTo(x - 150, this.surfY + len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      this.drawCaustics(ctx, Math.max(v0, this.surfY), v1, 0.2);
      this.drawBubbles(ctx, true);
    }
  }

  /** picture mode: only light that moves — the photo itself is the water */
  private drawOverPicture(ctx: CanvasRenderingContext2D, v0: number, v1: number) {
    if (v0 < this.surfY) this.drawCaustics(ctx, v0, Math.min(v1, this.surfY), 0.07, true);
    if (v1 > this.surfY) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        const x = (k + 0.5) * this.W / 7 + Math.sin(this.t * 0.35 + k * 1.3) * 40;
        const len = Math.min(this.Hs - this.surfY, 900);
        const gr = ctx.createLinearGradient(0, this.surfY, 0, this.surfY + len);
        gr.addColorStop(0, `rgba(255,255,255,${0.12 + 0.05 * Math.sin(this.t * 0.8 + k)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(x - 18, this.surfY); ctx.lineTo(x + 26, this.surfY); ctx.lineTo(x - 60, this.surfY + len); ctx.lineTo(x - 150, this.surfY + len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      this.drawCaustics(ctx, Math.max(v0, this.surfY), v1, 0.13);
      this.drawBubbles(ctx, true);
    }
  }

  /** twinkling lens-flare sparkles on the picture's crystal letters */
  private drawPictureSparkles(ctx: CanvasRenderingContext2D) {
    const pic = this.opts.picture;
    if (!pic) return;
    const pb = this.picBox.w ? this.picBox : { x: 0, y: 0, w: this.W, h: this.W * pic.aspect };
    pic.sparkles.forEach(([fx, fy], i) => {
      const ph = this.t * (1.1 + (i % 3) * 0.35) + i * 2.3;
      const a = Math.max(0, Math.sin(ph));
      if (a < 0.05) return;
      const r = clamp(pb.w * 0.012, 6, 16) * (0.6 + 0.6 * a);
      this.star(ctx, pb.x + fx * pb.w, pb.y + fy * pb.h, r, a * 0.95);
    });
  }

  private drawCaustics(ctx: CanvasRenderingContext2D, y0: number, y1: number, alpha: number, sky = false) {
    if (!this.caustA || !this.caustB || y1 <= y0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, this.W, y1 - y0); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const S = 256 * (sky ? 2.4 : 1.7);
    const draw = (img: HTMLCanvasElement, ox: number, oy: number, a: number) => {
      ctx.globalAlpha = a;
      const sx = ((ox % S) + S) % S - S, sy = ((oy % S) + S) % S - S;
      for (let y = Math.floor((y0 - sy) / S) * S + sy; y < y1; y += S)
        for (let x = sx; x < this.W; x += S) ctx.drawImage(img, x, y, S, S);
    };
    draw(this.caustA, this.t * 9, this.t * 5, alpha * (0.55 + 0.25 * Math.sin(this.t * 0.7)));
    draw(this.caustB, -this.t * 7, this.t * 8, alpha * (0.55 + 0.25 * Math.cos(this.t * 0.6)));
    ctx.restore();
  }

  private drawBubbles(ctx: CanvasRenderingContext2D, back: boolean) {
    for (const bb of this.bubbles) {
      if ((bb.r < 2) !== back) continue;
      if (bb.y < this.vy - 10 || bb.y > this.vy + this.ch + 10) continue;
      ctx.beginPath(); ctx.arc(bb.x, bb.y, Math.max(0.5, bb.r), 0, 7);
      ctx.fillStyle = 'rgba(225,247,255,0.3)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(bb.x - bb.r * 0.45, bb.y - bb.r * 0.5, Math.max(0.6, bb.r * 0.35), Math.max(0.6, bb.r * 0.35));
    }
  }

  private drawSurface(ctx: CanvasRenderingContext2D) {
    if (!this.visible(this.surfY - 60, this.surfY + 30)) return;
    const N = this.poolEta.length - 1, W = this.W;
    const band = 16;
    ctx.beginPath();
    ctx.moveTo(0, this.surfY + this.poolEta[0] * PPM - band);
    for (let i = 1; i <= N; i++) ctx.lineTo((i / N) * W, this.surfY + this.poolEta[i] * PPM * 0.6 - band);
    for (let i = N; i >= 0; i--) ctx.lineTo((i / N) * W, this.surfY + this.poolEta[i] * PPM);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, this.surfY - band, 0, this.surfY + 4);
    g.addColorStop(0, 'rgba(220,245,255,0.0)'); g.addColorStop(0.4, 'rgba(180,230,252,0.6)'); g.addColorStop(1, 'rgba(130,205,247,0.85)');
    ctx.save(); if (this.opts.picture) ctx.globalAlpha = 0.22;
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    for (const r of this.ripples) {
      for (const [vg, w] of [[70, 1], [115, 0.7], [170, 0.45]] as [number, number][]) {
        const rad = r.t * vg;
        const a = r.amp * w * Math.exp(-r.t * 0.9) / Math.sqrt(1 + rad / 30);
        if (a < 0.02) continue;
        ctx.beginPath(); ctx.ellipse(r.x, this.surfY - band * 0.45, rad, Math.min(band * 0.5, 4 + rad * 0.08), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${clamp(a, 0, 0.9)})`; ctx.lineWidth = 1.4; ctx.stroke();
      }
    }
    for (let i = 1; i <= N; i++) {
      const y0 = this.surfY + this.poolEta[i - 1] * PPM, y1 = this.surfY + this.poolEta[i] * PPM;
      ctx.beginPath(); ctx.moveTo(((i - 1) / N) * W, y0); ctx.lineTo((i / N) * W, y1);
      ctx.strokeStyle = `rgba(255,255,255,${clamp(0.7 - (y1 - y0) * 0.25, 0.35, 1) * (this.opts.picture ? 0.22 : 1)})`; ctx.lineWidth = this.opts.picture ? 1.2 : 2; ctx.stroke();
    }
  }

  /** the exact brand logo, brought to life */
  private drawLogo(ctx: CanvasRenderingContext2D) {
    const s = this.logoS, C = LOGO.crop;
    const [ix, iy] = this.M(C.x, C.y);
    const iw = C.w * s, ih = C.h * s;
    if (this.imgLogo.complete && this.imgLogo.naturalWidth) {
      // above the water at full strength; the dipping J-tail seen through the water (attenuated)
      const pic = !!this.opts.picture;
      if (pic) this.drawLogoReflection(ctx, ix, iy, iw, ih);
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, this.surfY - iy); ctx.clip();
      // picture mode: match the photo's soft crystal light (less saturated, a touch brighter)
      if (pic) ctx.filter = 'saturate(0.82) brightness(1.06) contrast(1.04)';
      ctx.drawImage(this.imgLogo, ix, iy, iw, ih); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(ix, this.surfY, iw, Math.max(0, iy + ih - this.surfY)); ctx.clip();
      ctx.globalAlpha = 0.55; ctx.drawImage(this.imgLogo, ix, iy, iw, ih); ctx.restore();
    }

    // water inside the ring: gooseneck jet impact ripples, shimmer, rising bubbles
    const inner = LOGO.inner;
    const [icx, icy] = this.M(inner.cx, inner.cy);
    const [, wy] = this.M(0, LOGO.water);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(icx, icy, inner.rx * s, inner.ry * s, 0, 0, Math.PI * 2); ctx.clip();
    for (const r of this.ringRipples) {
      const rad = 4 + r.t * 70 * s / 0.4, a = 0.7 * (1 - r.t / 1.4);
      ctx.beginPath(); ctx.ellipse(r.x, wy + 2, rad, rad * 0.16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.beginPath();
    const hw = inner.rx * s * 0.97;
    for (let x = icx - hw; x <= icx + hw; x += 4) {
      const y = wy + 1 + Math.sin(x * 0.07 + this.t * 3.2) * 1.2 + Math.sin(x * 0.023 - this.t * 1.7) * 1.4;
      x === icx - hw ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    for (const b of this.ringBubbles) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7);
      ctx.fillStyle = 'rgba(230,248,255,0.35)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.restore();

    // bubbles carried by the water inside the J and the legs
    for (const tr of this.tracers) {
      const p = this.lines[tr.line];
      const a = p.at(tr.s * p.length);
      const o = tr.o * this.pipeR * 0.75 + Math.sin(this.t * 4 + tr.s * 30) * this.pipeR * 0.08;
      const x = a.x + a.nx * o, y = a.y + a.ny * o;
      if (y > this.surfY) continue;
      const r = tr.r * clamp(s / 0.4, 0.6, 1.3);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = 'rgba(235,250,255,0.45)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.6; ctx.stroke();
    }

    // gooseneck jet
    const [sx, sy] = this.M(LOGO.spout.x, LOGO.spout.y);
    this.jet.draw(ctx, { x: sx, y: sy });

    // specular glint travelling over the glass ring
    const st = this.t - this.logoSpark.t;
    if (st < 0.7) {
      const [gx, gy] = this.M(...LOGO.sparks[this.logoSpark.k]);
      this.star(ctx, gx, gy, 26 * s / 0.4 * Math.sin((st / 0.7) * Math.PI), 1);
    }

  }

  /**
   * Mirror image of the logo on the water, like the picture's letters:
   * Fresnel-weak (≈25 %), fading with depth, and broken into horizontal
   * strips displaced by the surface slope (a real reflection on moving water).
   */
  private drawLogoReflection(ctx: CanvasRenderingContext2D, ix: number, iy: number, iw: number, ih: number) {
    const top = this.surfY, depth = Math.min(this.surfY - iy, ih) * 0.75;
    const strip = 3;
    ctx.save();
    ctx.filter = 'saturate(0.7) blur(0.6px)';
    for (let y = 0; y < depth; y += strip) {
      const sy = this.surfY - y;                        // mirrored source row
      const srcY = ((sy - iy) / ih) * this.imgLogo.naturalHeight;
      if (srcY < 0) break;
      const wob = Math.sin(y * 0.12 - this.t * 2.6) * (1 + y * 0.03) + this.slopeAt(ix + iw / 2) * 6;
      ctx.globalAlpha = 0.28 * (1 - y / depth);
      ctx.drawImage(this.imgLogo, 0, srcY, this.imgLogo.naturalWidth, (strip / ih) * this.imgLogo.naturalHeight,
        ix + wob, top + y, iw, strip + 0.5);
    }
    ctx.restore();
  }

  /** four-point lens-flare sparkle */
  private star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
    if (r < 0.5) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = r * 0.8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - r * 1.8, y); ctx.lineTo(x + r * 1.8, y); ctx.moveTo(x, y - r * 1.8); ctx.lineTo(x, y + r * 1.8); ctx.stroke();
    ctx.restore();
  }

  private drawPump(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.P, R = this.Rp;
    if (!this.visible(y - R * 1.6, y + R * 1.6)) return;
    if (this.imgImpeller.complete && this.imgImpeller.naturalWidth) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-this.t * 2.4);
      const d = R * 2.15; ctx.drawImage(this.imgImpeller, -d / 2, -d / 2, d, d); ctx.restore();
    }
    ctx.save(); ctx.lineCap = 'round';
    for (const p of this.swirl) {
      const rr = R * (0.3 + 0.8 * p.r);
      ctx.beginPath(); ctx.arc(x, y, rr, p.a, p.a + 0.18);
      ctx.strokeStyle = `rgba(200,245,255,${0.55 * (1 - p.r)})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.restore();
    // glass volute casing: spiral r(φ) = R(1 + 0.24u) opening tangentially into the discharge nozzle
    ctx.save();
    const Rout = R * 1.24, nozX = x - R * 0.75;
    ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
      const u = k / 80, ph = Math.PI * 1.5 - u * Math.PI * 2, rr = R * (1.0 + 0.24 * u);
      const px = x + Math.cos(ph) * rr, py = y + Math.sin(ph) * rr;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.lineTo(nozX, y - Rout); ctx.lineTo(nozX, y - Rout + this.pipeR * 2 + 4); ctx.lineTo(x - R * 0.1, y - R * 0.98);
    ctx.closePath();
    ctx.fillStyle = 'rgba(160,220,255,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(20,90,200,0.75)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, R * 1.08, Math.PI * 0.95, Math.PI * 1.35);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowColor = 'rgba(80,240,255,0.95)'; ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(120,250,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(nozX, y - Rout + this.pipeR + 2, this.pipeR * 0.3, this.pipeR * 1.15, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  private drawOrbitTrails(ctx: CanvasRenderingContext2D, back: boolean) {
    const n = this.opts.values.length;
    if (!n || !this.visible(this.orbitBox.y - 40, this.orbitBox.y + this.orbitBox.h + 40)) return;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const p = this.planet(i);
      for (const dr of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.ellipse(this.P.x, this.P.y, p.R + dr, (p.R + dr) * p.q, p.tilt, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
        ctx.strokeStyle = `rgba(255,255,255,${dr === 0 ? 0.55 : 0.22})`; ctx.lineWidth = dr === 0 ? 1.2 : 0.8; ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPlanets(ctx: CanvasRenderingContext2D, front: boolean) {
    const n = this.opts.values.length;
    if (!n) return;
    const list = Array.from({ length: n }, (_, i) => ({ i, ...this.planet(i) }))
      .filter(p => (p.d >= 0) === front).sort((a, b) => a.d - b.d);
    for (const p of list) {
      if (!this.visible(p.y - p.pr, p.y + p.pr)) continue;
      const v = this.opts.values[p.i];
      ctx.save();
      ctx.globalAlpha = 0.78 + 0.22 * (p.d + 1) / 2;
      if (this.imgBubble.complete && this.imgBubble.naturalWidth) {
        const k = p.pr / 98; // sprite bubble: centre ≈ (128,100), radius ≈ 98 px
        ctx.drawImage(this.imgBubble, p.x - 128 * k, p.y - 100 * k, 243 * k, 208 * k);
      } else {
        const g = ctx.createRadialGradient(p.x - p.pr * 0.35, p.y - p.pr * 0.35, p.pr * 0.1, p.x, p.y, p.pr);
        g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(90,170,240,0.6)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.pr, 0, 7); ctx.fill();
      }
      if (this.focus === p.i) {
        ctx.shadowColor = 'rgba(80,240,255,0.9)'; ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(140,250,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.pr * 1.02, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(p.pr * 0.42)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText(v.icon, p.x, p.y - p.pr * 0.3);
      ctx.fillStyle = '#0b2350';
      const fs = Math.max(10, Math.round(p.pr * 0.2));
      ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
      const words = v.title.split(' '); const lines: string[] = []; let cur = '';
      for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (ctx.measureText(tryL).width > p.pr * 1.5 && cur) { lines.push(cur); cur = w; } else cur = tryL; }
      if (cur) lines.push(cur);
      lines.slice(0, 3).forEach((l, k) => ctx.fillText(l, p.x, p.y + p.pr * 0.12 + k * fs * 1.12));
      ctx.restore();
    }
  }

  private letterOffset(l: Letter) {
    const cx = l.x + l.w / 2;
    const age = this.t - l.at;
    const eta = this.surfaceAt(cx) - this.surfY;
    const settle = age > 0.9 ? this.letterFs * 0.05 * Math.exp(-(age - 0.9) / 0.5) * Math.sin((age - 0.9) * 10) : 0;
    return { dy: eta * 0.9 + settle, rot: Math.atan(this.slopeAt(cx)) * 0.5 };
  }

  private drawLetterReflections(ctx: CanvasRenderingContext2D) {
    if (!this.letters.length || !this.visible(this.surfY - 10, this.surfY + this.letterFs)) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, this.surfY, this.W, this.letterFs * 1.1); ctx.clip();
    for (const l of this.letters) {
      const age = this.t - l.at;
      if (age < 0.4 || !l.sprite) continue;
      const { dy } = this.letterOffset(l);
      const sh = l.sprite.height, sw = l.sprite.width, pad = l.pad;
      const top = this.letterBase + dy;
      const slice = 4;
      ctx.globalAlpha = 0.38 * clamp((age - 0.4) / 0.6, 0, 1);
      for (let yy = 0; yy < sh - pad; yy += slice) {
        const off = Math.sin((yy + this.t * 60) * 0.12) * (1 + yy * 0.035);
        ctx.globalAlpha = 0.38 * clamp((age - 0.4) / 0.6, 0, 1) * (1 - yy / (sh - pad) * 0.7);
        ctx.drawImage(l.sprite, 0, sh - pad - yy - slice, sw, slice, l.x - pad + off, top + yy, sw, slice);
      }
    }
    ctx.restore();
  }

  private drawLetters(ctx: CanvasRenderingContext2D) {
    if (!this.letters.length || !this.visible(this.letterBase - this.letterFs * 1.3, this.letterBase + 20)) return;
    const sheenAge = this.t - this.sheenT;
    const x0 = this.letters[0].x, x1 = this.letters[this.letters.length - 1].x + this.letters[this.letters.length - 1].w;
    for (const l of this.letters) {
      const age = this.t - l.at;
      if (age < 0 || !l.sprite) continue;
      const cx = l.x + l.w / 2;
      const sh = l.sprite.height, sw = l.sprite.width, pad = l.pad;
      const fs = this.letterFs;
      // the letter rises out of a water column
      if (age < 0.75) {
        const u = clamp(age / 0.45, 0, 1);
        const h = fs * 0.95 * Math.sin(u * Math.PI / 2) * (age < 0.45 ? 1 : 1 - (age - 0.45) / 0.3);
        const w = l.w * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.75, this.surfY);
        ctx.quadraticCurveTo(cx - w * 0.3, this.surfY - h * 0.5, cx - w * 0.18, this.surfY - h);
        ctx.quadraticCurveTo(cx, this.surfY - h - w * 0.3, cx + w * 0.18, this.surfY - h);
        ctx.quadraticCurveTo(cx + w * 0.3, this.surfY - h * 0.5, cx + w * 0.75, this.surfY);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, this.surfY - h, 0, this.surfY);
        g.addColorStop(0, 'rgba(235,250,255,0.9)'); g.addColorStop(1, 'rgba(110,195,245,0.75)');
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.stroke();
        if (age > 0.4 && age - 0.4 < 0.04) {
          for (let k = 0; k < 14; k++) this.particles.push({ x: cx + rand(-l.w / 2, l.w / 2), y: this.surfY - fs * rand(0.5, 0.95), vx: rand(-110, 110), vy: rand(-220, -40), r: rand(1.2, 3.2), life: 2 });
          this.ripples.push({ x: cx, t: 0, amp: 0.6 });
        }
      }
      if (age < 0.38) continue;
      const { dy, rot } = this.letterOffset(l);
      const reveal = clamp((age - 0.38) / 0.4, 0, 1);
      const bottom = sh - pad;
      // compose letter + travelling sheen on a scratch canvas (sheen masked by the glyph)
      const sc = this.scratch;
      if (sc.width !== sw || sc.height !== sh) { sc.width = sw; sc.height = sh; }
      const g2 = sc.getContext('2d')!;
      g2.globalCompositeOperation = 'source-over';
      g2.clearRect(0, 0, sw, sh);
      g2.drawImage(l.sprite, 0, 0);
      if (sheenAge < 1.4) {
        const pos = x0 - fs + (x1 - x0 + 2 * fs) * (sheenAge / 1.4) - (l.x - pad);
        const sg = g2.createLinearGradient(pos - fs * 0.5, 0, pos + fs * 0.1, sh);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        g2.globalCompositeOperation = 'source-atop';
        g2.fillStyle = sg; g2.fillRect(0, 0, sw, sh);
      }
      ctx.save();
      ctx.translate(cx, this.letterBase + dy);
      ctx.rotate(rot);
      ctx.beginPath(); ctx.rect(-sw / 2, -bottom + (bottom - bottom * reveal), sw, bottom * reveal + pad); ctx.clip();
      ctx.drawImage(sc, -l.w / 2 - pad, -bottom, sw, sh);
      ctx.restore();
      // sparkle
      const st = this.t - l.sparkT;
      if (st < 0.6 && age > 1) {
        const px = cx - l.w / 2 + l.w * l.sx, py = this.letterBase + dy - bottom + pad + (bottom - pad) * l.sy;
        this.star(ctx, px, py, fs * 0.11 * Math.sin((st / 0.6) * Math.PI), 1);
      }
    }
  }

  private drawCrowns(ctx: CanvasRenderingContext2D, back: boolean) {
    for (const c of this.crowns) {
      const rad = this.crownRadius(c), h = this.crownHeight(c);
      if (h < 1) continue;
      const base = this.surfY, ry = rad * 0.22, u = c.t / c.T;
      const a0 = back ? Math.PI : 0, a1 = back ? Math.PI * 2 : Math.PI;
      const fade = clamp(1.25 - u, 0, 1);
      ctx.beginPath();
      const steps = 28;
      for (let k = 0; k <= steps; k++) { // rim with fingering (Rayleigh–Plateau) spikes
        const a = a0 + (a1 - a0) * (k / steps);
        const finger = Math.max(0, Math.sin(a * c.n + c.seed)) ** 6 * h * 0.35;
        const x = c.x + Math.cos(a) * rad * (1 + 0.06 * u), y = base + Math.sin(a) * ry - h - finger;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      for (let k = steps; k >= 0; k--) {
        const a = a0 + (a1 - a0) * (k / steps);
        ctx.lineTo(c.x + Math.cos(a) * rad * 0.82, base + Math.sin(a) * ry * 0.82);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, `rgba(255,255,255,${(back ? 0.35 : 0.7) * fade})`);
      g.addColorStop(1, `rgba(130,205,248,${(back ? 0.2 : 0.45) * fade})`);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  private drawCavities(ctx: CanvasRenderingContext2D) {
    for (const c of this.cavities) { // air cavity punched below the surface by the drop
      const u = c.t / c.T, d = c.R * 1.6 * Math.sin(Math.PI * u), rx = c.R * (1 - 0.35 * u);
      if (d < 1) continue;
      ctx.beginPath();
      ctx.moveTo(c.x - rx, this.surfY);
      ctx.bezierCurveTo(c.x - rx, this.surfY + d * 0.9, c.x - rx * 0.4, this.surfY + d, c.x, this.surfY + d);
      ctx.bezierCurveTo(c.x + rx * 0.4, this.surfY + d, c.x + rx, this.surfY + d * 0.9, c.x + rx, this.surfY);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, this.surfY, 0, this.surfY + d);
      g.addColorStop(0, 'rgba(240,252,255,0.75)'); g.addColorStop(1, 'rgba(200,238,255,0.45)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  private drawBuoys(ctx: CanvasRenderingContext2D) {
    const Rb = this.buoyRadius();
    let gap = 1e9;
    const xs = this.opts.stats.map((_, i) => this.slotX(i)).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]);
    const roomy = gap > 150;
    let newest: Buoy | null = null;
    for (const b of this.buoys) if (!b.sink && (!newest || b.born > newest.born)) newest = b;
    for (const b of this.buoys) {
      if (!this.visible(b.y - Rb * 2, b.y + Rb * 2.5)) continue;
      const st = this.opts.stats[b.i];
      if (!st) continue;
      const depthFade = b.sink ? clamp(1 - (b.y - this.surfY) / (Rb * 4.5), 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha = depthFade;
      ctx.translate(b.x, b.y); ctx.rotate(b.ang);
      const g = ctx.createRadialGradient(-Rb * 0.35, -Rb * 0.4, Rb * 0.1, 0, 0, Rb);
      g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.55, 'rgba(190,232,255,0.75)'); g.addColorStop(1, 'rgba(40,135,230,0.75)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, Rb, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-Rb * 0.38, -Rb * 0.5, Rb * 0.28, Rb * 0.14, -0.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = Rb * 0.72; ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(st.value).width; if (tw > Rb * 1.6) { fs *= (Rb * 1.6) / tw; ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`; }
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(st.value, 0, -Rb * 0.04);
      ctx.fillStyle = '#ea580c'; ctx.fillText(st.value, 0, -Rb * 0.04);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = depthFade;
      ctx.beginPath(); ctx.arc(b.x, b.y, Rb + 1, 0, 7); ctx.clip();
      const sy = this.surfaceAt(b.x);
      ctx.fillStyle = 'rgba(70,170,240,0.32)'; ctx.fillRect(b.x - Rb - 2, sy, Rb * 2 + 4, Rb * 2 + 4);
      ctx.restore();
      if (!b.sink && (roomy || b === newest)) {
        ctx.save();
        const age = this.t - b.born;
        ctx.globalAlpha = clamp((age - 0.6) / 0.6, 0, 1);
        const fsL = clamp(Rb * 0.36, 10, 14);
        ctx.font = `600 ${fsL}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(st.label).width + 16;
        const ly = b.y + Rb + 16 + Math.sin(this.t * 2 + b.i) * 1.5;
        const lx = clamp(b.x, w / 2 + 6, this.W - w / 2 - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.roundRect(lx - w / 2, ly - fsL * 0.9, w, fsL * 1.8, fsL * 0.9); ctx.fill();
        ctx.fillStyle = '#0b2350'; ctx.fillText(st.label, lx, ly + 0.5);
        ctx.restore();
      }
    }
  }

  private drawSplash(ctx: CanvasRenderingContext2D) {
    for (const c of this.columns) { // Worthington jet
      if (c.t <= 0) continue;
      const u = c.t / c.T, h = c.H * Math.sin(Math.PI * u), w = c.w * (1 - u * 0.4);
      if (h < 1) continue;
      ctx.beginPath();
      ctx.moveTo(c.x - w * 1.5, this.surfY);
      ctx.quadraticCurveTo(c.x - w * 0.5, this.surfY - h * 0.3, c.x - w * 0.35, this.surfY - h);
      ctx.arc(c.x, this.surfY - h, w * 0.35, Math.PI, 0);
      ctx.quadraticCurveTo(c.x + w * 0.5, this.surfY - h * 0.3, c.x + w * 1.5, this.surfY);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, this.surfY - h, 0, this.surfY);
      g.addColorStop(0, 'rgba(240,252,255,0.92)'); g.addColorStop(1, 'rgba(120,200,246,0.8)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const p of this.particles) drawDrop(ctx, p.x, p.y, p.r, Math.min(1.2, Math.abs(p.vy) / 700));
  }

  private drawNumberedDrop(ctx: CanvasRenderingContext2D) {
    const d = this.drop;
    if (!d) return;
    const st = this.opts.stats[d.i];
    const tip = this.dropTip(), r = d.r;
    ctx.save();
    if (d.phase === 'grow') {
      const neck = Math.max(r * 0.12, this.pipeR * 0.55 * (1 - d.t / 1.9));
      ctx.beginPath();
      ctx.moveTo(tip.x - this.pipeR * 0.75, tip.y);
      ctx.quadraticCurveTo(tip.x - neck, tip.y + r * 0.2, tip.x - neck * 0.9, d.y - r * 0.85);
      ctx.arc(d.x, d.y, r, Math.PI * 1.3, Math.PI * 1.7, true);
      ctx.quadraticCurveTo(tip.x + neck, tip.y + r * 0.2, tip.x + this.pipeR * 0.75, tip.y);
      ctx.closePath();
      const g = ctx.createRadialGradient(d.x - r * 0.35, d.y - r * 0.3, r * 0.1, d.x, d.y, r * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.97)'); g.addColorStop(0.4, 'rgba(185,228,255,0.8)'); g.addColorStop(1, 'rgba(40,130,230,0.78)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,90,190,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      // Rayleigh n = 2 shape oscillation decaying after pinch-off
      const e = 0.16 * Math.exp(-d.t / 0.3) * Math.cos(2 * Math.PI * 6 * d.t);
      ctx.translate(d.x, d.y); ctx.scale(1 + e, 1 - e); ctx.translate(-d.x, -d.y);
      drawDrop(ctx, d.x, d.y, r, Math.min(0.8, d.vy / 900));
    }
    if (st && r > this.dropRadius() * 0.45) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = r * 0.62; ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(st.value).width; if (tw > r * 1.55) { fs *= (r * 1.55) / tw; ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`; }
      ctx.globalAlpha = clamp((r / this.dropRadius() - 0.45) * 2.5, 0, 1);
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(st.value, d.x, d.y + r * 0.05);
      ctx.fillStyle = '#ea580c'; ctx.fillText(st.value, d.x, d.y + r * 0.05);
    }
    ctx.restore();
  }
}
