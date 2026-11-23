import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  NgZone,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import {
  GRAVITY,
  WaveSurface,
  clamp,
  drawWater,
  lerp,
  rand,
  smooth,
} from '../../../shared/hydro/hydro-physics';

/* ======================================================================
   PROJECTS HERO — the installation (moved here from Home at the owner's request)
   Side-elevation of a real DN200 / PN16 potable-water outlet:
   béton + manchette d'ancrage → manomètre glycérine → vanne à opercule
   → joint de démontage → coude 90° → manchette bride-bout uni → bassin.
   Canvas: hardware + water only. Copy lives in HTML above the canvas.
====================================================================== */

interface Drop { x: number; y: number; vx: number; vy: number; life: number; r: number }
interface Drip { x: number; y: number; vy: number; life: number; r: number }
interface Bub { x: number; y: number; vy: number; life: number; r: number; ph: number }
interface Foam { x: number; y: number; vx: number; vy: number; life: number; r: number }
interface Ripple { x: number; y: number; R: number; life: number; maxR: number }

/** RAL 5005 epoxy DI + stainless + brass. */
const C = {
  rim: '#8ec8f4',
  hi: '#4ea3e0',
  body: '#1a66c4',
  mid: '#14539e',
  dark: '#0c3870',
  shad: '#061e40',
  bolt: '#c9d6e2',
  boltDk: '#6a8294',
  nut: '#a8bcc8',
  steel: '#c2d4e2',
  steelHi: '#e8f2f8',
  steelDk: '#4a6574',
  epdm: '#141414',
  brass: '#c48a12',
  brassHi: '#e8b42a',
  brassDk: '#7a5608',
  wheelRim: '#c62828',
  wheelSp: '#1c1c1c',
  wheelHi: '#ef5350',
};

interface Layout {
  pR: number; pY: number;
  wallX: number; wallW: number;
  sleeveX1: number; sleeveX2: number;
  gaugeX: number;
  valveX: number; valveW: number; valveH: number;
  jointX: number; jointW: number;
  elbowX: number; elbowR: number;
  nozzleX: number; nozzleY0: number; nozzleY1: number;
  basinY: number;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function computeLayout(W: number, H: number, mob: boolean): Layout {
  let pR = mob ? 22 : 32;
  const wallX = mob ? 26 : clamp(W * 0.05, 48, 96);      // reservoir (seen in section) left of the wall
  const wallW = mob ? 34 : 56;
  const fit = (r: number) =>
    wallX + wallW + r * 5.0 + 8 + r * 3.15 + r * 2.25 + r * 2.05 + r;
  const maxX = mob ? W * 0.86 : W * 0.54;
  while (pR > 15 && fit(pR) > maxX) pR -= 1;

  // phones: the installation sits in the band under the copy (440 px at the bottom of the section)
  const pY = mob ? Math.max(H * 0.5, H - 330) : H * 0.38;
  const sleeveX1 = wallX + wallW;
  const sleeveX2 = sleeveX1 + pR * 5.0;
  const gaugeX = sleeveX1 + (sleeveX2 - sleeveX1) * 0.55;
  const valveX = sleeveX2 + 2;
  const valveW = pR * 3.15;
  const valveH = pR * 3.7;
  const jointX = valveX + valveW;
  const jointW = pR * 2.25;
  const elbowX = jointX + jointW;
  const elbowR = pR * 2.05;
  const nozzleX = elbowX + elbowR;
  const nozzleY0 = pY + elbowR;
  const basinY = mob ? Math.max(H * 0.78, H - 90) : H * 0.78;
  const nozzleY1 = mob ? basinY - pR * 3.5 : Math.min(basinY - pR * 1.15, H * 0.70);

  return {
    pR, pY, wallX, wallW, sleeveX1, sleeveX2, gaugeX,
    valveX, valveW, valveH, jointX, jointW,
    elbowX, elbowR, nozzleX, nozzleY0, nozzleY1, basinY,
  };
}

@Component({
  selector: 'app-projects-tap-hero',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section #sec class="hx-tap hx-tap--hero" id="projects-hero" (pointerdown)="onScene($event)">
      <canvas #cv class="tap2d-canvas" aria-hidden="true"></canvas>

      <div class="hx-tap__copy">
        <p class="hx-eyebrow hx-eyebrow--light">{{ 'pj_hero_kicker' | translate }}</p>
        <h1 class="hx-tap__title hx-display">{{ 'pj_hero_title' | translate }}</h1>
        <p class="hx-lead">{{ 'pj_hero_sub' | translate }}</p>
        <dl class="hx-tap__facts">
          <div><dt>{{ count() }}</dt><dd>{{ 'pj_fact_projects' | translate }}</dd></div>
          <div><dt>{{ regions() }}</dt><dd>{{ 'pj_fact_regions' | translate }}</dd></div>
          <div><dt>2010</dt><dd>{{ 'pj_fact_since' | translate }}</dd></div>
        </dl>
        <button type="button" class="hx-btn hx-btn--primary" (click)="onTapClick($event)"
                (mouseenter)="wantOpen(true)" (mouseleave)="wantOpen(false)" (focus)="wantOpen(true)" (blur)="wantOpen(false)">
          {{ (open() ? 'pj_hero_cta_close' : 'pj_hero_cta') | translate }}
          <i class="fa-solid fa-faucet-drip" aria-hidden="true"></i>
        </button>
      </div>
    </section>
  `,
})
export class ProjectsTapHeroComponent implements AfterViewInit, OnDestroy {
  readonly count = input(0);
  readonly regions = input(0);
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;

  readonly open = signal(false);
  private off?: () => void;

  private ctx!: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private mob = false;
  private L!: Layout;

  /** 1 m = 170 css-px → GRAVITY 1650 matches 9.81 m/s². */
  private readonly M2PX = 170;
  private readonly HHEAD = 4.5;

  private alpha = 0;
  private alphaTarget = 0;
  private v0px = 0;
  private streamFlow = 0;
  private wheelAngle = 0;
  private needle = 0;
  private hammer = -1;
  private hammerA = 0;
  private hover = false;
  private manual = false;
  private demoUntil = -1;
  private clock = 0;
  private dripClock = 0.4;
  private flowT = 0;
  private ringClock = 0;

  private drops: Drop[] = [];
  private drips: Drip[] = [];
  private bubbles: Bub[] = [];
  private foam: Foam[] = [];
  private ripples: Ripple[] = [];

  private readonly wave = new WaveSurface({ columns: 300, speed: 300, stiffness: 8, damping: 1.6 });

  private wallTex?: HTMLCanvasElement;
  private wallKey = '';

  ngAfterViewInit(): void {
    this.ctx = this.cv.nativeElement.getContext('2d')!;
    this.wave.swell = 4;
    this.off = this.ticker.register(this.sec.nativeElement, (dt, t) => this.tick(dt, t));
  }
  ngOnDestroy(): void { this.off?.(); }

  @HostListener('window:resize')
  onResize(): void { this.W = 0; }

  onTapClick(e: Event): void {
    e.preventDefault();
    this.manual = true;
    this.toggleValve();
  }

  onScene(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('a,button')) return;
    this.manual = true;
    this.toggleValve();
  }

  wantOpen(v: boolean): void {
    if (this.manual) return;
    this.hover = v;
    this.alphaTarget = v || this.open() ? 1 : 0;
  }

  private toggleValve(): void {
    const next = !this.open();
    this.open.set(next);
    this.alphaTarget = next ? 1 : 0;
    this.hover = false;
  }

  // ══════════════════════════════════════════════════════════════════
  private tick(dt: number, t: number): void {
    const cv = this.cv.nativeElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = cv.getBoundingClientRect();
    const W = Math.max(1, Math.round(box.width));
    const H = Math.max(1, Math.round(box.height));
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.W !== W || this.H !== H) {
      this.W = W; this.H = H;
      this.mob = W < 768;
      this.L = computeLayout(W, H, this.mob);
    }
    const L = this.L;
    this.wave.resize(W);

    if (this.demoUntil < 0 && dt > 0 &&
        this.sec.nativeElement.getBoundingClientRect().top < window.innerHeight * 0.5) {
      this.demoUntil = this.clock;
      this.zone.run(() => this.open.set(true));
    }

    const want = this.open() || this.hover || (this.demoUntil > 0 && this.clock < this.demoUntil) ? 1 : 0;
    const prev = this.alpha;
    const rate = want > this.alpha ? 1.35 : 2.8;
    this.alphaTarget = want;
    this.alpha = clamp(this.alpha + Math.sign(this.alphaTarget - this.alpha) * rate * dt, 0, 1);
    if (Math.abs(this.alpha - this.alphaTarget) < 0.002) this.alpha = this.alphaTarget;

    this.streamFlow = lerp(this.streamFlow, this.alpha > 0.02 ? this.alpha * this.alpha : 0, Math.min(1, dt * 6));
    if (this.streamFlow < 0.003) this.streamFlow = 0;

    const closing = dt > 1e-4 ? (prev - this.alpha) / dt : 0;
    if (this.alpha === 0 && prev > 0 && this.streamFlow > 0.05 && closing > 1.4) {
      this.hammer = 0;
      this.hammerA = Math.min(1, this.streamFlow * 1.5);
    }
    if (this.hammer >= 0) {
      this.hammer += dt;
      if (this.hammer > 2.2) this.hammer = -1;
    }

    this.wheelAngle = lerp(this.wheelAngle, -this.alpha * Math.PI * 6, Math.min(1, dt * 2.2));

    const cd = 0.15 + 0.70 * smooth(this.alpha);
    this.v0px = cd * Math.sqrt(2 * 9.81 * this.HHEAD) * this.M2PX;

    // Upstream tapping: static head, friction drop ∝ Q², Joukowsky ring on slam.
    const staticNeedle = Math.PI * 1.12;
    const drop = this.streamFlow * this.streamFlow * Math.PI * 0.22;
    let nTarget = staticNeedle - drop;
    if (this.hammer >= 0) {
      nTarget += this.hammerA * 0.55 * Math.exp(-this.hammer * 3.2) * Math.cos(this.hammer * 28);
    }
    this.needle = lerp(this.needle, nTarget, Math.min(1, dt * 8));

    if (dt > 0) {
      this.clock += dt;
      this.flowT += dt * (0.12 + this.streamFlow);
      this.wave.step(dt);
    }

    this.dripClock -= dt;
    if (this.streamFlow < 0.08 && this.dripClock <= 0) {
      this.dripClock = lerp(0.28, 1.35, 1 - this.streamFlow * 10) + rand(-0.08, 0.08);
      this.drips.push({ x: L.nozzleX, y: L.nozzleY1, vy: 16, life: 1, r: rand(2.8, 4.6) });
    }

    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#052338');
    bg.addColorStop(0.45, '#07345e');
    bg.addColorStop(1, '#0a2a4d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(L.nozzleX * 0.55, L.pY, 0, L.nozzleX * 0.55, L.pY, Math.min(W, H) * 0.55);
    glow.addColorStop(0, 'rgba(40,120,210,0.16)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    this.drawContactShadow(ctx, L);
    this.drawPipeline(ctx, L, t);
    this.stepParticles(dt, L);
    if (this.streamFlow > 0.02) this.drawJet(ctx, L, t);
    this.drawBasin(ctx, L, t);
    this.drawDrips(ctx, L, dt);
    this.drawRipples(ctx);
  }

  private drawContactShadow(ctx: CanvasRenderingContext2D, L: Layout): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse((L.sleeveX1 + L.elbowX) * 0.5, L.pY + L.pR + 10, (L.elbowX - L.sleeveX1) * 0.48, L.pR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPipeline(ctx: CanvasRenderingContext2D, L: Layout, t: number): void {
    this.dConcrete(ctx, L);
    this.cylH(ctx, L.sleeveX1 - 2, L.elbowX + 2, L.pY, L.pR);
    this.dPipeWater(ctx, L);
    this.dManchette(ctx, L);
    this.dGateValve(ctx, L);
    this.dDismantlingJoint(ctx, L);
    this.dElbow(ctx, L);
    this.dVertNozzle(ctx, L);
    this.dGauge(ctx, L, t);
  }

  // ── cylinders ────────────────────────────────────────────────────
  private cylH(ctx: CanvasRenderingContext2D, x1: number, x2: number, cy: number, r: number): void {
    if (x2 <= x1) return;
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, C.rim);
    g.addColorStop(0.07, C.hi);
    g.addColorStop(0.22, C.body);
    g.addColorStop(0.55, C.mid);
    g.addColorStop(0.86, C.dark);
    g.addColorStop(1, C.shad);
    ctx.fillStyle = g;
    ctx.fillRect(x1, cy - r, x2 - x1, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x1, cy - r * 0.94, x2 - x1, r * 0.14);
    ctx.fillStyle = 'rgba(160,210,255,0.08)';
    ctx.fillRect(x1, cy - r * 0.42, x2 - x1, r * 0.07);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(x1, cy + r * 0.72, x2 - x1, r * 0.28);
  }

  private cylV(ctx: CanvasRenderingContext2D, cx: number, y1: number, y2: number, r: number): void {
    if (y2 <= y1) return;
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, C.shad);
    g.addColorStop(0.08, C.dark);
    g.addColorStop(0.28, C.mid);
    g.addColorStop(0.52, C.body);
    g.addColorStop(0.72, C.hi);
    g.addColorStop(0.88, C.body);
    g.addColorStop(1, C.dark);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, y1, r * 2, y2 - y1);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(cx - r * 0.72, y1, r * 0.18, y2 - y1);
  }

  // ── 1. Reservoir (cut) → bellmouth → wall sleeve through the concrete → puddle flange ───
  private dConcrete(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { wallX, wallW, pY, pR } = L, H = this.H, bR = pR * 0.7, f = this.streamFlow;
    // reservoir water behind the wall, level well above the intake (that head drives the flow)
    const lvl = pY - pR * 4.2;
    const rg = ctx.createLinearGradient(0, lvl, 0, H);
    rg.addColorStop(0, 'rgba(110,200,255,0.9)'); rg.addColorStop(0.25, 'rgba(26,110,200,0.95)'); rg.addColorStop(1, '#0b4c91');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(0, lvl);
    for (let x = 0; x <= wallX; x += 4) ctx.lineTo(x, lvl + Math.sin(x * 0.15 + this.clock * 2.2) * 1.2);
    ctx.lineTo(wallX, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(230,248,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= wallX; x += 4) { const y = lvl + Math.sin(x * 0.15 + this.clock * 2.2) * 1.2; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    // streamlines converging on the intake while it draws
    if (f > 0.05) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, lvl + 2, wallX, H); ctx.clip();
      for (let i = 0; i < 4; i++) {
        const y0 = pY + (i - 1.5) * pR * 1.4, ph = (this.flowT * 0.9 + i * 0.27) % 1;
        const x = ph * wallX, y = y0 + (pY - y0) * ph * ph, q = Math.max(0, ph - 0.12);
        ctx.strokeStyle = `rgba(200,236,255,${0.45 * f * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 10, y0 + (pY - y0) * q * q); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }
    // the wall, cut through (section hatching)
    const key = `${wallW}|${H}|${pY}|${pR}`;
    if (!this.wallTex || this.wallKey !== key) {
      this.wallKey = key;
      this.wallTex = this.bakeWall(wallW, H, pY, pR);
    }
    ctx.drawImage(this.wallTex, wallX, 0, wallW, H);
    ctx.fillStyle = '#d9d4c8'; ctx.fillRect(wallX - 3, 0, wallW + 6, 3);
    // bellmouth on the reservoir face: the flare guides the water in without separation
    ctx.fillStyle = '#3d5466';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(wallX + 2, pY + sgn * pR); ctx.quadraticCurveTo(wallX - 2, pY + sgn * pR, wallX - 8, pY + sgn * pR * 1.55);
      ctx.lineTo(wallX - 12, pY + sgn * pR * 1.55); ctx.quadraticCurveTo(wallX - 6, pY + sgn * bR, wallX + 2, pY + sgn * bR);
      ctx.closePath(); ctx.fill();
    }
    // wall sleeve (steel) through the concrete, cut open: the water is visible inside it
    ctx.fillStyle = '#56697a'; ctx.fillRect(wallX, pY - pR, wallW, pR - bR); ctx.fillRect(wallX, pY + bR, wallW, pR - bR);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(wallX, pY - pR, wallW, 2);
    this.dBoreH(ctx, wallX - 6, wallX + wallW + 2, pY, bR, 1, 1);
    // puddle flange plate on the outer face (anchors the sleeve, stops seepage along it)
    const fR = pR * 1.72, px = wallX + wallW - 6;
    const fg = ctx.createLinearGradient(px - 8, pY - fR, px + 6, pY + fR);
    fg.addColorStop(0, '#9aa8b4'); fg.addColorStop(0.4, '#6d7e8c'); fg.addColorStop(1, '#3a4a56');
    ctx.fillStyle = fg; ctx.fillRect(px - 7, pY - fR, 14, fR * 2);
    ctx.strokeStyle = 'rgba(10,20,30,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(px - 7, pY - fR, 14, fR * 2);
    for (const k of [-0.82, -0.42, 0.42, 0.82]) this.hexBolt(ctx, px + 1, pY + k * fR, 5);
  }

  private bakeWall(w: number, h: number, pY: number, pR: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d')!;
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, '#8c8a82');
    lg.addColorStop(0.45, '#6e6c64');
    lg.addColorStop(1, '#4a4840');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,38,32,0.18)';
    g.lineWidth = 1;
    for (let y = 18; y < h; y += 28) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 3.1) * w;
      const y = hash(i * 7.7) * h;
      g.fillStyle = `rgba(${40 + hash(i) * 40 | 0},${38 + hash(i + 2) * 36 | 0},${32 + hash(i + 4) * 30 | 0},${0.12 + hash(i + 5) * 0.16})`;
      g.beginPath();
      g.arc(x, y, 0.6 + hash(i + 9) * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(30,28,24,${0.12 + hash(i + 40) * 0.16})`;
      g.beginPath();
      const x = 2 + hash(i + 11) * (w - 4);
      const y = 8 + hash(i + 21) * (h - 16);
      g.moveTo(x, y);
      g.lineTo(x + (hash(i + 31) - 0.5) * 10, y + (hash(i + 41) - 0.5) * 8);
      g.stroke();
    }
    g.strokeStyle = 'rgba(30,28,24,0.16)'; g.lineWidth = 1;          // section hatching: the wall is cut
    for (let k = -h; k < w + h; k += 9) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
    const stain = g.createRadialGradient(w, pY, pR, w, pY, pR * 4);
    stain.addColorStop(0, 'rgba(30,50,70,0.22)');
    stain.addColorStop(1, 'transparent');
    g.fillStyle = stain;
    g.fillRect(0, 0, w, h);
    const edge = g.createLinearGradient(w - 8, 0, w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = edge;
    g.fillRect(w - 8, 0, 8, h);
    return c;
  }

  // ── water in bore ────────────────────────────────────────────────
  private dPipeWater(ctx: CanvasRenderingContext2D, L: Layout): void {
    const bR = L.pR * 0.70;
    this.dBoreH(ctx, L.sleeveX1, L.valveX + 8, L.pY, bR, 1, 1);
    if (this.streamFlow > 0.01) {
      this.dBoreH(ctx, L.valveX + L.valveW - 8, L.elbowX, L.pY, bR, this.streamFlow, 1);
      this.dBoreV(ctx, L.nozzleX, L.nozzleY0, L.nozzleY1, bR, this.streamFlow);
    }
  }

  private dBoreH(ctx: CanvasRenderingContext2D, x1: number, x2: number, pY: number, bR: number, a: number, dir: number): void {
    if (x2 <= x1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x1, pY - bR, x2 - x1, bR * 2); ctx.clip();
    const wg = ctx.createLinearGradient(0, pY - bR, 0, pY + bR);
    wg.addColorStop(0, `rgba(150,220,255,${0.88 * a})`);
    wg.addColorStop(0.4, `rgba(50,150,230,${0.92 * a})`);
    wg.addColorStop(1, `rgba(8,55,140,${0.90 * a})`);
    ctx.fillStyle = wg;
    ctx.fillRect(x1, pY - bR, x2 - x1, bR * 2);
    const span = x2 - x1 + 60;
    for (let i = 0; i < 3; i++) {
      const fy = pY - bR * 0.38 + i * bR * 0.34;
      const off = ((this.flowT * dir * (50 + i * 22) + i * 40) % span) - 30;
      ctx.strokeStyle = `rgba(210,240,255,${(0.28 - i * 0.07) * a})`;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(x1 + off, fy);
      ctx.bezierCurveTo(x1 + off + 10, fy - 1.2, x1 + off + 18, fy + 1.2, x1 + off + 28, fy);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.2 * a})`;
    ctx.lineWidth = bR * 0.18;
    ctx.beginPath(); ctx.moveTo(x1, pY - bR * 0.32); ctx.lineTo(x2, pY - bR * 0.32); ctx.stroke();
    ctx.restore();
  }

  private dBoreV(ctx: CanvasRenderingContext2D, nx: number, y0: number, y1: number, bR: number, a: number): void {
    ctx.save();
    ctx.beginPath(); ctx.rect(nx - bR, y0, bR * 2, y1 - y0); ctx.clip();
    const wg = ctx.createLinearGradient(nx - bR, 0, nx + bR, 0);
    wg.addColorStop(0, `rgba(6,40,110,${0.85 * a})`);
    wg.addColorStop(0.35, `rgba(50,150,230,${0.92 * a})`);
    wg.addColorStop(0.58, `rgba(160,225,255,${0.90 * a})`);
    wg.addColorStop(1, `rgba(6,40,110,${0.85 * a})`);
    ctx.fillStyle = wg;
    ctx.fillRect(nx - bR, y0, bR * 2, y1 - y0);
    const span = y1 - y0 + 50;
    for (let i = 0; i < 3; i++) {
      const fx = nx - bR * 0.4 + i * bR * 0.4;
      const off = ((this.flowT * 80 + i * 28) % span) - 20;
      ctx.strokeStyle = `rgba(210,240,255,${0.22 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx, y0 + off); ctx.lineTo(fx, y0 + off + 20); ctx.stroke();
    }
    ctx.restore();
  }

  // ── flanges / bolts ──────────────────────────────────────────────
  private dFlange(ctx: CanvasRenderingContext2D, cx: number, pY: number, pR: number, hw: number): void {
    const fR = pR * 1.55;
    const fg = ctx.createLinearGradient(cx - hw, pY - fR, cx + hw, pY + fR);
    fg.addColorStop(0, C.rim);
    fg.addColorStop(0.22, C.hi);
    fg.addColorStop(0.5, C.body);
    fg.addColorStop(0.82, C.dark);
    fg.addColorStop(1, C.shad);
    ctx.fillStyle = fg;
    ctx.beginPath();
    this.rr(ctx, cx - hw, pY - fR, hw * 2, fR * 2, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,16,36,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(cx - hw, pY - fR, hw * 2, fR * 0.16);
    this.cylH(ctx, cx - hw, cx + hw, pY, pR);
    ctx.strokeStyle = C.epdm;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx, pY - pR); ctx.lineTo(cx, pY + pR); ctx.stroke();
  }

  private dBolts(ctx: CanvasRenderingContext2D, cx: number, pY: number, pR: number, side: 'left' | 'right'): void {
    const fR = pR * 1.55;
    const bx = side === 'right' ? cx + 5.5 : cx - 5.5;
    for (const s of [-0.84, -0.46, 0.46, 0.84]) this.hexBolt(ctx, bx, pY + s * fR, Math.max(3.2, pR * 0.13));
  }

  private hexBolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * (Math.PI / 3);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const hg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    hg.addColorStop(0, C.steelHi);
    hg.addColorStop(0.45, C.bolt);
    hg.addColorStop(1, C.boltDk);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = C.boltDk;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.steelDk;
    ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  // ── 4. Manchette ─────────────────────────────────────────────────
  private dManchette(ctx: CanvasRenderingContext2D, L: Layout): void {
    this.dFlange(ctx, L.sleeveX1, L.pY, L.pR, 9);
    this.dBolts(ctx, L.sleeveX1, L.pY, L.pR, 'left');
    this.dFlange(ctx, L.sleeveX2, L.pY, L.pR, 9);
    this.dBolts(ctx, L.sleeveX2, L.pY, L.pR, 'right');
  }

  // ── 5. Gate valve ────────────────────────────────────────────────
  private dGateValve(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { pR, pY, valveX, valveW, valveH } = L;
    this.dFlange(ctx, valveX, pY, pR, 10);
    this.dFlange(ctx, valveX + valveW, pY, pR, 10);
    this.dBolts(ctx, valveX, pY, pR, 'left');
    this.dBolts(ctx, valveX + valveW, pY, pR, 'right');

    const bx = valveX + 11;
    const bw = valveW - 22;
    const topY = pY - valveH;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx + 5, pY + pR + 4);
    ctx.lineTo(bx, pY + pR * 0.2);
    ctx.lineTo(bx + bw * 0.12, topY + 18);
    ctx.lineTo(bx + bw * 0.88, topY + 18);
    ctx.lineTo(bx + bw, pY + pR * 0.2);
    ctx.lineTo(bx + bw - 5, pY + pR + 4);
    ctx.closePath();
    const bg = ctx.createLinearGradient(bx, topY, bx + bw, pY + pR);
    bg.addColorStop(0, C.rim);
    bg.addColorStop(0.18, C.hi);
    bg.addColorStop(0.45, C.body);
    bg.addColorStop(0.78, C.mid);
    bg.addColorStop(1, C.shad);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,18,40,0.5)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    this.rr(ctx, bx + 8, topY + 18, bw - 16, 10, 3);
    ctx.fill();

    const seamY = pY - pR * 2.35;
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx + 6, seamY); ctx.lineTo(bx + bw - 6, seamY); ctx.stroke();
    for (let i = 0; i < 4; i++) this.hexBolt(ctx, bx + (bw / 5) * (i + 1), seamY - 7, 3.4);

    const cwX = bx + bw * 0.16;
    const cwW = bw * 0.68;
    const cwY = pY - pR - 1;
    const cwH = pR * 2.15;
    ctx.save();
    ctx.beginPath(); this.rr(ctx, cwX, cwY, cwW, cwH, 4); ctx.clip();
    ctx.fillStyle = '#030910';
    ctx.fillRect(cwX, cwY, cwW, cwH);

    const wg = ctx.createLinearGradient(0, cwY, 0, cwY + cwH);
    wg.addColorStop(0, 'rgba(120,205,255,0.92)');
    wg.addColorStop(0.45, 'rgba(40,140,225,0.93)');
    wg.addColorStop(1, 'rgba(8,60,145,0.90)');
    ctx.fillStyle = wg;
    ctx.fillRect(cwX, cwY, cwW * 0.5, cwH);
    if (this.streamFlow > 0.01) {
      ctx.globalAlpha = this.streamFlow;
      ctx.fillRect(cwX + cwW * 0.5, cwY, cwW * 0.5, cwH);
      ctx.globalAlpha = 1;
    }

    const wedgeW = cwW * 0.46;
    const wedgeX = cwX + (cwW - wedgeW) * 0.5;
    const lift = this.alpha * (cwH + 4);
    const wTop = cwY + cwH - lift;
    const visTop = Math.max(cwY, wTop);
    const visH = cwY + cwH - visTop;
    if (visH > 1) {
      const taper = wedgeW * 0.18 * (1 - this.alpha);
      ctx.beginPath();
      ctx.moveTo(wedgeX + taper, visTop);
      ctx.lineTo(wedgeX + wedgeW - taper, visTop);
      ctx.lineTo(wedgeX + wedgeW, visTop + visH);
      ctx.lineTo(wedgeX, visTop + visH);
      ctx.closePath();
      const eg = ctx.createLinearGradient(wedgeX, visTop, wedgeX + wedgeW, visTop + visH);
      eg.addColorStop(0, '#2c2c2c');
      eg.addColorStop(0.45, '#141414');
      eg.addColorStop(1, '#070707');
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,70,70,0.55)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const ly = visTop + visH * (i / 4);
        ctx.beginPath(); ctx.moveTo(wedgeX + 3, ly); ctx.lineTo(wedgeX + wedgeW - 3, ly); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,240,255,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); this.rr(ctx, cwX, cwY, cwW, cwH, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,30,50,0.6)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const stemCX = bx + bw * 0.5;
    const stemW = this.mob ? 4.2 : 5.4;
    const stemRise = this.alpha * pR * 1.15;
    const stemTop = topY + 2 - stemRise;
    const stemBot = pY - pR * 2.15;
    const sg = ctx.createLinearGradient(stemCX - stemW, 0, stemCX + stemW, 0);
    sg.addColorStop(0, C.steelDk);
    sg.addColorStop(0.28, C.steel);
    sg.addColorStop(0.55, C.steelHi);
    sg.addColorStop(1, C.steel);
    ctx.fillStyle = sg;
    ctx.fillRect(stemCX - stemW * 0.5, stemTop, stemW, stemBot - stemTop + 6);
    ctx.strokeStyle = 'rgba(40,60,75,0.35)';
    ctx.lineWidth = 0.7;
    for (let y = stemTop + 2; y < stemBot; y += 3.2) {
      ctx.beginPath(); ctx.moveTo(stemCX - stemW * 0.5, y); ctx.lineTo(stemCX + stemW * 0.5, y); ctx.stroke();
    }

    ctx.fillStyle = C.nut;
    ctx.fillRect(stemCX - stemW - 3, topY - 2, (stemW + 3) * 2, 11);
    ctx.strokeStyle = C.boltDk;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(stemCX - stemW - 3, topY - 2, (stemW + 3) * 2, 11);

    const hwR = this.mob ? 18 : 26;
    this.dHandwheel(ctx, stemCX, stemTop - hwR - 3, hwR, this.wheelAngle);
  }

  private dHandwheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, angle: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(2, R * 0.22, R * 0.95, R * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);

    ctx.strokeStyle = '#3a0000';
    ctx.lineWidth = R * 0.30;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    const rim = ctx.createLinearGradient(-R, -R, R, R);
    rim.addColorStop(0, C.wheelHi);
    rim.addColorStop(0.4, C.wheelRim);
    rim.addColorStop(1, '#7a1515');
    ctx.strokeStyle = rim;
    ctx.lineWidth = R * 0.24;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI * 0.75, -Math.PI * 0.28); ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 / 5) * i;
      ctx.save();
      ctx.rotate(a);
      ctx.strokeStyle = C.wheelSp;
      ctx.lineWidth = R * 0.11;
      ctx.beginPath(); ctx.moveTo(R * 0.18, 0); ctx.lineTo(R * 0.86, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(90,90,90,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(R * 0.2, -R * 0.03); ctx.lineTo(R * 0.84, -R * 0.03); ctx.stroke();
      ctx.restore();
    }

    const hub = ctx.createRadialGradient(-R * 0.08, -R * 0.08, 0, 0, 0, R * 0.3);
    hub.addColorStop(0, '#4a4a4a');
    hub.addColorStop(0.5, '#1e1e1e');
    hub.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = hub;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── 6. Dismantling joint ─────────────────────────────────────────
  private dDismantlingJoint(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { pR, pY, jointX, jointW } = L;
    this.dFlange(ctx, jointX, pY, pR, 8);
    this.dFlange(ctx, jointX + 11, pY, pR, 6);
    this.dFlange(ctx, jointX + jointW - 11, pY, pR, 6);
    this.dFlange(ctx, jointX + jointW, pY, pR, 8);
    this.dBolts(ctx, jointX, pY, pR, 'left');
    this.dBolts(ctx, jointX + jointW, pY, pR, 'right');

    const mid = jointX + jointW * 0.5;
    ctx.fillStyle = '#02080f';
    ctx.fillRect(mid - 1.2, pY - pR - 2, 2.4, pR * 2 + 4);

    for (const rOff of [pR * 0.68, -pR * 0.68]) {
      const ry = pY + rOff;
      const rg = ctx.createLinearGradient(jointX - 12, 0, jointX + jointW + 12, 0);
      rg.addColorStop(0, C.steelDk);
      rg.addColorStop(0.35, C.steel);
      rg.addColorStop(0.7, C.steelHi);
      rg.addColorStop(1, C.steelDk);
      ctx.strokeStyle = rg;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(jointX - 12, ry);
      ctx.lineTo(jointX + jointW + 12, ry);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(50,70,85,0.5)';
      ctx.lineWidth = 0.9;
      for (let tx = jointX - 10; tx < jointX + jointW + 10; tx += 3.2) {
        ctx.beginPath(); ctx.moveTo(tx, ry - 1.6); ctx.lineTo(tx + 1.2, ry + 1.6); ctx.stroke();
      }
      for (const nx of [jointX - 13, jointX - 4, jointX + jointW + 3, jointX + jointW + 12]) {
        ctx.fillStyle = C.nut;
        ctx.fillRect(nx, ry - 5, 7, 10);
        ctx.strokeStyle = C.boltDk;
        ctx.lineWidth = 0.7;
        ctx.strokeRect(nx, ry - 5, 7, 10);
        ctx.beginPath(); ctx.moveTo(nx + 3.5, ry - 5); ctx.lineTo(nx + 3.5, ry + 5); ctx.stroke();
      }
    }
  }

  // ── 7. Elbow ─────────────────────────────────────────────────────
  private dElbow(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { pR, pY, elbowX, elbowR, nozzleX, nozzleY0 } = L;
    const cx = elbowX;
    const cy = pY + elbowR;
    const outerR = elbowR + pR;
    const innerR = Math.max(2, elbowR - pR);
    ctx.save();
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      const r = innerR + u * (outerR - innerR);
      const shade =
        u < 0.08 ? C.rim :
        u < 0.22 ? C.hi :
        u < 0.45 ? C.body :
        u < 0.75 ? C.mid :
        u < 0.92 ? C.dark : C.shad;
      ctx.strokeStyle = shade;
      ctx.lineWidth = (outerR - innerR) / 28 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.5, 0, false);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = pR * 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy, elbowR + pR * 0.72, -Math.PI * 0.5, -0.08, false);
    ctx.stroke();
    ctx.restore();

    if (this.streamFlow > 0.01) {
      const bR = pR * 0.70;
      ctx.save();
      ctx.globalAlpha = this.streamFlow;
      ctx.beginPath();
      ctx.arc(cx, cy, elbowR + bR, -Math.PI * 0.5, 0, false);
      ctx.arc(cx, cy, Math.max(1, elbowR - bR), 0, -Math.PI * 0.5, true);
      ctx.closePath();
      const bg = ctx.createRadialGradient(cx, cy, Math.max(1, elbowR - bR), cx, cy, elbowR + bR);
      bg.addColorStop(0, 'rgba(8,50,130,0.92)');
      bg.addColorStop(0.45, 'rgba(55,155,235,0.92)');
      bg.addColorStop(0.7, 'rgba(170,230,255,0.88)');
      bg.addColorStop(1, 'rgba(8,50,130,0.92)');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#040c18';
      ctx.beginPath();
      ctx.arc(cx, cy, elbowR + pR * 0.70, -Math.PI * 0.5, 0, false);
      ctx.arc(cx, cy, Math.max(1, elbowR - pR * 0.70), 0, -Math.PI * 0.5, true);
      ctx.closePath();
      ctx.fill();
    }

    this.dFlange(ctx, cx, pY, pR, 10);
    this.dBolts(ctx, cx, pY, pR, 'left');

    ctx.save();
    ctx.translate(nozzleX, nozzleY0);
    ctx.rotate(Math.PI * 0.5);
    this.dFlange(ctx, 0, 0, pR, 10);
    ctx.restore();
    const fR = pR * 1.55;
    for (const s of [-0.84, -0.46, 0.46, 0.84]) this.hexBolt(ctx, nozzleX + s * fR, nozzleY0 - 5.5, Math.max(3.2, pR * 0.13));
  }

  // ── 8. Vertical nozzle ───────────────────────────────────────────
  private dVertNozzle(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { pR, nozzleX, nozzleY0, nozzleY1 } = L;
    if (nozzleY1 - nozzleY0 <= 2) return;
    this.cylV(ctx, nozzleX, nozzleY0, nozzleY1 - pR * 0.42, pR);

    const tH = pR * 0.48;
    const y = nozzleY1;
    ctx.beginPath();
    ctx.moveTo(nozzleX - pR, y - tH);
    ctx.lineTo(nozzleX - pR + 5, y);
    ctx.lineTo(nozzleX + pR - 5, y);
    ctx.lineTo(nozzleX + pR, y - tH);
    ctx.closePath();
    const tg = ctx.createLinearGradient(nozzleX - pR, 0, nozzleX + pR, 0);
    tg.addColorStop(0, C.shad);
    tg.addColorStop(0.35, C.mid);
    tg.addColorStop(0.6, C.hi);
    tg.addColorStop(1, C.dark);
    ctx.fillStyle = tg;
    ctx.fill();

    ctx.fillStyle = '#071018';
    ctx.beginPath();
    ctx.ellipse(nozzleX, y - 1, pR * 0.70, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.streamFlow > 0.02) {
      ctx.fillStyle = `rgba(140,210,255,${0.55 * this.streamFlow})`;
      ctx.beginPath();
      ctx.ellipse(nozzleX, y - 1, pR * 0.62, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 2. Glycerin gauge ────────────────────────────────────────────
  private dGauge(ctx: CanvasRenderingContext2D, L: Layout, _t: number): void {
    const { pR, pY, gaugeX } = L;
    const sadW = pR * 1.15;
    const sadH = 8;
    const sadY = pY - pR;
    const sg = ctx.createLinearGradient(0, sadY - sadH, 0, sadY);
    sg.addColorStop(0, C.hi); sg.addColorStop(1, C.dark);
    ctx.fillStyle = sg;
    ctx.beginPath(); this.rr(ctx, gaugeX - sadW * 0.5, sadY - sadH, sadW, sadH, 2); ctx.fill();
    this.hexBolt(ctx, gaugeX - sadW * 0.32, sadY - sadH * 0.5, 2.4);
    this.hexBolt(ctx, gaugeX + sadW * 0.32, sadY - sadH * 0.5, 2.4);

    const bvY = sadY - sadH;
    const bvH = 10;
    const bg = ctx.createLinearGradient(gaugeX - 5, 0, gaugeX + 5, 0);
    bg.addColorStop(0, C.brassDk); bg.addColorStop(0.4, C.brassHi); bg.addColorStop(1, C.brass);
    ctx.fillStyle = bg;
    ctx.fillRect(gaugeX - 5, bvY - bvH, 10, bvH);
    ctx.fillStyle = C.brassHi;
    ctx.fillRect(gaugeX - 6, bvY - bvH - 4, 12, 4);
    ctx.strokeStyle = C.brassDk; ctx.lineWidth = 0.8;
    ctx.strokeRect(gaugeX - 5, bvY - bvH, 10, bvH);

    const sipY = bvY - bvH - 4;
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gaugeX, sipY);
    ctx.bezierCurveTo(gaugeX + 12, sipY - 4, gaugeX + 18, sipY - 18, gaugeX + 10, sipY - 28);
    ctx.bezierCurveTo(gaugeX + 2, sipY - 38, gaugeX - 8, sipY - 38, gaugeX - 2, sipY - 48);
    ctx.stroke();
    ctx.strokeStyle = C.brassHi;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.lineCap = 'butt';

    const dR = this.mob ? 15 : 21;
    const dCX = gaugeX - 2;
    const dCY = sipY - 48 - dR;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(dCX + 2, dCY + 3, dR + 5, dR + 3, 0, 0, Math.PI * 2); ctx.fill();

    const bez = ctx.createRadialGradient(dCX - dR * 0.35, dCY - dR * 0.35, 0, dCX, dCY, dR + 5);
    bez.addColorStop(0, '#f2f6f8');
    bez.addColorStop(0.45, '#b7c8d2');
    bez.addColorStop(1, '#4a5c68');
    ctx.fillStyle = bez;
    ctx.beginPath(); ctx.arc(dCX, dCY, dR + 4.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#f7f4ea';
    ctx.beginPath(); ctx.arc(dCX, dCY, dR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(210, 190, 60, 0.12)';
    ctx.beginPath(); ctx.arc(dCX, dCY, dR, 0, Math.PI * 2); ctx.fill();

    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.75 + (Math.PI * 1.5 / 12) * i;
      const maj = i % 3 === 0;
      const len = maj ? dR * 0.22 : dR * 0.12;
      ctx.strokeStyle = maj ? '#1a1a1a' : '#7a7a7a';
      ctx.lineWidth = maj ? 1.15 : 0.7;
      ctx.beginPath();
      ctx.moveTo(dCX + Math.cos(a) * (dR - 2.2), dCY + Math.sin(a) * (dR - 2.2));
      ctx.lineTo(dCX + Math.cos(a) * (dR - 2.2 - len), dCY + Math.sin(a) * (dR - 2.2 - len));
      ctx.stroke();
    }
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dCX, dCY, dR * 0.78, Math.PI * 0.75 + Math.PI * 1.22, Math.PI * 0.75 + Math.PI * 1.5);
    ctx.stroke();

    const na = Math.PI * 0.75 + this.needle;
    ctx.save();
    ctx.translate(dCX, dCY);
    ctx.rotate(na);
    ctx.fillStyle = '#c41e1e';
    ctx.beginPath();
    ctx.moveTo(-dR * 0.18, -1.1);
    ctx.lineTo(dR * 0.76, 0);
    ctx.lineTo(-dR * 0.18, 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(dCX, dCY, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.steelHi;
    ctx.beginPath(); ctx.arc(dCX - 0.4, dCY - 0.4, 1, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.arc(dCX - dR * 0.3, dCY - dR * 0.32, dR * 0.34, 0, Math.PI * 2); ctx.fill();
  }

  // ── jet ──────────────────────────────────────────────────────────
  private drawJet(ctx: CanvasRenderingContext2D, L: Layout, t: number): void {
    const { nozzleX, nozzleY1, basinY, pR } = L;
    const v0 = Math.max(1, this.v0px * Math.max(0.15, this.streamFlow));
    const len = basinY + this.wave.offsetAt(nozzleX) + 3 - nozzleY1;   // down to the actual surface
    if (len <= 0) return;
    const R0 = pR * 0.70 * Math.sqrt(Math.max(0.12, this.streamFlow));
    const N = 64;
    const lx: number[] = [];
    const rx: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * len;
      const vy = Math.sqrt(v0 * v0 + 2 * GRAVITY * y);
      const r = R0 * Math.sqrt(v0 / vy);
      // disturbances ride down with the water (phase = y - v·t) and grow with the fall
      const turb = r * (0.04 + 0.22 * (i / N) ** 2) * Math.sin(y * 0.21 - t * 26 + 1.6 * Math.sin(y * 0.07 - t * 9));
      lx.push(nozzleX - r + turb);
      rx.push(nozzleX + r - turb);
      ys.push(nozzleY1 + y);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx[0], ys[0]);
    for (let i = 1; i <= N; i++) ctx.lineTo(lx[i], ys[i]);
    for (let i = N; i >= 0; i--) ctx.lineTo(rx[i], ys[i]);
    ctx.closePath();
    const jg = ctx.createLinearGradient(nozzleX - R0, 0, nozzleX + R0, 0);
    jg.addColorStop(0, 'rgba(18,80,180,0.55)');
    jg.addColorStop(0.22, 'rgba(70,165,255,0.82)');
    jg.addColorStop(0.5, 'rgba(210,242,255,0.95)');
    jg.addColorStop(0.78, 'rgba(70,165,255,0.82)');
    jg.addColorStop(1, 'rgba(18,80,180,0.55)');
    ctx.fillStyle = jg;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const rI = (rx[i] - lx[i]) * 0.13;
      i === 0 ? ctx.moveTo(nozzleX - rI, ys[i]) : ctx.lineTo(nozzleX - rI, ys[i]);
    }
    for (let i = N; i >= 0; i--) ctx.lineTo(nozzleX + (rx[i] - lx[i]) * 0.13, ys[i]);
    ctx.closePath();
    ctx.fillStyle = `rgba(240,252,255,${0.72 * this.streamFlow})`;
    ctx.fill();
    // aeration: the lower jet whitens as it entrains air
    ctx.beginPath();
    ctx.moveTo(lx[0], ys[0]);
    for (let i = 1; i <= N; i++) ctx.lineTo(lx[i], ys[i]);
    for (let i = N; i >= 0; i--) ctx.lineTo(rx[i], ys[i]);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, nozzleY1, 0, nozzleY1 + len);
    ag.addColorStop(0, 'rgba(255,255,255,0)'); ag.addColorStop(0.55, 'rgba(255,255,255,0.08)'); ag.addColorStop(1, `rgba(255,255,255,${0.55 * this.streamFlow})`);
    ctx.fillStyle = ag; ctx.fill();
    ctx.restore();

    if (this.streamFlow > 0.28 && Math.random() < this.streamFlow * 0.25) {
      const k = 0.62 + Math.random() * 0.28;
      this.drops.push({
        x: nozzleX + rand(-R0, R0),
        y: nozzleY1 + len * k,
        vx: rand(-40, 40),
        vy: Math.sqrt(v0 * v0 + 2 * GRAVITY * len * k),
        life: 1,
        r: rand(1.2, 2.6),
      });
    }
  }

  private drawDrips(ctx: CanvasRenderingContext2D, L: Layout, dt: number): void {
    const bs = L.basinY;
    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      d.vy += GRAVITY * dt;
      d.y += d.vy * dt;
      d.life -= 0.45 * dt;
      const stretch = clamp(d.vy / 420, 1, 2.6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life * 4);
      const dg = ctx.createRadialGradient(d.x, d.y - d.r * 0.3, 0, d.x, d.y, d.r * stretch);
      dg.addColorStop(0, 'rgba(230,250,255,0.95)');
      dg.addColorStop(0.5, 'rgba(80,170,255,0.85)');
      dg.addColorStop(1, 'rgba(30,100,210,0.55)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (d.y >= bs) {
        this.ripples.push({ x: d.x, y: bs, R: 0, life: 1, maxR: 36 + d.r * 4 });
        this.wave.splash(d.x, 90 + d.r * 12, 16);
        for (let k = 0; k < 4; k++) {
          this.drops.push({ x: d.x, y: bs, vx: rand(-55, 55), vy: -rand(40, 110), life: 1, r: rand(1, 2.4) });
        }
        this.drips.splice(i, 1);
      } else if (d.life <= 0) this.drips.splice(i, 1);
    }
  }

  private stepParticles(dt: number, L: Layout): void {
    const bs = L.basinY;
    const f = this.streamFlow;
    const nx = L.nozzleX;
    // momentum flux of the jet (per second, not per frame) + turbulent pulses: a steady dimple, not a crater
    if (f > 0.05) {
      this.wave.splash(nx, f * 520 * dt, L.pR * 1.2);
      if (Math.random() < dt * 4) this.wave.splash(nx + rand(-L.pR, L.pR), f * rand(30, 70), L.pR * 0.8);
    }
    if (f > 0.12 && Math.random() < f * 0.55) {
      this.drops.push({ x: nx + rand(-L.pR, L.pR), y: bs, vx: rand(-140, 140) * f, vy: -rand(60, 210) * f, life: 1, r: rand(1.4, 3.4) });
    }
    if (f > 0.2 && Math.random() < f * 0.28) {
      this.foam.push({ x: nx + rand(-L.pR, L.pR), y: bs + rand(-2, 5), vx: rand(-50, 50), vy: rand(-22, 8), life: 1, r: rand(2, 5) });
    }
    // air entrained at the entry is carried DOWN by the jet, slows (submerged jet), then rises at its terminal speed
    if (f > 0.1) {
      const n = Math.random() < f * 0.9 ? 2 : 0;
      for (let k = 0; k < n; k++) this.bubbles.push({ x: nx + rand(-L.pR * 0.35, L.pR * 0.35) * f, y: bs + rand(2, 10), vy: rand(140, 320) * f, life: 1, r: rand(1, 3.6), ph: Math.random() * Math.PI * 2 });
      this.ringClock -= dt;
      if (this.ringClock <= 0) { this.ringClock = rand(0.18, 0.34); this.ripples.push({ x: nx, y: bs, R: L.pR * 0.5 * f, life: 1, maxR: L.pR * rand(2.6, 3.6) }); }
    }
    this.ripples = this.ripples.filter(rp => {
      rp.R += (rp.maxR - rp.R) * Math.min(1, dt * 4);
      rp.life -= 1.2 * dt;
      return rp.life > 0;
    });
    this.drops = this.drops.filter(d => {
      d.x += d.vx * dt; d.y += d.vy * dt; d.vy += GRAVITY * dt; d.life -= dt / 1.3;
      return d.life > 0 && d.y < bs + 48;
    });
    this.foam = this.foam.filter(fd => {
      fd.x += fd.vx * dt; fd.y = bs + this.wave.offsetAt(fd.x);
      fd.vx = lerp(fd.vx, 0, dt * 3); fd.vy = lerp(fd.vy, 0, dt * 4);
      fd.life -= 0.9 * dt;
      return fd.life > 0;
    });
    this.bubbles = this.bubbles.filter(b => {
      const rise = 26 + b.r * 9;                                     // terminal rise, bigger = faster
      b.vy += (-rise - b.vy) * Math.min(1, dt * 2.4);
      b.y += b.vy * dt; b.x += Math.sin(b.ph + b.y * 0.05) * 14 * dt * (b.r * 0.4);
      b.life -= 0.12 * dt;
      const surf = bs + this.wave.offsetAt(b.x);
      if (b.y <= surf + 2 && b.vy < 0) {                              // burst at the surface -> foam
        if (Math.random() < 0.5) this.foam.push({ x: b.x, y: surf, vx: Math.sign(b.x - nx || 1) * rand(10, 40), vy: 0, life: 1, r: b.r * rand(0.8, 1.4) });
        return false;
      }
      return b.life > 0;
    });
    if (this.drops.length > 120) this.drops.splice(0, this.drops.length - 120);
    if (this.foam.length > 80) this.foam.splice(0, this.foam.length - 80);
    if (this.bubbles.length > 220) this.bubbles.splice(0, this.bubbles.length - 220);
    if (this.ripples.length > 18) this.ripples.splice(0, this.ripples.length - 18);
  }

  private drawBasin(ctx: CanvasRenderingContext2D, L: Layout, t: number): void {
    const W = this.W, H = this.H;
    const y0 = L.basinY;
    const nx = L.nozzleX;
    drawWater(ctx, this.wave, y0, W, H, {
      surface: 'rgba(100,200,255,0.82)',
      body: 'rgba(16,98,185,0.94)',
      deep: '#0b4c91',
    }, { shafts: true, caustics: true });

    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = b.life * 0.65 * Math.min(1, b.life * 3);
      ctx.fillStyle = 'rgba(200,238,255,0.75)';
      ctx.beginPath(); ctx.arc(b.x + Math.sin(t * 8 + b.ph) * 2, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const fd of this.foam) {
      ctx.save();
      ctx.globalAlpha = fd.life * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.beginPath(); ctx.arc(fd.x, fd.y, fd.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (this.streamFlow > 0.05) this.drawImpact(ctx, nx, y0 + this.wave.offsetAt(nx), L.pR, t);
    for (const d of this.drops) {
      ctx.save();
      ctx.globalAlpha = d.life * 0.9;
      const dg = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
      dg.addColorStop(0, 'rgba(230,250,255,0.95)');
      dg.addColorStop(0.55, 'rgba(90,180,255,0.8)');
      dg.addColorStop(1, 'rgba(40,120,220,0.55)');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    for (const rp of this.ripples) {
      ctx.save();
      ctx.globalAlpha = rp.life * 0.55;
      ctx.strokeStyle = 'rgba(200,245,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.R, rp.R * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** the plunge: an aerated plume spreading below the entry (about 12 deg half-angle) and a foam skirt on the surface */
  private drawImpact(ctx: CanvasRenderingContext2D, ix: number, iy: number, pR: number, t: number): void {
    const f = this.streamFlow, jR = pR * 0.5 * Math.sqrt(f);
    const depth = Math.min(this.H - iy - 4, pR * 6 * f + 20);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createLinearGradient(0, iy, 0, iy + depth);
    pg.addColorStop(0, `rgba(210,240,255,${0.32 * f})`); pg.addColorStop(0.5, `rgba(150,210,255,${0.12 * f})`); pg.addColorStop(1, 'rgba(150,210,255,0)');
    ctx.fillStyle = pg;
    const sp = depth * 0.38 * (1 + 0.06 * Math.sin(t * 9));
    ctx.beginPath();
    ctx.moveTo(ix - jR, iy); ctx.quadraticCurveTo(ix - jR - sp, iy + depth * 0.7, ix, iy + depth);
    ctx.quadraticCurveTo(ix + jR + sp, iy + depth * 0.7, ix + jR, iy); ctx.closePath(); ctx.fill();
    ctx.restore();
    // foam skirt: white water churned around the entry, lumpy and flickering
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.sin(t * 1.3 + i) * 0.3;
      const rr = jR * (1.1 + 0.9 * (0.5 + 0.5 * Math.sin(t * 6 + i * 2.3)));
      const x = ix + Math.cos(a) * rr * 1.6, y = iy + Math.sin(a) * rr * 0.28;
      ctx.fillStyle = `rgba(255,255,255,${(0.5 + 0.3 * Math.sin(t * 8 + i)) * f})`;
      ctx.beginPath(); ctx.ellipse(x, y, 2 + (i % 3) * 1.4, 1.2 + (i % 2), 0, 0, Math.PI * 2); ctx.fill();
    }
    const sg = ctx.createRadialGradient(ix, iy, 0, ix, iy, jR * 3.2);
    sg.addColorStop(0, `rgba(255,255,255,${0.55 * f})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(ix, iy + 1, jR * 3.2, jR * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
