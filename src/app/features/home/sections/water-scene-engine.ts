/**
 * SIGAT WATER SCENE (home · "À propos") — framework-free, one canvas.
 *
 *   sky (no caustics) │ the official logo = a living reservoir │ 3D crystal
 *   ────────────────── water surface ─────────────────────────── "SIGAT"
 *   water body: caustics, rays, the rising main to the pump below, the
 *   figures floating as buoys, the story written on the water.
 *
 * THE CYCLE (a real reservoir with level control):
 *   1. FILL  — the ring starts EMPTY; the pump fills it (water climbs the J
 *              and pours from the gooseneck) up to the HIGH float switch.
 *   2. DROPS — five drops form at the left leg (Tate's law), each carrying a
 *              figure (15+, 120+, 500 km+, 300+, 2010). Each one drains the
 *              ring, splashes, becomes a buoy, and launches a travelling wave
 *              along the surface; the wave raises the letters it passes —
 *              on the first cycle it is THE WAVE THAT MAKES THE LETTER APPEAR.
 *   3. HOLD  — the full set floats; the ring is empty.
 *   4. SINK  — the buoys lose buoyancy and go under, one after another;
 *              then the pump refills the ring → back to 1.
 *
 * Touch / mouse: a tap drops heavy water from high above (big splash, waves
 * both ways, letters bob in turn); dragging across the water leaves a wake
 * and pushes the letters you cross.
 *
 * Physics: free fall ½gt², momentum transfer, travelling wave packets
 * (group speed c, Gaussian envelope, exponential decay) on top of a
 * wave-equation surface; letters ride the surface + a damped spring; the
 * water inside each letter is a damped oscillator (sloshing).
 * Performance: sticky viewport-band canvas (DPR 1), pre-rendered sky and
 * sprites, underwater light at half resolution.
 */
import { WaveSurface, clamp, rand } from '../../../shared/hydro/hydro-physics';
import { Path, Seg, buildPath, drawGlassPipe, tracePath } from '../../../shared/hydraulics/hydraulics-core';

const G = 1650;                // px/s²
const WAVE_C = 480;            // travelling-wave speed along the surface (px/s)

const LG = {
  crop: { x: 40, w: 1055, h: 1440 }, img: 0.8,
  surf: 1360, spout: { x: 462, y: 352 },
  inner: { cx: 565, cy: 362, rx: 440, ry: 262 },
  ringBottom: 624, full: 300, art: 397,
  drip: { x: 463, y: 1136 }, tail: { x: 505, y: 1393 },
};
const J_LINE: [number, number][] = [[505, 1395], [600, 1325], [690, 1215], [760, 1050], [775, 900], [765, 750], [745, 600], [720, 480], [690, 330], [640, 250], [580, 232], [520, 252], [480, 300], [462, 350]];
const LEFT_LINE: [number, number][] = [[463, 1120], [440, 980], [415, 800], [400, 650], [395, 560]];
const MID_LINE: [number, number][] = [[575, 1120], [575, 700]];
/** the drain (vidange) leg, from its mouth inside the reservoir down to the outlet */
const LEG_LINE: [number, number][] = [[395, 560], [400, 650], [415, 800], [440, 980], [463, 1120], [463, 1136]];
const TUBE_R = 48.75;                      // glass tube outer radius (logo units)
const RING_IN = { cx: 566.25, cy: 362.5, rx: 417.5, ry: 265 };   // inner edge of the ring = the reservoir
const VALVE_Y = 905;                       // drain valve on the left leg (logo units)
/** Chaikin smoothing — identical to the one used to shade the glass tubes of logo-glass.webp */
function chaikin(l: [number, number][], it = 3): [number, number][] {
  for (let k = 0; k < it; k++) {
    const o: [number, number][] = [l[0]];
    for (let i = 0; i < l.length - 1; i++) {
      const [ax, ay] = l[i], [bx, by] = l[i + 1];
      o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    o.push(l[l.length - 1]); l = o;
  }
  return l;
}

export interface SceneFigure { value: string; label: string; }

/** The owner's crystal SIGAT artwork, one transparent sprite per letter (w/h at 420 px high). */
const LETTER_ART = ['S', 'I', 'G', 'A', 'T'].map(ch => `assets/media/home/letters/sigat-${ch}.webp`);
const LETTER_ASPECT = [323 / 420, 143 / 420, 359 / 420, 385 / 420, 346 / 420];
/** gap after each letter, in letter heights (A–T kerned: the T bar overhangs the A foot) */
const LETTER_GAP = [0.03, 0.03, 0.03, -0.09, 0];

interface Letter {
  ch: string; x: number; w: number; pad: number;
  sprite: HTMLCanvasElement; mask: HTMLCanvasElement; depth: HTMLCanvasElement; water: HTMLCanvasElement;
  shown: boolean; risen: number;          // time it emerged (−1 hidden)
  y: number; vy: number;                  // spring offset (positive = down)
  th: number; om: number;                 // inner free-surface tilt (sloshing)
  bub: { x: number; y: number; r: number; v: number }[];
}
interface Packet { x0: number; t: number; A: number; dir: 1 | -1; reveal: number; }
interface P { x: number; y: number; vx: number; vy: number; r: number; life: number; }
interface Ring { x: number; t: number; amp: number; }
interface Fall { x: number; y: number; vy: number; r: number; big: boolean; }
interface Buoy { i: number; x: number; y: number; vy: number; sink: number; }   // sink: −1 floating, else time it started sinking
type Phase = 'fill' | 'drops' | 'hold' | 'sink';

export class WaterSceneEngine {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  W = 1; Hs = 1; surfY = 400; private vh = 800; private vy = 0;
  private s = 0.4; private lx = 0; private ly = 0; private margin = 40;
  private fs = 120; private k = 1.3; private capH = 150;
  private lettersX0 = 0;
  storyTop = 0;
  private main?: Path; private mainR = 10;
  private t = 0;
  private wave = new WaveSurface({ columns: 150, speed: 340, stiffness: 7, damping: 1.4 });
  private packets: Packet[] = [];
  private letters: Letter[] = [];
  private falls: Fall[] = [];
  private parts: P[] = [];
  private rings: Ring[] = [];
  private ringRip: Ring[] = [];
  private ringBub: P[] = [];
  private jet: P[] = [];
  private buoys: Buoy[] = [];
  private figures: SceneFigure[] = [];
  // cycle
  private phase: Phase = 'fill';
  private phaseT = 0;
  private level = 0;                // the ring starts EMPTY
  private dropsDone = 0;
  private firstCycle = true;
  /** the pendant drop growing at the left leg (one at a time) and the ones already falling */
  private pendant: { t: number; T: number; r: number; R: number; i: number } | null = null;
  private fallingFig: { y: number; vy: number; r: number; i: number }[] = [];
  private dripWait = 0;
  private pumpState = false;
  // pointer
  private drag: { x: number; y: number; t: number } | null = null;
  private wakeClock = 0;
  // assets
  private logo = new Image();
  private caustA: HTMLCanvasElement; private caustB: HTMLCanvasElement;
  private jPath?: Path;
  private legPath?: Path;
  // riser (J): water front as a fraction of its length, front speed
  private jFill = 0; private jV = 0; private jPh = 0;
  // drain leg: column above the valve (fraction, filled from the valve up), valve opening,
  // and the column below the valve between tail legT and front legF (arclengths)
  private sValve = 0; private legUpper = 0; private valve = 0; private releasing = false;
  private legT = 0; private legF = 0; private legV = 0; private legTV = 0; private legPh = 0;
  private ringPh = 0;
  private art: HTMLImageElement[] = [];
  private artReady = false;
  private skyC = document.createElement('canvas');
  private fxC = document.createElement('canvas');

  onTail?: (fraction: number) => void;
  /** the pump below runs while the ring is being filled */
  onPump?: (on: boolean) => void;

  constructor(private canvas: HTMLCanvasElement, private section: HTMLElement, private story: HTMLElement, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.logo.src = 'assets/brand/logo-glass.webp';   // the official artwork as EMPTY glass — all water is live
    let loaded = 0;
    this.art = LETTER_ART.map(src => {
      const im = new Image(); im.decoding = 'async'; im.src = src;
      im.onload = () => { if (++loaded === LETTER_ART.length) { this.artReady = true; if (this.W > 1) this.layout(this.W, this.vh); } };
      return im;
    });
    this.caustA = this.causticTile(7); this.caustB = this.causticTile(23);
    if (reduced) { this.level = 0.6; this.phase = 'hold'; this.firstCycle = false; this.legUpper = 1; }
  }

  setFigures(f: SceneFigure[]) {
    this.figures = f;
    if (this.reduced) this.buoys = f.map((_, i) => ({ i, x: this.slotX(i), y: this.surfY + this.buoyR() * 0.3, vy: 0, sink: -1 }));
  }

  /* ===================================================================== layout */
  layout(W: number, vh: number) {
    const narrow = W < 768;
    this.W = W; this.vh = vh;
    this.margin = clamp(W * 0.05, 16, 90);
    const m = this.margin, gap = narrow ? 10 : clamp(W * 0.03, 20, 60);
    const ringSpan = LG.surf - LG.ringBottom;
    const wordAspect = LETTER_ASPECT.reduce((a, b) => a + b, 0) + LETTER_GAP.reduce((a, b) => a + b, 0);   // word width / height
    const kMax = 1.3;                                  // the bubbly glass tolerates a slight vertical stretch
    let s: number;
    if (narrow) s = (W * 0.38) / LG.crop.w;           // phones: the logo-reservoir stays the hero, the word beside it
    else {
      const perS = LG.crop.w + (ringSpan / kMax) * wordAspect;
      s = Math.min((W - 2 * m - gap) / perS, (vh * 0.86) / LG.crop.h, 0.62);
    }
    this.s = s;
    const top = narrow ? 70 : 90;
    this.ly = top; this.lx = m - LG.crop.x * s;
    this.surfY = top + LG.surf * s;
    const avail = W - m - (m + LG.crop.w * s + gap);
    // letter height = ring bottom → water line (their top sits at the "empty" level)
    let H = ringSpan * s;
    let k = clamp((H * wordAspect) / avail, 1, kMax);
    if ((H * wordAspect) / k > avail) H = (avail * kMax) / wordAspect;
    this.k = k; this.capH = H; this.fs = H / 0.72;
    this.lettersX0 = m + LG.crop.w * s + gap + (avail - (H * wordAspect) / k) / 2;
    this.buildLetters();
    this.storyTop = this.surfY + Math.max(this.capH * 0.75, 110);
    const storyH = this.story.offsetHeight || 360;
    this.Hs = Math.round(this.storyTop + storyH + clamp(vh * 0.18, 110, 200));
    this.section.style.height = this.Hs + 'px';
    this.story.style.top = this.storyTop + 'px';
    this.dpr = 1;
    const ch = Math.min(vh, this.Hs);
    this.canvas.style.height = ch + 'px';
    if (this.canvas.width !== W || this.canvas.height !== Math.round(ch)) { this.canvas.width = W; this.canvas.height = Math.round(ch); }
    // sky (pre-rendered)
    this.skyC.width = Math.max(1, Math.round(W / 2)); this.skyC.height = Math.max(1, Math.round(this.surfY / 2));
    { const g = this.skyC.getContext('2d')!; g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      const lg = g.createLinearGradient(0, 0, 0, this.surfY);
      lg.addColorStop(0, '#86d0f7'); lg.addColorStop(0.6, '#a9def9'); lg.addColorStop(1, '#c6ebfb');
      g.fillStyle = lg; g.fillRect(0, 0, W, this.surfY);
      const rg = g.createRadialGradient(W * 0.3, this.surfY * 0.55, 0, W * 0.3, this.surfY * 0.55, W * 0.45);
      rg.addColorStop(0, 'rgba(240,250,255,0.75)'); rg.addColorStop(1, 'rgba(240,250,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, this.surfY); }
    this.wave.resize(W);
    const [tx, ty] = this.M(LG.tail.x, LG.tail.y);
    this.mainR = clamp(36 * s, 6, 16);
    this.main = narrow ? undefined : buildPath(tx, ty, [['L', tx, this.Hs + 30] as Seg]);
    const mk = (l: [number, number][]) => { const c = chaikin(l); return buildPath(...this.M(c[0][0], c[0][1]), c.slice(1).map(p => ['L', ...this.M(p[0], p[1])] as Seg), 1.5); };
    this.jPath = mk(J_LINE);
    this.legPath = mk(LEG_LINE);
    this.sValve = this.legPath.sAtY(this.M(0, VALVE_Y)[1]);
    if (this.legT === 0 && this.legF === 0) { this.legT = this.legF = this.sValve; }
    this.onTail?.(tx / W);
  }

  private M(x: number, y: number): [number, number] { return [this.lx + x * this.s, this.ly + y * this.s]; }

  /** free surface = wave-equation field + travelling packets */
  private surfaceAt = (x: number) => {
    let d = this.wave.offsetAt(x);
    for (const p of this.packets) {
      const xc = p.x0 + p.dir * WAVE_C * p.t;
      const u = (x - xc) / 70;
      if (u > -3 && u < 3) d += p.A * Math.exp(-u * u) * Math.cos(u * 2.6) * Math.exp(-p.t / 3.2);
    }
    return this.surfY + d;
  };

  /* ================================================================ sprites */
  private buildLetters() {
    if (!this.artReady) return;
    const old = this.letters;
    this.letters = [];
    const H = this.capH, k = this.k;
    let x = this.lettersX0;
    LETTER_ASPECT.forEach((asp, i) => {
      const w = (H * asp) / k;
      const pad = Math.ceil(H * 0.05);
      const cw = Math.ceil(w + pad * 2), chh = Math.ceil(H + pad * 2);
      const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = chh; return c; };
      const mask = mk(); mask.getContext('2d')!.drawImage(this.art[i], pad, pad, w, H);
      // sprite = the artwork, harmonised with the site's water blues
      const sprite = mk(); const g = sprite.getContext('2d')!;
      g.save(); g.shadowColor = 'rgba(255,255,255,0.7)'; g.shadowBlur = H * 0.04;
      g.drawImage(this.art[i], pad, pad, w, H); g.restore();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(40,140,230,0.10)'; g.fillRect(0, 0, cw, chh);
      g.globalCompositeOperation = 'source-over';
      const prev = old[i];
      this.letters.push({
        ch: 'SIGAT'[i], x, w, pad, sprite, mask, depth: mask, water: mk(),
        shown: prev?.shown ?? this.reduced, risen: prev?.risen ?? (this.reduced ? -100 : -1),
        y: prev?.y ?? 0, vy: prev?.vy ?? 0, th: prev?.th ?? 0, om: prev?.om ?? 0,
        bub: Array.from({ length: 7 }, () => ({ x: rand(0.2, 0.8), y: rand(0.5, 1), r: rand(0.005, 0.012), v: rand(0.08, 0.2) }))
      });
      x += w + (H * LETTER_GAP[i]) / k;
    });
  }


  private causticTile(seed: number): HTMLCanvasElement {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d')!;
    let sd = seed;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const n = 7, pts: [number, number][][] = [];
    for (let i = 0; i < n; i++) { pts.push([]); for (let j = 0; j < n; j++) pts[i].push([(i + 0.05 + rnd() * 0.9) * S / n, (j + 0.05 + rnd() * 0.9) * S / n]); }
    const line = (a: [number, number], b: [number, number]) => {
      const mx = (a[0] + b[0]) / 2 + (rnd() - 0.5) * 22, my = (a[1] + b[1]) / 2 + (rnd() - 0.5) * 22;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        g.beginPath(); g.moveTo(a[0] + ox, a[1] + oy); g.quadraticCurveTo(mx + ox, my + oy, b[0] + ox, b[1] + oy); g.stroke();
      }
    };
    for (const [lw, a] of [[6, 0.1], [2.4, 0.22], [1.1, 0.6]] as const) {
      g.lineWidth = lw; g.strokeStyle = `rgba(255,255,255,${a})`; g.lineCap = 'round';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const p = pts[i][j], r = pts[(i + 1) % n][j], d = pts[i][(j + 1) % n];
        line(p, [r[0] + (i + 1 === n ? S : 0), r[1]]);
        line(p, [d[0], d[1] + (j + 1 === n ? S : 0)]);
      }
    }
    return c;
  }

  /* ================================================================ input */
  private letterAt(px: number, py: number): Letter | undefined {
    return this.letters.find(l => {
      if (!l.shown) return false;
      const base = this.surfaceAt(l.x + l.w / 2) + l.y;
      return px >= l.x - 6 && px <= l.x + l.w + 6 && py <= base + 6 && py >= base - this.capH * 1.08;
    });
  }

  /** tap / click: heavy water falls from high above onto the surface */
  pointerDown(px: number, py: number) {
    if (this.reduced) return;
    this.drag = { x: px, y: py, t: performance.now() };
    const l = this.letterAt(px, py);
    if (l) { this.pushLetter(l, 0, 1); this.splashAt(l.x + l.w / 2, 420, 1.1, true); return; }
    const top = this.vy + 10;                                 // from the top of what you see
    this.falls.push({ x: px, y: Math.min(top, py - 40), vy: 120, r: rand(7, 10), big: true });
  }

  /** dragging across the water leaves a wake; across letters it pushes them */
  pointerMove(px: number, py: number) {
    if (this.reduced || !this.drag) return;
    const now = performance.now(), d = this.drag;
    const dt = Math.max(8, now - d.t) / 1000;
    const vx = (px - d.x) / dt, vy = (py - d.y) / dt;
    const sy = this.surfaceAt(px);
    if (Math.abs(py - sy) < 70 && now - this.wakeClock > 45) {
      this.wakeClock = now;
      this.wave.splash(px, clamp(Math.abs(vx) * 0.25 + vy * 0.3, -300, 420), 34);
      if (Math.abs(vx) > 250) {
        this.packets.push({ x0: px, t: 0, A: clamp(Math.abs(vx) / 140, 2, 9), dir: vx > 0 ? 1 : -1, reveal: -1 });
        for (let k = 0; k < 4; k++) this.parts.push({ x: px, y: sy - 2, vx: vx * rand(0.1, 0.25), vy: -rand(120, 320), r: rand(0.9, 2.2), life: 1 });
      }
    }
    const l = this.letterAt(px, py);
    if (l) this.pushLetter(l, vx, 0.35);
    this.drag = { x: px, y: py, t: now };
  }

  pointerUp() { this.drag = null; }

  private pushLetter(l: Letter, vx: number, strength: number) {
    l.vy += 220 * strength;                     // pressed into the water…
    l.om += clamp(vx / 300, -4, 4) + (Math.random() - 0.5) * 3 * strength;   // …and its water sloshes
  }

  private splashAt(x: number, v: number, amp: number, both = true) {
    this.wave.splash(x, v, 30);
    this.rings.push({ x, t: 0, amp });
    const A = clamp(amp * 7, 3, 16);
    this.packets.push({ x0: x, t: 0, A, dir: 1, reveal: -1 });
    if (both) this.packets.push({ x0: x, t: 0, A, dir: -1, reveal: -1 });
    for (let k = 0; k < Math.round(12 + amp * 10); k++) {
      const a = -Math.PI / 2 + rand(-1.15, 1.15), sp = rand(90, 300) * amp;
      this.parts.push({ x, y: this.surfaceAt(x) - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0.9, 2.6), life: 1 });
    }
  }

  /* ================================================================ simulation */
  frame(dt: number, sectionTop: number) {
    this.vy = clamp(-sectionTop, 0, Math.max(0, this.Hs - this.vh));
    if (dt > 0) this.step(Math.min(dt, 1 / 30));
    this.draw();
  }

  private step(dt: number) {
    this.t += dt;
    this.phaseT += dt;
    this.wave.step(dt);

    // travelling packets: raise letters they pass; on the first cycle they REVEAL letters
    for (const p of this.packets) {
      p.t += dt;
      if (p.reveal >= 0) {
        const l = this.letters[p.reveal];
        const xc = p.x0 + p.dir * WAVE_C * p.t;
        if (l && !l.shown && xc >= l.x + l.w * 0.5) {
          l.shown = true; l.risen = this.t; l.y = this.capH * 1.05; l.vy = -this.capH * 3.2; l.om += 3.5;
          this.rings.push({ x: l.x + l.w / 2, t: 0, amp: 1 });
          for (let k = 0; k < 18; k++) this.parts.push({ x: l.x + rand(0, l.w), y: this.surfY - 2, vx: rand(-120, 120), vy: -rand(140, 380), r: rand(1, 2.8), life: 1 });
          p.reveal = -1;
        }
      }
    }
    this.packets = this.packets.filter(p => p.t < 5).slice(-24);

    // letters: damped spring to the free surface + sloshing water inside
    for (const l of this.letters) {
      if (!l.shown) continue;
      l.vy += (-55 * l.y - 6.5 * l.vy) * dt; l.y += l.vy * dt;
      const w0 = 7, z = 0.08;
      l.om += (-w0 * w0 * l.th - 2 * z * w0 * l.om - l.vy * 0.004) * dt;
      l.th += l.om * dt;
      for (const b of l.bub) { b.y -= b.v * dt; if (b.y < 0.5) { b.y = 1; b.x = rand(0.15, 0.85); } }
    }

    // user drops (heavy water from high)
    for (const f of this.falls) {
      f.vy += G * dt; f.y += f.vy * dt;
      if (f.y >= this.surfaceAt(f.x)) {
        const amp = clamp(f.vy / 700, 0.7, 1.8);
        this.splashAt(f.x, Math.min(f.vy, 1400) * 0.7, amp);
        // letters near the impact are thrown up a little
        for (const l of this.letters) if (l.shown && Math.abs(l.x + l.w / 2 - f.x) < l.w) l.vy -= 160 * amp;
        f.r = -1;
      }
    }
    this.falls = this.falls.filter(f => f.r > 0);

    this.cycle(dt);
    this.reservoir(dt);

    // buoys: buoyancy spring (or sinking), drift to their slot
    const Rb = this.buoyR();
    for (const b of this.buoys) {
      const target = b.sink < 0 ? this.surfaceAt(b.x) + Rb * 0.3 : this.surfY + Rb * 6;
      const kS = b.sink < 0 ? 40 : 4;
      b.vy += ((target - b.y) * kS - b.vy * 4) * dt; b.y += b.vy * dt;
      b.x += (this.slotX(b.i) - b.x) * Math.min(1, dt * 0.8);
    }
    // floats in contact push each other apart (keeps the labels readable while one drifts past)
    const minD = Rb * (this.W < 768 ? 2.2 : 4.6);
    const live = this.buoys.filter(b => b.sink < 0);
    for (let a = 0; a < live.length; a++) for (let c = a + 1; c < live.length; c++) {
      const A = live[a], B = live[c], d = B.x - A.x, o = minD - Math.abs(d);
      if (o > 0) { const p = Math.sign(d || 1) * o * Math.min(1, dt * 6) * 0.5; A.x -= p; B.x += p; }
    }
    this.buoys = this.buoys.filter(b => b.sink < 0 || this.t - b.sink < 3.5);

    for (const p of this.parts) { p.vy += G * 0.7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 0 && p.y > this.surfaceAt(p.x) + 2) p.life = 0; }
    this.parts = this.parts.filter(p => p.life > 0).slice(-320);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 1.8);
  }

  /** FILL → DROPS → HOLD → SINK → FILL … */
  /**
   * RUN  — the pump fills the ring (it stops at the HIGH switch); once the ring is
   *        half full the left leg starts dripping: each pendant drop grows for a
   *        slightly different time (Tate), detaches, falls, and the next one starts
   *        forming right away — drops overlap in flight, nothing is in lockstep.
   * HOLD — the five figures float.   SINK — they go under one by one → RUN.
   */
  private cycle(dt: number) {
    const n = Math.min(5, this.figures.length);
    if (this.phase === 'fill') {
      // dripping (only one pendant drop forms at a time at the outlet)
      // the drain valve opens once the ring is half full; drops can only form once the
      // column released by the valve has run down to the outlet
      if (!this.releasing && this.dropsDone < n && (this.level >= 0.5 || (!this.pumpOn && this.level > 0.1))) this.releasing = true;
      const atOutlet = this.legPath && this.legF >= this.legPath.length - 0.5 && this.legT <= this.sValve + 0.5;
      if (!this.pendant && this.dropsDone < n && this.releasing && atOutlet && this.valve > 0.8) {
        this.dripWait -= dt;
        if (this.dripWait <= 0) this.pendant = { t: 0, T: rand(0.75, 1.15), r: 2, R: this.dropR(this.dropsDone), i: this.dropsDone };
      }
      if (this.pendant) {
        const d = this.pendant;
        d.t += dt;
        const f = clamp(d.t / d.T, 0, 1);
        d.r = d.R * (0.15 + 0.85 * (1 - (1 - f) * (1 - f)));
        if (f >= 1) {                                         // pinch-off
          const [, dy] = this.M(LG.drip.x, LG.drip.y);
          this.fallingFig.push({ y: dy + d.r * 0.95, vy: 30, r: d.r, i: d.i });
          this.level = Math.max(0, this.level - 0.92 / Math.max(1, n));
          this.dropsDone++;
          this.pendant = null;
          this.dripWait = rand(0.05, 0.3);
        }
      }
      if (this.dropsDone >= n) this.releasing = false;                      // last drop gone: shut the valve
      if (this.dropsDone >= n && n && !this.pendant && !this.fallingFig.length) { this.phase = 'hold'; this.phaseT = 0; this.firstCycle = false; }
    } else if (this.phase === 'hold') {
      if (this.phaseT > 5 && !this.reduced) { this.phase = 'sink'; this.phaseT = 0; }
    } else if (this.phase === 'sink') {
      this.buoys.forEach((b, i) => { if (b.sink < 0 && this.phaseT > i * 0.4) { b.sink = this.t; b.vy += 40; } });
      if (this.phaseT > this.buoys.length * 0.4 + 1.2) { this.phase = 'fill'; this.phaseT = 0; this.dropsDone = 0; this.pumpRun = true; }
    }

    // falling figure drops → impact
    const [dx] = this.M(LG.drip.x, LG.drip.y);
    for (const d of this.fallingFig) {
      d.vy += G * dt; d.y += d.vy * dt;
      if (d.y + d.r * 0.6 >= this.surfaceAt(dx)) {
        this.wave.splash(dx, 700, 30);
        this.rings.push({ x: dx, t: 0, amp: 1 });
        for (let k = 0; k < 18; k++) { const a = -Math.PI / 2 + rand(-1.1, 1.1), sp = rand(100, 280); this.parts.push({ x: dx, y: this.surfY - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1, 2.6), life: 1 }); }
        this.packets.push({ x0: dx, t: 0, A: rand(7.5, 10), dir: 1, reveal: this.firstCycle ? d.i : -1 });
        this.packets.push({ x0: dx, t: 0, A: 6, dir: -1, reveal: -1 });
        const old = this.buoys.find(b => b.i === d.i);
        if (old) { old.vy -= 160; old.sink = -1; }
        else this.buoys.push({ i: d.i, x: dx, y: this.surfY, vy: 0, sink: -1 });
        d.r = -1;
      }
    }
    this.fallingFig = this.fallingFig.filter(d => d.r > 0);
  }

  /** pump runs only during FILL; the gooseneck jet + water climbing the J */
  /** pump: runs from the start of a cycle until the HIGH float switch */
  /**
   * PUMP → RISER → RING. The riser starts empty: while the pump runs the water front
   * climbs the J; only when it reaches the gooseneck does water pour into the ring.
   * The pump stops at the HIGH switch and the riser drains back (front falls under g).
   * DRAIN LEG: ring → column above the valve (always full behind a shut valve) →
   * valve → column below it, which runs down to the outlet and feeds the drops.
   */
  private reservoir(dt: number) {
    const s = this.s, Lj = Math.max(1, this.jPath?.length ?? 1), Ll = this.legPath?.length ?? 1;
    // riser
    if (this.pumpOn) { this.jV = Math.min(900 * s, this.jV + 2600 * s * dt); this.jFill = Math.min(1, this.jFill + (this.jV * dt) / Lj); }
    else if (this.jFill > 0) { this.jV = Math.max(-1400 * s, Math.min(0, this.jV) - G * 0.6 * s * dt); this.jFill = Math.max(0, this.jFill + (this.jV * dt) / Lj); }
    this.jPh += dt * Math.max(0, this.jV) * (this.pumpOn ? 1 : 0);
    const pouring = this.pumpOn && this.jFill >= 1;
    if (pouring && this.phase === 'fill') {
      this.level = Math.min(1, this.level + 0.45 * dt);
      if (this.level >= 0.92) this.pumpRun = false;
    }
    if (this.pumpOn !== this.pumpState) { this.pumpState = this.pumpOn; this.onPump?.(this.pumpOn); }
    if (pouring) {
      const [sx, sy] = this.M(LG.spout.x, LG.spout.y);
      for (let q = 0; q < 2; q++) this.jet.push({ x: sx + rand(-2, 2), y: this.levelY() - 2, vx: rand(-40, 40), vy: -rand(20, 90), r: rand(0.8, 1.8), life: 1 });
      if (Math.random() < 0.5) this.ringBub.push({ x: sx + rand(-6, 6), y: this.levelY() + rand(6, 26), vx: 0, vy: 0, r: rand(0.8, 2.2), life: 1 });
      if (Math.random() < 0.15) this.ringRip.push({ x: sx, t: 0, amp: 1 });
      void sy;
    }
    // drain leg — the valve is turned by hand-ish speed (~0.35 s)
    this.valve = clamp(this.valve + (this.releasing ? 1 : -1) * dt / 0.35, 0, 1);
    if (this.level > 0.004) this.legUpper = Math.min(1, this.legUpper + dt * 1.6);          // ring water runs down to the shut valve
    else if (this.valve > 0.2) this.legUpper = Math.max(0, this.legUpper - dt * 0.8);       // empty ring + open valve: it drains
    const g = G * 0.75 * s / 0.4;                                                             // free fall in the pipe (wall friction)
    if (this.valve > 0.25 && this.legUpper > 0.3) {
      this.legT = this.sValve; this.legTV = 0;
      this.legV = Math.min(this.legV + g * dt, 1200 * s); this.legF = Math.min(Ll, this.legF + this.legV * dt);
    } else if (this.legF > this.legT + 0.5) {
      this.legTV = Math.min(this.legTV + g * dt, 1400 * s); this.legT = Math.min(this.legF, this.legT + this.legTV * dt);  // the column falls out
      if (this.legF < Ll) { this.legV = Math.min(this.legV + g * dt, 1200 * s); this.legF = Math.min(Ll, this.legF + this.legV * dt); }
    } else { this.legT = this.legF = this.sValve; this.legV = this.legTV = 0; }
    this.legPh += dt * (this.valve > 0.25 ? 1 : 0.2);
    this.ringPh += dt;
    // pour splash + ring bubbles + ripples
    const wl = this.levelY();
    for (const p of this.jet) { p.vy += G * 0.55 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 0 && p.y >= wl) p.life = 0; }
    this.jet = this.jet.filter(p => p.life > 0).slice(-120);
    for (const b of this.ringBub) { b.y -= (12 + b.r * 9) * dt; if (b.y <= wl + 1) b.life = 0; }
    this.ringBub = this.ringBub.filter(b => b.life > 0).slice(-80);
    for (const r of this.ringRip) r.t += dt;
    this.ringRip = this.ringRip.filter(r => r.t < 1.2);
  }

  private pumpRun = true;
  private get pumpOn() { return this.pumpRun && this.phase === 'fill' && this.phaseT > 0.3; }
  private levelY(): number { return this.M(0, LG.ringBottom - (LG.ringBottom - LG.full) * this.level)[1]; }
  /** drop font + radius: the drop is sized to carry its figure (number big, unit below) */
  private dropFont(): number { return this.W < 768 ? 11 : clamp(this.capH * 0.09, 15, 22); }
  private splitFig(v: string): [string, string] {
    const m = v.match(/^([\d.,]+)\s*(.*)$/);
    return m ? [m[1] + (m[2] === '+' ? '+' : ''), m[2] === '+' ? '' : m[2]] : [v, ''];
  }
  private dropR(i: number): number {
    const fz = this.dropFont(), [num] = this.splitFig(this.figures[i]?.value ?? '');
    this.ctx.font = `800 ${fz}px Sora, system-ui, sans-serif`;
    const want = Math.max(fz * 1.5, this.ctx.measureText(num).width * 0.62 + fz * 0.45);
    const gap = this.surfY - this.M(0, LG.drip.y)[1];                 // the pendant must hang clear of the water
    return clamp(want, 9, Math.max(9, gap * (this.W < 768 ? 0.5 : 0.42)));
  }
  private buoyR(): number { return clamp(this.fs * 0.14, 16, 28); }
  private slotX(i: number): number {
    const n = Math.max(1, Math.min(5, this.figures.length)), Rb = this.buoyR();
    const x0 = this.margin + Rb * 1.5, x1 = this.W - this.margin - Rb * 1.5;
    const xs: number[] = [];
    for (let k = 0; k <= n; k++) xs.push(x0 + ((x1 - x0) * k) / n);
    const drip = this.M(LG.drip.x, LG.drip.y)[0];
    let worst = 0;
    xs.forEach((x, k) => { if (Math.abs(x - drip) < Math.abs(xs[worst] - drip)) worst = k; });
    xs.splice(worst, 1);
    // every float starts under the drip: the first one travels farthest, so none ever crosses another
    xs.sort((u, v) => Math.abs(v - drip) - Math.abs(u - drip));
    return xs[i % xs.length];
  }

  /* ================================================================ render */
  private draw() {
    const ctx = this.ctx, W = this.W, ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, ch);
    ctx.setTransform(1, 0, 0, 1, 0, -this.vy);
    const v0 = this.vy, v1 = this.vy + ch;
    if (v0 < this.surfY) ctx.drawImage(this.skyC, 0, 0, W, this.surfY + 1);
    if (v1 > this.surfY) {
      ctx.beginPath(); ctx.moveTo(0, this.surfaceAt(0));
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, this.surfaceAt(x));
      ctx.lineTo(W, this.Hs); ctx.lineTo(0, this.Hs); ctx.closePath();
      const wg = ctx.createLinearGradient(0, this.surfY, 0, this.Hs);
      wg.addColorStop(0, '#bdeafb'); wg.addColorStop(0.08, '#94d8f7'); wg.addColorStop(1, '#79c9f3');
      ctx.fillStyle = wg; ctx.fill();
      const y0 = Math.max(v0, this.surfY), y1 = v1;
      if (y1 > y0) {
        this.renderFx(W, y0, y1);
        ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.fxC, 0, y0, W, y1 - y0); ctx.restore();
      }
      if (this.main) drawGlassPipe(ctx, this.main, { r: this.mainR, flow: this.pumpOn ? 110 : 25, t: this.t, rings: [40, 260] });
      this.drawLetterReflections(ctx);
      this.drawBuoys(ctx, true);
    }
    this.drawLogo(ctx);
    this.drawSurface(ctx);
    this.drawLetters(ctx);
    this.drawBuoys(ctx, false);
    this.drawParticles(ctx);
    this.drawFigureDrop(ctx);
  }

  private renderFx(W: number, y0: number, y1: number) {
    const c = this.fxC, w = Math.max(1, Math.round(W / 2)), h = Math.max(1, Math.round((y1 - y0) / 2));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d')!;
    g.setTransform(0.5, 0, 0, 0.5, 0, -y0 * 0.5);
    g.clearRect(0, y0, W, y1 - y0);
    for (let r = 0; r < 6; r++) {
      const x = ((r + 0.5) * W) / 6 + Math.sin(this.t * 0.3 + r * 1.4) * 40;
      const gr = g.createLinearGradient(0, this.surfY, 0, this.surfY + 700);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(x - 16, this.surfY); g.lineTo(x + 24, this.surfY); g.lineTo(x - 70, this.surfY + 700); g.lineTo(x - 160, this.surfY + 700); g.fill();
    }
    const tile = (img: HTMLCanvasElement, S: number, ox: number, oy: number, a: number) => {
      g.globalAlpha = a;
      const sx = ((ox % S) + S) % S - S, sy = ((oy % S) + S) % S - S;
      for (let y = Math.floor((y0 - sy) / S) * S + sy; y < y1; y += S) for (let x = sx; x < W; x += S) g.drawImage(img, x, y, S, S);
    };
    tile(this.caustA, 340, this.t * 9, this.t * 5, 0.2);
    tile(this.caustB, 460, -this.t * 7, this.t * 8, 0.14);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, this.surfY, 0, this.Hs);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.7, 'rgba(0,0,0,0.35)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, y0, W, y1 - y0);
    g.globalCompositeOperation = 'source-over';
  }

  private drawLogo(ctx: CanvasRenderingContext2D) {
    const im = this.logo;
    if (!im.complete || !im.naturalWidth) return;
    const s = this.s, [ix, iy] = this.M(LG.crop.x, 0);
    const iw = LG.crop.w * s, ih = LG.crop.h * s;
    this.drawRingWater(ctx);                                        // the water is INSIDE the glass ring
    ctx.save(); ctx.beginPath(); ctx.rect(ix - 2, iy - 2, iw + 4, this.surfY - iy + 2); ctx.clip();
    ctx.drawImage(im, ix, iy, iw, ih); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(ix, this.surfY, iw, ih); ctx.clip(); ctx.globalAlpha = 0.5;
    ctx.drawImage(im, ix, iy, iw, ih); ctx.restore();

    const r = TUBE_R * s * 0.72;                                     // bore radius
    // riser: water front climbing / draining
    if (this.jPath && this.jFill > 0) this.tubeWater(ctx, this.jPath, 0, this.jFill * this.jPath.length, r, this.jPh * 1.2, this.jV > 0 && this.pumpOn, this.jFill < 1 ? 1 : 0);
    // drain leg: above the valve, then the released column below it
    if (this.legPath) {
      const lp = this.legPath;
      if (this.legUpper > 0) this.tubeWater(ctx, lp, this.sValve * (1 - this.legUpper), this.sValve, r, this.legPh * 60 * s, this.valve > 0.25, this.legUpper < 1 ? -1 : 0);
      if (this.legF > this.legT + 0.5) this.tubeWater(ctx, lp, this.legT, this.legF, r, this.legPh * 60 * s, true, this.legF < lp.length - 0.5 ? 1 : 0);
      this.drawValve(ctx, lp);
    }
    this.drawPour(ctx, r);
  }

  /** water inside a glass tube between arclengths s0..s1, with foam streaks and a meniscus at the front */
  private tubeWater(ctx: CanvasRenderingContext2D, p: Path, s0: number, s1: number, r: number, ph: number, flowing: boolean, front: 1 | -1 | 0) {
    if (s1 - s0 < 0.5) return;
    ctx.save();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    tracePath(ctx, p, s0, s1, 0);
    ctx.lineWidth = r * 2; ctx.strokeStyle = 'rgba(22,118,222,0.8)'; ctx.stroke();
    ctx.lineWidth = r * 1.15; ctx.strokeStyle = 'rgba(80,182,255,0.6)'; ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.32); ctx.strokeStyle = 'rgba(205,240,255,0.45)'; ctx.stroke();
    if (flowing && r > 2.5) {                                       // turbulent foam streaks advected with the flow
      for (const [o, dash, a] of [[-0.45, 1.3, 0.55], [0.3, 2.1, 0.4]] as const) {
        tracePath(ctx, p, s0, s1, o * r);
        ctx.setLineDash([r * dash, r * 2.4]); ctx.lineDashOffset = -ph * (1 + o * 0.3);
        ctx.lineWidth = Math.max(1, r * 0.18); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    tracePath(ctx, p, s0, s1, -r * 0.62);                           // glass highlight seen over the water
    ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    // meniscus across the bore at a free front (none where the water is continuous)
    if (!front) { ctx.restore(); return; }
    const a = p.at(front === 1 ? s1 : s0);
    ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.ty, a.tx));
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.32, r * 0.98, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,240,255,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  /** the reservoir water: free surface with a meniscus, light lines underneath, ripples, bubbles */
  private drawRingWater(ctx: CanvasRenderingContext2D) {
    if (this.level <= 0.003) return;
    const s = this.s, [cx, cy] = this.M(RING_IN.cx, RING_IN.cy);
    const rx = RING_IN.rx * s, ry = RING_IN.ry * s, wl = this.levelY(), bot = cy + ry;
    const surf = (x: number) => wl + Math.sin(x * 0.07 + this.t * 3.1) * 1.2 + Math.sin(x * 0.024 - this.t * 1.7) * 1.4
      + (this.pumpOn && this.jFill >= 1 ? Math.sin((x - this.M(LG.spout.x, 0)[0]) * 0.18 - this.t * 9) * 1.2 * Math.exp(-Math.abs(x - this.M(LG.spout.x, 0)[0]) / (40 * s / 0.4)) : 0);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.moveTo(cx - rx, surf(cx - rx));
    for (let x = cx - rx; x <= cx + rx; x += 4) ctx.lineTo(x, surf(x));
    ctx.lineTo(cx + rx, bot + 2); ctx.lineTo(cx - rx, bot + 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, wl, 0, bot);
    g.addColorStop(0, 'rgba(150,222,255,0.62)'); g.addColorStop(0.25, 'rgba(60,165,240,0.72)'); g.addColorStop(1, 'rgba(14,92,196,0.86)');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();                                        // light lines ONLY under the surface
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(1, 2.2 * s / 0.4);
    for (let k = 0; k < 4; k++) {
      const y0 = wl + (bot - wl) * (0.18 + k * 0.2);
      ctx.beginPath();
      for (let x = cx - rx; x <= cx + rx; x += 8) {
        const y = y0 + Math.sin(x * 0.045 + this.ringPh * (1.1 + k * 0.3) + k * 2) * 3 + Math.sin(x * 0.11 - this.ringPh * 1.7) * 1.4;
        x === cx - rx ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // surface: bright meniscus line + a soft band beneath it
    ctx.beginPath();
    for (let x = cx - rx; x <= cx + rx; x += 4) x === cx - rx ? ctx.moveTo(x, surf(x)) : ctx.lineTo(x, surf(x));
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.translate(0, 3); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.stroke(); ctx.translate(0, -3);
    for (const rp of this.ringRip) {
      const rad = 3 + rp.t * 70 * s / 0.4, a = 0.7 * (1 - rp.t / 1.2);
      ctx.beginPath(); ctx.ellipse(rp.x, wl + 1, rad, rad * 0.16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const b of this.ringBub) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fillStyle = 'rgba(240,250,255,0.6)'; ctx.fill(); }
    ctx.restore();
  }

  /** the gooseneck pours into the ring: the falling sheet narrows as it accelerates (continuity) */
  private drawPour(ctx: CanvasRenderingContext2D, r: number) {
    if (this.pumpOn && this.jFill >= 1) {
      const [sx, sy] = this.M(LG.spout.x, LG.spout.y), wl = this.levelY();
      if (wl > sy + 2) {
        const v0 = 260 * this.s / 0.4, w0 = r * 0.9, n = 14;
        const half = (i: number) => {
          const y = sy + ((wl - sy) * i) / n, v = Math.sqrt(v0 * v0 + 2 * G * (y - sy));
          return { y, w: w0 * Math.sqrt(v0 / v) * (1 + 0.12 * Math.sin(y * 0.3 - this.t * 28) * (i / n)) };
        };
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const h = half(i); i ? ctx.lineTo(sx - h.w, h.y) : ctx.moveTo(sx - h.w, h.y); }
        for (let i = n; i >= 0; i--) { const h = half(i); ctx.lineTo(sx + h.w, h.y); }
        ctx.closePath();
        const g = ctx.createLinearGradient(sx - w0, 0, sx + w0, 0);
        g.addColorStop(0, 'rgba(90,180,250,0.75)'); g.addColorStop(0.45, 'rgba(235,250,255,0.95)'); g.addColorStop(1, 'rgba(60,150,235,0.8)');
        ctx.fillStyle = g; ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(230,248,255,0.95)';
    for (const p of this.jet) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }

  /** quarter-turn ball valve on the drain leg: flanged body across the tube, stem outward, orange lever
   *  (along the pipe = open, across = shut, foreshortened as it turns) */
  private drawValve(ctx: CanvasRenderingContext2D, p: Path) {
    const a = p.at(this.sValve), R = Math.max(5, TUBE_R * this.s);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.ty, a.tx));   // x' along the tube (downward), y' = −normal… (left of the flow)
    const bw = R * 1.5, bh = R * 2.7;
    ctx.fillStyle = '#8fa4b8';
    for (const fx of [-bw * 0.62, bw * 0.62]) ctx.fillRect(fx - R * 0.16, -bh * 0.56, R * 0.32, bh * 1.12);   // flanges
    const gr = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
    gr.addColorStop(0, '#5d9be0'); gr.addColorStop(0.4, '#2a6fc4'); gr.addColorStop(1, '#123f7a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, R * 0.3); ctx.fill();
    ctx.strokeStyle = 'rgba(8,30,60,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, 7); ctx.fill();   // ball housing
    // stem out to the left of the logo (−y' side when the tube runs downward)
    const side = a.ty > 0 ? 1 : -1;
    const stemEnd = side * (bh / 2 + R * 0.55);
    ctx.strokeStyle = '#c7d2dd'; ctx.lineWidth = Math.max(2, R * 0.28);
    ctx.beginPath(); ctx.moveTo(0, side * bh / 2); ctx.lineTo(0, stemEnd); ctx.stroke();
    const phi = (1 - this.valve) * Math.PI / 2, L = R * 2.6;
    const lx = L * Math.cos(phi), ly = stemEnd + side * L * 0.3 * Math.sin(phi);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c4570e'; ctx.lineWidth = Math.max(3, R * 0.5);
    ctx.beginPath(); ctx.moveTo(0, stemEnd); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = Math.max(2, R * 0.36); ctx.stroke();
    ctx.fillStyle = '#ff9d55'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.6, R * 0.26), 0, 7); ctx.fill();
    ctx.fillStyle = '#4b5d70'; ctx.beginPath(); ctx.arc(0, stemEnd, Math.max(1.4, R * 0.2), 0, 7); ctx.fill();
    ctx.restore();
  }

  private drawSurface(ctx: CanvasRenderingContext2D) {
    const W = this.W;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = this.surfaceAt(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    for (const r of this.rings) {
      for (const [v, w] of [[80, 1], [130, 0.6]] as const) {
        const rad = 4 + r.t * v, a = r.amp * w * (1 - r.t / 1.8) / Math.sqrt(1 + rad / 60);
        if (a <= 0.02) continue;
        ctx.beginPath(); ctx.ellipse(r.x, this.surfaceAt(r.x) + 2, rad, Math.min(10, 3 + rad * 0.08), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${clamp(a, 0, 0.9).toFixed(2)})`; ctx.lineWidth = 1.4; ctx.stroke();
      }
    }
  }

  /** water inside a letter: sloshing surface, light lines, bubbles, glint — masked by the glyph */
  private letterWater(l: Letter, idx: number) {
    const c = l.water, g = c.getContext('2d')!;
    const w = c.width, h = c.height;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    const lvl = h - l.pad - (h - 2 * l.pad) * 0.5;
    const tilt = Math.tan(clamp(l.th, -0.5, 0.5));
    const yS = (x: number) => lvl + (x - w / 2) * tilt + Math.sin(x * 0.12 + this.t * 4 + idx) * 1.3;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) x ? g.lineTo(x, yS(x)) : g.moveTo(x, yS(x));
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    const wg = g.createLinearGradient(0, lvl, 0, h);
    wg.addColorStop(0, 'rgba(80,175,245,0.68)'); wg.addColorStop(1, 'rgba(14,78,195,0.88)');
    g.fillStyle = wg; g.fill();
    // light lines (caustics) inside the water
    g.strokeStyle = 'rgba(200,240,255,0.35)'; g.lineWidth = 1.2;
    for (let k = 1; k <= 2; k++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 6) { const y = yS(x) + k * (h - lvl) * 0.28 + Math.sin(x * 0.09 + this.t * (2 + k) + idx) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.beginPath();
    for (let x = 0; x <= w; x += 4) x ? g.lineTo(x, yS(x)) : g.moveTo(x, yS(x));
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1.4, this.fs * 0.014); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const b of l.bub) { g.beginPath(); g.arc(b.x * w, lvl + (h - lvl) * (b.y - 0.5) * 2, Math.max(1, b.r * this.fs), 0, 7); g.fill(); }
    // travelling glint across the crystal (every ~6 s, letter by letter)
    const gt = ((this.t * 0.17) % 1) * 3 - 1 - idx * 0.12;
    if (gt > -0.3 && gt < 1.3) {
      const gx = gt * w;
      const gg = g.createLinearGradient(gx - w * 0.3, 0, gx + w * 0.3, h);
      gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gg; g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(l.mask, 0, 0);
  }

  private drawLetters(ctx: CanvasRenderingContext2D) {
    this.letters.forEach((l, idx) => {
      if (!l.shown) return;
      const sw = l.sprite.width, sh = l.sprite.height;
      const cx = l.x + l.w / 2;
      const base = this.surfaceAt(cx) + l.y;
      const tilt = Math.atan((this.surfaceAt(l.x + l.w) - this.surfaceAt(l.x)) / Math.max(1, l.w)) * 0.6;
      this.letterWater(l, idx);
      ctx.save();
      // only what is above the water is seen in air
      ctx.beginPath(); ctx.rect(l.x - l.pad - 20, base - sh - 60, sw + 40, Math.max(0, this.surfaceAt(cx) - (base - sh - 60) + 1)); ctx.clip();
      ctx.translate(cx, base); ctx.rotate(tilt); ctx.translate(-l.w / 2 - l.pad, -(sh - l.pad));
      ctx.drawImage(l.sprite, 0, 0);
      ctx.globalAlpha = 0.6; ctx.drawImage(l.water, 0, 0);   // water sloshing inside the crystal
      ctx.restore();
    });
  }

  private drawLetterReflections(ctx: CanvasRenderingContext2D) {
    for (const l of this.letters) {
      if (!l.shown) continue;
      const sh = l.sprite.height;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(l.x - l.pad + Math.sin(this.t * 1.6 + l.x) * 2, this.surfY + 4 - l.y * 0.5);
      ctx.transform(1, 0, Math.sin(this.t * 1.2 + l.x * 0.01) * 0.04, -1, 0, 0);
      ctx.drawImage(l.sprite, 0, -sh + l.pad);
      ctx.restore();
    }
  }

  private drawBuoys(ctx: CanvasRenderingContext2D, sinking: boolean) {
    const Rb = this.buoyR();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of this.buoys) {
      if ((b.sink >= 0) !== sinking) continue;
      const f = this.figures[b.i];
      if (!f) continue;
      const fadeA = b.sink >= 0 ? clamp(1 - (this.t - b.sink) / 3, 0, 1) : 1;
      ctx.globalAlpha = fadeA;
      const g = ctx.createRadialGradient(b.x - Rb * 0.35, b.y - Rb * 0.4, Rb * 0.1, b.x, b.y, Rb);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#cfeeff'); g.addColorStop(1, '#4aa3ea');
      ctx.beginPath(); ctx.arc(b.x, b.y, Rb, 0, 7); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ff6a10';
      ctx.font = `800 ${Math.round(Rb * (f.value.length > 4 ? 0.5 : 0.62))}px Sora, system-ui, sans-serif`;
      ctx.fillText(f.value, b.x, b.y + 1);
      if (b.sink < 0 && this.W >= 768) {   // phones: figures only (labels would overlap)
        const fsz = Math.round(clamp(Rb * 0.5, 11, 14));
        ctx.font = `700 ${fsz}px Sora, system-ui, sans-serif`;
        const words = f.label.split(' '), lines: string[] = [];
        let cur = '';
        for (const w of words) { const tl = cur ? cur + ' ' + w : w; if (ctx.measureText(tl).width > Rb * 4.4 && cur) { lines.push(cur); cur = w; } else cur = tl; }
        if (cur) lines.push(cur);
        ctx.fillStyle = 'rgba(4,41,79,0.85)';
        lines.slice(0, 2).forEach((ln, k) => ctx.fillText(ln, b.x + Math.sin(this.t * 1.3 + b.x * 0.02 + k) * 1.5, b.y + Rb + 14 + k * (fsz + 3)));
      }
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const p of this.parts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    for (const f of this.falls) this.dropShape(ctx, f.x, f.y, f.r, Math.min(0.6, f.vy / 1300), '');
  }

  private drawFigureDrop(ctx: CanvasRenderingContext2D) {
    const [dx, dy] = this.M(LG.drip.x, LG.drip.y);
    if (this.pendant) this.dropShape(ctx, dx, dy + this.pendant.r * 0.95, this.pendant.r, 0.08, this.figures[this.pendant.i]?.value ?? '');
    for (const d of this.fallingFig) this.dropShape(ctx, dx, d.y, d.r, Math.min(0.35, d.vy / 1600), this.figures[d.i]?.value ?? '');
  }

  private dropShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch: number, label: string) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(1 - stretch * 0.4, 1 + stretch);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.7);
    ctx.bezierCurveTo(r * 0.45, -r * 0.9, r, -r * 0.3, r, r * 0.15);
    ctx.arc(0, r * 0.15, r, 0, Math.PI);
    ctx.bezierCurveTo(-r, -r * 0.3, -r * 0.45, -r * 0.9, 0, -r * 1.7);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.2, 1, 0, r * 0.1, r * 1.3);
    g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.55, 'rgba(160,215,255,0.9)'); g.addColorStop(1, 'rgba(40,130,220,0.92)');
    if (label) { ctx.shadowColor = 'rgba(4,41,79,0.35)'; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.08; }
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = label ? 1.6 : 1; ctx.stroke();
    const fz = this.dropFont();
    if (label && r > fz * 0.95) {
      // number big, unit small below — legible on a drop that carries it
      const [num, unit] = this.splitFig(label);
      const k = clamp((r - fz * 0.95) / (fz * 0.5), 0, 1);            // fades in while the drop grows
      ctx.globalAlpha = k;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${fz}px Sora, system-ui, sans-serif`;
      const ny = unit ? r * 0.02 : r * 0.18;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(num, 0, ny); ctx.fillStyle = '#e8620a'; ctx.fillText(num, 0, ny);
      if (unit) {
        ctx.font = `700 ${Math.max(8, Math.round(fz * 0.52))}px Sora, system-ui, sans-serif`;
        ctx.fillStyle = '#0b3d75'; ctx.fillText(unit, 0, ny + fz * 0.72);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
