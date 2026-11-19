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
import { Path, Seg, buildPath, drawGlassPipe } from '../../../shared/hydraulics/hydraulics-core';

const G = 1650;                // px/s²
const WAVE_C = 300;            // travelling-wave speed along the surface (px/s)

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

export interface SceneFigure { value: string; label: string; }

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
  private tracers: { s: number; o: number; r: number }[] = [];
  private buoys: Buoy[] = [];
  private figures: SceneFigure[] = [];
  // cycle
  private phase: Phase = 'fill';
  private phaseT = 0;
  private level = 0;                // the ring starts EMPTY
  private dropsDone = 0;
  private firstCycle = true;
  private drop: { phase: 'grow' | 'fall'; t: number; y: number; vy: number; r: number; i: number } | null = null;
  private dropWait = 0.6;
  // pointer
  private drag: { x: number; y: number; t: number } | null = null;
  private wakeClock = 0;
  // assets
  private logo = new Image(); private tubes?: HTMLCanvasElement;
  private caustA: HTMLCanvasElement; private caustB: HTMLCanvasElement;
  private jPath?: Path;
  private skyC = document.createElement('canvas');
  private fxC = document.createElement('canvas');

  onTail?: (fraction: number) => void;

  constructor(private canvas: HTMLCanvasElement, private section: HTMLElement, private story: HTMLElement, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.logo.src = 'assets/brand/logo-live.webp';
    this.logo.onload = () => { this.tubes = this.buildTubes(); };
    this.caustA = this.causticTile(7); this.caustB = this.causticTile(23);
    for (let i = 0; i < 36; i++) this.tracers.push({ s: Math.random(), o: rand(-0.55, 0.55), r: rand(0.8, 2) });
    if (reduced) { this.level = 0.6; this.phase = 'hold'; this.firstCycle = false; }
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
    const font = (f: number) => `900 ${f}px "Arial Rounded MT Bold", "Varela Round", "Nunito", Arial, sans-serif`;
    const meas = document.createElement('canvas').getContext('2d')!;
    meas.font = font(100);
    const wordW100 = meas.measureText('SIGAT').width + 100 * 0.08 * 4;
    const capRatio = 0.72, kMax = 1.7;
    let s: number;
    if (narrow) s = (W * 0.42) / LG.crop.w;
    else {
      const perS = LG.crop.w + (ringSpan / (capRatio * kMax)) * (wordW100 / 100);
      s = Math.min((W - 2 * m - gap) / perS, (vh * 0.86) / LG.crop.h, 0.62);
    }
    this.s = s;
    const top = narrow ? 70 : 90;
    this.ly = top; this.lx = m - LG.crop.x * s;
    this.surfY = top + LG.surf * s;
    const avail = W - m - (m + LG.crop.w * s + gap);
    let fs = avail / (wordW100 / 100);
    const cap = ringSpan * s;
    let k = cap / (capRatio * fs);
    if (k < 1) { fs = cap / capRatio; k = 1; }
    if (k > kMax) k = kMax;
    this.fs = fs; this.k = k; this.capH = capRatio * fs * k;
    this.lettersX0 = m + LG.crop.w * s + gap + (avail - fs * wordW100 / 100) / 2;
    this.buildLetters(font(fs));
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
    this.jPath = buildPath(...this.M(J_LINE[0][0], J_LINE[0][1]), J_LINE.slice(1).map(p => ['L', ...this.M(p[0], p[1])] as Seg));
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
  private buildLetters(font: string) {
    const word = 'SIGAT';
    const meas = document.createElement('canvas').getContext('2d')!;
    meas.font = font;
    const old = this.letters;
    this.letters = [];
    let x = this.lettersX0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const w = meas.measureText(ch).width;
      const pad = Math.ceil(this.fs * 0.12);
      const cw = Math.ceil(w + pad * 2), chh = Math.ceil(this.fs * this.k * 0.78 + pad * 2);
      const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = chh; return c; };
      const glyph = (g: CanvasRenderingContext2D, ox = 0, oy = 0, stroke = false) => {
        g.save(); g.translate(pad + ox, chh - pad + oy); g.scale(1, this.k); g.font = font; g.textBaseline = 'alphabetic';
        stroke ? g.strokeText(ch, 0, 0) : g.fillText(ch, 0, 0); g.restore();
      };
      const mask = mk(); const mg = mask.getContext('2d')!; mg.fillStyle = '#000'; glyph(mg);
      // extrusion colour (deep glass)
      const depth = mk(); const dg = depth.getContext('2d')!; dg.drawImage(mask, 0, 0);
      dg.globalCompositeOperation = 'source-in';
      const dgr = dg.createLinearGradient(0, 0, 0, chh); dgr.addColorStop(0, 'rgba(60,140,225,0.7)'); dgr.addColorStop(1, 'rgba(12,60,150,0.85)');
      dg.fillStyle = dgr; dg.fillRect(0, 0, cw, chh);
      // crystal body
      const sprite = mk(); const g = sprite.getContext('2d')!;
      g.save(); g.shadowColor = 'rgba(255,255,255,0.85)'; g.shadowBlur = this.fs * 0.05;
      const lg = g.createLinearGradient(0, pad, 0, chh - pad);
      lg.addColorStop(0, 'rgba(252,255,255,0.95)'); lg.addColorStop(0.5, 'rgba(205,238,253,0.65)'); lg.addColorStop(1, 'rgba(150,212,250,0.72)');
      g.fillStyle = lg; glyph(g); g.restore();
      g.globalCompositeOperation = 'source-atop';
      // bevel: light from the top-left, inner shadow bottom-right
      g.lineJoin = 'round'; g.lineWidth = Math.max(2, this.fs * 0.05);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; glyph(g, -this.fs * 0.018, -this.fs * 0.018, true);
      g.strokeStyle = 'rgba(25,95,200,0.45)'; glyph(g, this.fs * 0.022, this.fs * 0.022, true);
      let seed = ch.charCodeAt(0) * 97 + 13;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let b = 0; b < 24; b++) {
        const bx = rnd() * cw, by = rnd() * chh * 0.55, r = this.fs * (0.008 + rnd() * 0.022);
        const rg = g.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.65, 'rgba(210,240,255,0.4)'); rg.addColorStop(1, 'rgba(60,140,225,0.55)');
        g.fillStyle = rg; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
      }
      const hg = g.createLinearGradient(0, 0, cw * 0.7, chh);
      hg.addColorStop(0, 'rgba(255,255,255,0.7)'); hg.addColorStop(0.25, 'rgba(255,255,255,0)');
      g.fillStyle = hg; g.fillRect(0, 0, cw, chh);
      g.globalCompositeOperation = 'source-over';
      g.lineWidth = Math.max(1.5, this.fs * 0.02); g.strokeStyle = 'rgba(255,255,255,0.95)'; glyph(g, 0, 0, true);
      g.lineWidth = Math.max(1, this.fs * 0.007); g.strokeStyle = 'rgba(20,85,190,0.6)'; glyph(g, 0, 0, true);
      const prev = old[i];
      this.letters.push({
        ch, x, w, pad, sprite, mask, depth, water: mk(),
        shown: prev?.shown ?? this.reduced, risen: prev?.risen ?? (this.reduced ? -100 : -1),
        y: prev?.y ?? 0, vy: prev?.vy ?? 0, th: prev?.th ?? 0, om: prev?.om ?? 0,
        bub: Array.from({ length: 8 }, () => ({ x: rand(0.15, 0.85), y: rand(0.5, 1), r: rand(0.006, 0.016), v: rand(0.08, 0.2) }))
      });
      x += w + this.fs * 0.08;
    }
  }

  private buildTubes(): HTMLCanvasElement {
    const im = this.logo, c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d')!;
    const P = (x: number, y: number) => [(x - LG.crop.x) * LG.img, y * LG.img] as const;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.lineWidth = 36 * 2.3 * LG.img;
    for (const line of [J_LINE, LEFT_LINE, MID_LINE]) {
      g.beginPath(); line.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    }
    g.globalCompositeOperation = 'source-in';
    g.drawImage(im, 0, 0);
    return c;
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
    this.buoys = this.buoys.filter(b => b.sink < 0 || this.t - b.sink < 3.5);

    for (const p of this.parts) { p.vy += G * 0.7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 0 && p.y > this.surfaceAt(p.x) + 2) p.life = 0; }
    this.parts = this.parts.filter(p => p.life > 0).slice(-320);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 1.8);
  }

  /** FILL → DROPS → HOLD → SINK → FILL … */
  private cycle(dt: number) {
    const n = Math.min(5, this.figures.length);
    switch (this.phase) {
      case 'fill':
        if (this.level >= 0.92 && this.phaseT > 0.5) { this.phase = 'drops'; this.phaseT = 0; this.dropsDone = 0; this.dropWait = 0.8; }
        break;
      case 'drops': {
        if (!this.drop && this.dropsDone < n) {
          this.dropWait -= dt;
          if (this.dropWait <= 0) this.drop = { phase: 'grow', t: 0, y: 0, vy: 0, r: 2, i: this.dropsDone };
        }
        const d = this.drop;
        if (d) {
          const [dx, dy] = this.M(LG.drip.x, LG.drip.y);
          const Rd = clamp(70 * this.s, 12, 30);
          d.t += dt;
          if (d.phase === 'grow') {
            const f = clamp(d.t / 1.3, 0, 1);
            d.r = Rd * (0.15 + 0.85 * (1 - (1 - f) * (1 - f)));   // pendant drop swells (Tate)
            d.y = dy + d.r * 1.15;
            if (f >= 1) { d.phase = 'fall'; d.vy = 30; }
          } else {
            d.vy += G * dt; d.y += d.vy * dt;
            if (d.y + d.r * 0.6 >= this.surfaceAt(dx)) {
              this.wave.splash(dx, 700, 30);
              this.rings.push({ x: dx, t: 0, amp: 1 });
              for (let k = 0; k < 18; k++) { const a = -Math.PI / 2 + rand(-1.1, 1.1), sp = rand(100, 280); this.parts.push({ x: dx, y: this.surfY - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1, 2.6), life: 1 }); }
              // the wave that travels to the letters (and reveals letter i on the first cycle)
              this.packets.push({ x0: dx, t: 0, A: 9, dir: 1, reveal: this.firstCycle ? d.i : -1 });
              this.packets.push({ x0: dx, t: 0, A: 6, dir: -1, reveal: -1 });
              this.level = Math.max(0, this.level - 0.92 / n);        // one drop's worth drains the ring
              const old = this.buoys.find(b => b.i === d.i);
              if (old) { old.vy -= 160; old.sink = -1; }
              else this.buoys.push({ i: d.i, x: dx, y: this.surfY, vy: 0, sink: -1 });
              this.dropsDone++;
              this.dropWait = 1.0;
              this.drop = null;
            }
          }
        } else if (this.dropsDone >= n && n) { this.phase = 'hold'; this.phaseT = 0; this.firstCycle = false; }
        break;
      }
      case 'hold':
        if (this.phaseT > 5 && !this.reduced) { this.phase = 'sink'; this.phaseT = 0; }
        break;
      case 'sink': {
        // floats lose buoyancy one after the other
        this.buoys.forEach((b, i) => { if (b.sink < 0 && this.phaseT > i * 0.45) { b.sink = this.t; b.vy += 40; } });
        if (this.phaseT > this.buoys.length * 0.45 + 1.2) { this.phase = 'fill'; this.phaseT = 0; }
        break;
      }
    }
  }

  /** pump runs only during FILL; the gooseneck jet + water climbing the J */
  private reservoir(dt: number) {
    const pumpOn = this.phase === 'fill' && this.phaseT > 0.4;
    if (pumpOn) {
      this.level = Math.min(1, this.level + 0.2 * dt);
      const [sx, sy] = this.M(LG.spout.x, LG.spout.y);
      for (let q = 0; q < 2; q++) this.jet.push({ x: sx + rand(-1.5, 1.5), y: sy, vx: rand(-6, 6), vy: rand(20, 60), r: rand(0.8, 1.8), life: 1 });
      for (const tr of this.tracers) { tr.s += (110 * dt) / Math.max(1, this.jPath?.length ?? 1); if (tr.s > 1) tr.s -= 1; }
    }
    const wl = this.levelY();
    for (const p of this.jet) {
      p.vy += G * 0.55 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y >= wl) { p.life = 0; if (Math.random() < 0.2) this.ringRip.push({ x: p.x, t: 0, amp: 1 }); if (Math.random() < 0.4) this.ringBub.push({ x: p.x + rand(-4, 4), y: wl + rand(4, 20), vx: 0, vy: 0, r: rand(0.6, 1.8), life: 1 }); }
    }
    this.jet = this.jet.filter(p => p.life > 0).slice(-120);
    for (const b of this.ringBub) { b.y -= (12 + b.r * 9) * dt; if (b.y <= wl + 1) b.life = 0; }
    this.ringBub = this.ringBub.filter(b => b.life > 0).slice(-80);
    for (const r of this.ringRip) r.t += dt;
    this.ringRip = this.ringRip.filter(r => r.t < 1.2);
  }

  private get pumpOn() { return this.phase === 'fill' && this.phaseT > 0.4; }
  private levelY(): number { return this.M(0, LG.ringBottom - (LG.ringBottom - LG.full) * this.level)[1]; }
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
    ctx.save(); ctx.beginPath(); ctx.rect(ix - 2, iy - 2, iw + 4, this.surfY - iy + 2); ctx.clip();
    ctx.drawImage(im, ix, iy, iw, ih); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(ix, this.surfY, iw, ih); ctx.clip(); ctx.globalAlpha = 0.5;
    ctx.drawImage(im, ix, iy, iw, ih); ctx.restore();

    // ring reservoir — variable level over the painted water
    const [icx, icy] = this.M(LG.inner.cx, LG.inner.cy);
    const irx = LG.inner.rx * s * 0.9, iry = LG.inner.ry * s * 0.86;
    const wl = this.levelY(), art = this.M(0, LG.art)[1];
    ctx.save();
    ctx.beginPath(); ctx.ellipse(icx, icy, irx, iry, 0, 0, Math.PI * 2); ctx.clip();
    if (wl > art) ctx.drawImage(this.skyC, ix / 2, (art - 10 * s) / 2, iw / 2, (wl - art + 10 * s) / 2, ix, art - 10 * s, iw, wl - art + 10 * s);
    else { const g = ctx.createLinearGradient(0, wl, 0, art); g.addColorStop(0, 'rgba(120,200,250,0.55)'); g.addColorStop(1, 'rgba(60,160,235,0.6)'); ctx.fillStyle = g; ctx.fillRect(icx - irx, wl, irx * 2, art - wl + 2); }
    if (this.level > 0.02) {
      ctx.beginPath();
      for (let x = icx - irx; x <= icx + irx; x += 4) {
        const y = wl + Math.sin(x * 0.07 + this.t * 3.1) * 1.3 + Math.sin(x * 0.025 - this.t * 1.7) * 1.4;
        x === icx - irx ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    for (const r of this.ringRip) {
      const rad = 3 + r.t * 70 * s / 0.4, a = 0.7 * (1 - r.t / 1.2);
      ctx.beginPath(); ctx.ellipse(r.x, wl + 1, rad, rad * 0.16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const b of this.ringBub) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fillStyle = 'rgba(240,250,255,0.55)'; ctx.fill(); }
    ctx.restore();
    if (this.tubes) { ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, this.surfY - iy); ctx.clip(); ctx.drawImage(this.tubes, ix, iy, iw, ih); ctx.restore(); }
    if (this.pumpOn && this.jPath) {
      ctx.fillStyle = 'rgba(240,252,255,0.85)';
      for (const tr of this.tracers) {
        const a = this.jPath.at(tr.s * this.jPath.length);
        const o = tr.o * this.mainR * 0.8;
        const x = a.x + a.nx * o, y = a.y + a.ny * o;
        if (y > this.surfY) continue;
        ctx.beginPath(); ctx.arc(x, y, tr.r, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(230,248,255,0.95)';
    for (const p of this.jet) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
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
    const lvl = h - l.pad - (h - 2 * l.pad) * 0.56;
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
      for (let d = 8; d >= 1; d--) { ctx.globalAlpha = 0.18 + 0.08 * (8 - d); ctx.drawImage(l.depth, d * 1.3, d * 1.05); } // 3D extrusion
      ctx.globalAlpha = 1;
      ctx.drawImage(l.sprite, 0, 0);
      ctx.globalAlpha = 0.95; ctx.drawImage(l.water, 0, 0);
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
    const d = this.drop;
    if (!d) return;
    const [dx] = this.M(LG.drip.x, LG.drip.y);
    this.dropShape(ctx, dx, d.y, d.r, d.phase === 'fall' ? Math.min(0.35, d.vy / 1600) : 0.08, this.figures[d.i]?.value ?? '');
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
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1; ctx.stroke();
    if (label && r > 10) {
      ctx.fillStyle = '#e8620a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(r * (label.length > 4 ? 0.5 : 0.7))}px Sora, system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.2);
    }
    ctx.restore();
  }
}
