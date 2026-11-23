import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../shared/hydro/hydro-ticker.service';
import { GRAVITY, WaveSurface, clamp, drawWater, rand } from '../../shared/hydro/hydro-physics';
import { HxWaveEdgeComponent } from '../../shared/hydro/hx-wave-edge.component';

interface Bub { x: number; y: number; vy: number; r: number; }

/**
 * CAREERS · HOW WE HIRE — a reinforced-concrete reservoir in section, the kind SIGAT builds.
 * Walls, floor and roof slabs drawn cut (hatched); a DI inlet main enters through the roof and discharges
 * as a free jet; overflow bellmouth, roof vent and access hatch; outlet through the wall with its gate valve;
 * a level board with four marks = the four hiring stages.
 * Scrolling sets the wanted level; the tank fills at a finite rate (Q / A) while the inlet runs (jet thins by
 * continuity, plunge dimples the surface, entrains bubbles), and drains through the outlet when you go back.
 * A stage lights when the water passes its mark.
 */
@Component({
  selector: 'app-careers-reservoir',
  standalone: true,
  imports: [TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section #sec class="crv">
      <app-hx-wave-edge color="#ffffff" back="#2f8fe0" [flip]="true" />
      <div class="hx-container crv__grid">
        <div class="crv__copy">
          <header class="hx-head">
            <p class="hx-eyebrow hx-eyebrow--light">{{ 'careers_hire_kicker' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'careers_hire_title' | translate }}</h2>
          </header>
          <ol class="crv__steps">
            @for (i of [1, 2, 3, 4]; track i) {
              <li [class.is-on]="reached() >= i">
                <span class="crv__mark" aria-hidden="true">{{ i }}</span>
                <span><b>{{ 'careers_hire_' + i + '_t' | translate }}</b><span>{{ 'careers_hire_' + i | translate }}</span></span>
              </li>
            }
          </ol>
        </div>
        <div class="crv__scene"><canvas #cv aria-hidden="true"></canvas></div>
      </div>
      <app-hx-wave-edge color="#eaf5fd" back="#2f8fe0" />
    </section>
  `
})
export class CareersReservoirComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  readonly reached = signal(0);

  private off?: () => void;
  private ro?: ResizeObserver;
  private ctx!: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  private readonly wave = new WaveSurface({ columns: 120, speed: 220, stiffness: 9, damping: 1.8 });
  private level = -1;          // water surface y (px)
  private inflow = 0; private outflow = 0;
  private t = 0;
  private bubs: Bub[] = [];
  // geometry
  private g = { x0: 0, x1: 0, th: 14, yR: 0, yF: 0, ix0: 0, ix1: 0, iy0: 0, iy1: 0, xIn: 0, yNoz: 0, pr: 8, yOver: 0, yOut: 0, low: 0, high: 0 };

  ngAfterViewInit(): void {
    const cv = this.cv.nativeElement;
    this.ctx = cv.getContext('2d')!;
    const fit = () => this.resize(cv.parentElement!.clientWidth, cv.parentElement!.clientHeight);
    fit();
    this.ro = new ResizeObserver(fit); this.ro.observe(cv.parentElement!);
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.frame(dt));
  }

  ngOnDestroy(): void { this.off?.(); this.ro?.disconnect(); }

  private resize(w: number, h: number) {
    this.W = w; this.H = h; this.dpr = Math.min(1.75, window.devicePixelRatio || 1);
    const cv = this.cv.nativeElement;
    cv.width = Math.round(w * this.dpr); cv.height = Math.round(h * this.dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = this.g;
    g.th = clamp(w * 0.04, 12, 22);
    g.x0 = w * 0.1; g.x1 = w * 0.86;
    g.yR = h * 0.14; g.yF = h * 0.92;
    g.ix0 = g.x0 + g.th; g.ix1 = g.x1 - g.th; g.iy0 = g.yR + g.th; g.iy1 = g.yF - g.th * 1.2;
    g.pr = clamp(w * 0.018, 6, 11);
    g.xIn = g.ix1 - (g.ix1 - g.ix0) * 0.24; g.yNoz = g.iy0 + g.pr * 1.6;
    g.yOver = g.iy0 + (g.iy1 - g.iy0) * 0.1;                 // overflow bellmouth rim = top water level
    g.yOut = g.iy1 - g.pr * 1.8;
    g.low = g.iy1 - (g.iy1 - g.iy0) * 0.08; g.high = g.yOver + 6;
    if (this.level < 0) this.level = this.ticker.reducedMotion ? g.high : g.low;
    this.wave.resize(g.ix1 - g.ix0);
  }

  /** marks of the four stages on the level board */
  private markY(i: number) { const g = this.g; return g.low - (g.low - g.high) * (i / 4.15); }

  private frame(dt: number) {
    const g = this.g, r = this.sec.nativeElement.getBoundingClientRect();
    const p = clamp((window.innerHeight * 0.75 - r.top) / Math.max(1, r.height * 0.85), 0, 1);
    const want = this.ticker.reducedMotion ? g.high : g.low - (g.low - g.high) * p;
    if (dt > 0) {
      this.t += dt;
      // filling at a finite rate: Q / A ≈ 70 px/s; draining through the outlet ≈ √(2gh)-limited
      const rise = 70, fall = 30 + 0.12 * Math.sqrt(2 * GRAVITY * Math.max(0, g.iy1 - this.level));
      const d = want - this.level;
      this.inflow += ((d < -2 ? 1 : 0) - this.inflow) * Math.min(1, dt * 3);
      this.outflow += ((d > 2 ? 1 : 0) - this.outflow) * Math.min(1, dt * 3);
      this.level += clamp(d, -rise * dt, fall * dt);
      this.wave.step(dt);
      if (this.inflow > 0.05) {
        const x = g.xIn - g.ix0;
        this.wave.splash(x, 380 * this.inflow * dt, g.pr * 2);
        if (Math.random() < this.inflow * 0.7 && this.bubs.length < 90) this.bubs.push({ x: g.xIn + rand(-g.pr, g.pr), y: this.level + rand(3, 10), vy: rand(60, 140), r: rand(1, 2.8) });
      }
      for (const b of this.bubs) { b.vy += (-(24 + b.r * 9) - b.vy) * Math.min(1, dt * 2.5); b.y += b.vy * dt; }
      this.bubs = this.bubs.filter(b => b.y > this.level + 1);
    }
    let n = 0; for (let i = 1; i <= 4; i++) if (this.level <= this.markY(i) + 1) n = i;
    if (n !== this.reached()) this.zone.run(() => this.reached.set(n));
    this.draw();
  }

  private hatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = '#b9b4aa'; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(60,55,48,0.28)'; c.lineWidth = 1;
    for (let k = x - h; k < x + w; k += 7) { c.beginPath(); c.moveTo(k, y + h); c.lineTo(k + h, y); c.stroke(); }
    c.fillStyle = 'rgba(60,55,48,0.25)';
    for (let i = 0; i < (w * h) / 90; i++) { const px = x + ((i * 37.3) % w), py = y + ((i * 53.7) % h); c.fillRect(px, py, 1.2, 1.2); }
    c.restore();
  }

  private draw() {
    const c = this.ctx, g = this.g, { W, H } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // lean-concrete blinding + foundation line
    c.fillStyle = 'rgba(150,170,190,0.25)'; c.fillRect(g.x0 - g.th, g.yF, g.x1 - g.x0 + g.th * 2, 6);
    // inside of the tank (dry wall faces)
    const inside = c.createLinearGradient(0, g.iy0, 0, g.iy1);
    inside.addColorStop(0, '#0d2f52'); inside.addColorStop(1, '#0a2744');
    c.fillStyle = inside; c.fillRect(g.ix0, g.iy0, g.ix1 - g.ix0, g.iy1 - g.iy0);
    // water
    c.save(); c.beginPath(); c.rect(g.ix0, g.iy0, g.ix1 - g.ix0, g.iy1 - g.iy0); c.clip();
    c.translate(g.ix0, 0);
    drawWater(c, this.wave, this.level, g.ix1 - g.ix0, g.iy1, { surface: 'rgba(110,200,255,0.85)', body: 'rgba(22,112,200,0.92)', deep: '#0b4c91' }, { shafts: false });
    c.restore();
    for (const b of this.bubs) { c.strokeStyle = 'rgba(225,245,255,0.75)'; c.lineWidth = 1; c.beginPath(); c.arc(b.x + Math.sin(this.t * 7 + b.y * 0.1) * 1.5, b.y, b.r, 0, 7); c.stroke(); }
    // level board (stage marks) on the inner left wall
    const bx = g.ix0 + 8;
    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(bx, g.high - 6, 6, g.low - g.high + 12);
    for (let i = 1; i <= 4; i++) {
      const y = this.markY(i), on = this.level <= y + 1;
      c.fillStyle = on ? '#ff7a1a' : 'rgba(220,235,250,0.55)'; c.fillRect(bx, y - 1, 16, 2.5);
      c.font = '700 11px Sora, system-ui, sans-serif'; c.textBaseline = 'middle';
      c.fillText(String(i), bx + 20, y);
    }
    // overflow bellmouth + downpipe through the floor (sets the top water level)
    const ox = g.ix0 + Math.max((g.ix1 - g.ix0) * 0.12, 52);   // clear of the level board
    c.fillStyle = '#56697a'; c.fillRect(ox - g.pr * 0.6, g.yOver, g.pr * 1.2, g.yF - g.yOver);
    c.beginPath(); c.moveTo(ox - g.pr * 1.6, g.yOver); c.lineTo(ox + g.pr * 1.6, g.yOver); c.lineTo(ox + g.pr * 0.6, g.yOver + g.pr * 1.2); c.lineTo(ox - g.pr * 0.6, g.yOver + g.pr * 1.2); c.closePath(); c.fill();
    // walls, floor and roof cut through
    this.hatch(c, g.x0, g.yR, g.th, g.yF - g.yR);
    this.hatch(c, g.ix1, g.yR, g.th, g.yF - g.yR);
    this.hatch(c, g.x0, g.iy1, g.x1 - g.x0, g.yF - g.iy1);
    this.hatch(c, g.x0 - g.th * 0.4, g.yR, g.x1 - g.x0 + g.th * 0.8, g.th);
    // roof: vent (mushroom) and access hatch
    const vx = g.x0 + (g.x1 - g.x0) * 0.36;
    c.fillStyle = '#8fa3b6'; c.fillRect(vx - 4, g.yR - 18, 8, 18);
    c.beginPath(); c.arc(vx, g.yR - 18, 11, Math.PI, 0); c.fill();
    c.fillStyle = '#6f8295'; c.fillRect(g.x0 + (g.x1 - g.x0) * 0.55, g.yR - 6, 34, 6);
    // inlet main: from the right, over the roof, down through it
    const pr = g.pr, ry = g.yR - pr * 2.2;
    c.fillStyle = '#1a66c4';
    c.fillRect(g.xIn - pr, ry, this.W - (g.xIn - pr), pr * 2);
    c.fillRect(g.xIn - pr, ry, pr * 2, g.yNoz - ry);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(g.xIn - pr, ry + 2, this.W, 2);
    c.fillStyle = '#8fa3b6'; c.fillRect(g.xIn - pr * 1.5, g.yR - 4, pr * 3, 4);        // puddle flange on the roof
    // water in the inlet (flowing streaks when it runs)
    if (this.inflow > 0.05) {
      c.strokeStyle = `rgba(200,236,255,${0.8 * this.inflow})`; c.lineWidth = 1.4; c.setLineDash([6, 10]); c.lineDashOffset = this.t * 60;
      c.beginPath(); c.moveTo(this.W, ry + pr); c.lineTo(g.xIn, ry + pr); c.lineTo(g.xIn, g.yNoz); c.stroke(); c.setLineDash([]);
      // free jet: v² = v0² + 2gΔy, width ∝ √(v0 / v)
      const v0 = 140, top = g.yNoz, bot = this.level + this.wave.offsetAt(g.xIn - g.ix0);
      c.beginPath();
      const L: number[][] = [], R: number[][] = [];
      for (let k = 0; k <= 16; k++) {
        const y = top + (bot - top) * (k / 16), v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (y - top)), wv = pr * 0.8 * Math.sqrt(v0 / v) * this.inflow;
        const wob = Math.sin(y * 0.15 - this.t * 22) * wv * 0.12 * (k / 16);
        L.push([g.xIn - wv + wob, y]); R.push([g.xIn + wv + wob, y]);
      }
      L.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); for (let k = R.length - 1; k >= 0; k--) c.lineTo(R[k][0], R[k][1]);
      c.closePath(); c.fillStyle = 'rgba(150,215,255,0.9)'; c.fill();
      c.fillStyle = `rgba(255,255,255,${0.6 * this.inflow})`; c.beginPath(); c.ellipse(g.xIn, bot, pr * 1.8, pr * 0.45, 0, 0, 7); c.fill();
    }
    // outlet through the left wall + gate valve outside
    const oy = g.yOut;
    c.fillStyle = '#1a66c4'; c.fillRect(0, oy - pr, g.ix0 + 2, pr * 2);
    if (this.outflow > 0.05) {
      c.strokeStyle = `rgba(200,236,255,${0.8 * this.outflow})`; c.lineWidth = 1.4; c.setLineDash([6, 10]); c.lineDashOffset = this.t * 80;
      c.beginPath(); c.moveTo(g.ix0, oy); c.lineTo(0, oy); c.stroke(); c.setLineDash([]);
    }
    const vX = g.x0 * 0.5;
    c.fillStyle = '#14539e'; c.fillRect(vX - pr * 1.1, oy - pr * 1.5, pr * 2.2, pr * 3);
    c.fillStyle = '#c2d4e2'; c.fillRect(vX - 1.5, oy - pr * 3.4, 3, pr * 1.9);
    c.save(); c.translate(vX, oy - pr * 3.6); c.rotate(this.outflow * Math.PI * 2);
    c.strokeStyle = this.outflow > 0.5 ? '#ff7a1a' : '#c62828'; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 0, pr * 1.2, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(-pr * 1.2, 0); c.lineTo(pr * 1.2, 0); c.moveTo(0, -pr * 1.2); c.lineTo(0, pr * 1.2); c.stroke();
    c.restore();
  }
}
