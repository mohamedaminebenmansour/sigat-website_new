import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, input } from '@angular/core';
import { HydroTicker } from './hydro-ticker.service';
import { Bubbles, Droplets, GRAVITY, WaveSurface, clamp, drawWater, fitCanvas, rand } from './hydro-physics';

/**
 * Glass reservoir filled by a free-falling jet.
 *
 * Physics:
 *  - Jet: Torricelli/Bernoulli — v(y) = √(v0² + 2g·Δy); continuity A·v = const
 *    so the jet narrows as it accelerates (w = w0·√(v0/v)).
 *  - Volume integrates the inflow; a float valve throttles the flow near the
 *    target level, so the tank slows down and stops by itself.
 *  - Impact injects momentum into the surface and entrains air bubbles.
 *
 * Starts filling the first time it scrolls into view.
 */
@Component({
  selector: 'app-hydro-reservoir',
  standalone: true,
  template: `
    <div class="hx-res" (pointerdown)="poke($event)">
      <canvas #cv class="hx-res__cv" aria-hidden="true"></canvas>
      <div class="hx-res__readout" role="img" [attr.aria-label]="label()">
        <span class="hx-res__val"><b #vol>0</b> m³</span>
        <span class="hx-res__cap">{{ label() }}</span>
      </div>
    </div>
  `
})
export class HydroReservoirComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  private readonly host = inject(ElementRef<HTMLElement>);
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @ViewChild('vol', { static: true }) vol!: ElementRef<HTMLElement>;

  /** Target fill fraction 0..1. */
  readonly fill = input(0.78);
  /** Capacity used by the live volume readout. */
  readonly capacity = input(2500);
  readonly label = input('Réservoir');

  private readonly wave = new WaveSurface({ columns: 80, speed: 260, stiffness: 9, damping: 3.2 });
  private readonly drops = new Droplets();
  private readonly bubbles = new Bubbles();
  private off?: () => void;
  private io?: IntersectionObserver;
  private started = false;
  private volume = 0.04; // fraction
  private flow = 0;      // valve opening 0..1
  private geo = { x0: 0, x1: 0, top: 0, bot: 0, spoutX: 0, spoutY: 0, w: 0, h: 0 };

  ngAfterViewInit(): void {
    this.wave.swell = 1.6;
    const el = this.host.nativeElement as HTMLElement;
    if (this.ticker.reducedMotion) { this.volume = this.fill(); this.started = true; }
    this.io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { this.started = true; this.io?.disconnect(); }
    }, { threshold: 0.35 });
    this.io.observe(el);
    this.off = this.ticker.register(el, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
    this.io?.disconnect();
  }

  private levelY(): number {
    const g = this.geo;
    return g.bot - (g.bot - g.top) * this.volume;
  }

  private surfaceY = (x: number) => this.levelY() + this.wave.offsetAt(x - this.geo.x0);

  poke(e: PointerEvent): void {
    const r = this.cv.nativeElement.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x > this.geo.x0 && x < this.geo.x1) this.wave.splash(x - this.geo.x0, 320, 30);
  }

  private tick(dt: number): void {
    const { w, h, ctx } = fitCanvas(this.cv.nativeElement);
    const g = this.geo;
    g.w = w; g.h = h;
    g.x0 = w * 0.14; g.x1 = w * 0.86; g.top = h * 0.16; g.bot = h * 0.93;
    g.spoutX = g.x0 + (g.x1 - g.x0) * 0.24; g.spoutY = h * 0.11;
    this.wave.resize(g.x1 - g.x0);

    // Float valve: wide open far from target, closes smoothly near it.
    const want = this.started ? clamp((this.fill() - this.volume) / 0.08, 0, 1) : 0;
    this.flow += (want - this.flow) * Math.min(1, dt * 3);
    if (dt > 0) {
      this.volume = Math.min(1, this.volume + this.flow * 0.16 * dt);
      this.wave.step(dt);
    }
    const level = this.levelY();

    // Jet impact → momentum + spray + entrained air.
    if (this.flow > 0.02 && dt > 0) {
      const ix = g.spoutX - g.x0;
      const fallV = Math.sqrt(2 * GRAVITY * Math.max(1, level - g.spoutY));
      this.wave.splash(ix, fallV * this.flow * dt * 1.1, 16);
      if (Math.random() < this.flow * 0.6) {
        this.drops.spawn(g.spoutX + rand(-4, 4), level - 2, rand(-160, 160), -rand(120, 330) * this.flow, rand(1, 2.2));
      }
      if (Math.random() < this.flow * 0.9) {
        this.bubbles.spawn(g.spoutX + rand(-10, 10), level + rand(10, 60) * this.flow + 8, rand(0.8, 2.6));
      }
    }
    if (dt > 0) {
      this.drops.step(dt, this.surfaceY, null, h);
      this.bubbles.step(dt, this.surfaceY, null);
    }

    ctx.clearRect(0, 0, w, h);
    this.drawTankBack(ctx);

    // Water, clipped to the tank interior.
    ctx.save();
    this.tankPath(ctx);
    ctx.clip();
    ctx.translate(g.x0, 0);
    drawWater(ctx, this.wave, level, g.x1 - g.x0, g.bot + 4, {
      surface: 'rgba(110,200,255,0.85)', body: 'rgba(25,120,210,0.92)', deep: '#0b3f7a'
    }, { shafts: true, caustics: true });
    ctx.translate(-g.x0, 0);
    this.bubbles.draw(ctx, 0.85);
    ctx.restore();

    this.drawJet(ctx, level);
    this.drops.draw(ctx);
    this.drawTankFront(ctx, level);

    this.vol.nativeElement.textContent = Math.round(this.volume * this.capacity()).toLocaleString('fr-FR');
  }

  private tankPath(ctx: CanvasRenderingContext2D): void {
    const { x0, x1, top, bot } = this.geo;
    const r = Math.min(26, (x1 - x0) * 0.08);
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bot - r);
    ctx.quadraticCurveTo(x0, bot, x0 + r, bot);
    ctx.lineTo(x1 - r, bot);
    ctx.quadraticCurveTo(x1, bot, x1, bot - r);
    ctx.lineTo(x1, top);
    ctx.closePath();
  }

  private drawTankBack(ctx: CanvasRenderingContext2D): void {
    const { x0, x1, top, bot } = this.geo;
    const bg = ctx.createLinearGradient(x0, 0, x1, 0);
    bg.addColorStop(0, 'rgba(10,40,80,0.75)');
    bg.addColorStop(0.5, 'rgba(18,60,110,0.55)');
    bg.addColorStop(1, 'rgba(10,40,80,0.8)');
    this.tankPath(ctx);
    ctx.fillStyle = bg;
    ctx.fill();
    // Gauge marks on the back wall.
    ctx.strokeStyle = 'rgba(160,210,255,0.25)';
    ctx.fillStyle = 'rgba(190,225,255,0.55)';
    ctx.font = '600 10px Sora, system-ui, sans-serif';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = bot - (bot - top) * (i / 10);
      const len = i % 5 === 0 ? 22 : 11;
      ctx.beginPath();
      ctx.moveTo(x1 - 8, y);
      ctx.lineTo(x1 - 8 - len, y);
      ctx.stroke();
      if (i % 5 === 0 && i > 0 && i < 10) ctx.fillText(`${i * 10}%`, x1 - 36 - len, y + 3);
    }
  }

  private drawJet(ctx: CanvasRenderingContext2D, level: number): void {
    const { spoutX, spoutY, x0, top } = this.geo;
    // Inlet pipe (enters from the left, elbow down).
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pg = ctx.createLinearGradient(0, spoutY - 12, 0, spoutY + 12);
    pg.addColorStop(0, '#9fb4c9'); pg.addColorStop(0.45, '#e9f1f8'); pg.addColorStop(1, '#5f7488');
    ctx.strokeStyle = pg;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-10, spoutY - 22);
    ctx.lineTo(spoutX - 18, spoutY - 22);
    ctx.quadraticCurveTo(spoutX, spoutY - 22, spoutX, spoutY - 4);
    ctx.lineTo(spoutX, Math.max(spoutY, top - 4));
    ctx.stroke();
    // Flange.
    ctx.fillStyle = '#7d93a8';
    ctx.fillRect(x0 * 0.5 - 4, spoutY - 33, 8, 22);
    ctx.restore();

    if (this.flow < 0.02) return;
    const y0 = Math.max(spoutY, top - 4);
    const v0 = 140;
    const w0 = 3 + 7 * this.flow;
    const steps = 18;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    const t = performance.now() / 1000;
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((level - y0) * i) / steps;
      const v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (y - y0));
      const ww = w0 * Math.sqrt(v0 / v) + Math.sin(t * 40 + i) * 0.4 * (i / steps);
      left.push([spoutX - ww, y]);
      right.push([spoutX + ww, y]);
    }
    const jg = ctx.createLinearGradient(spoutX - w0, 0, spoutX + w0, 0);
    jg.addColorStop(0, 'rgba(120,200,255,0.65)');
    jg.addColorStop(0.4, 'rgba(235,248,255,0.95)');
    jg.addColorStop(1, 'rgba(90,170,240,0.7)');
    ctx.beginPath();
    left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = jg;
    ctx.fill();
  }

  private drawTankFront(ctx: CanvasRenderingContext2D, level: number): void {
    const { x0, x1, top, bot } = this.geo;
    // Glass reflections.
    const gl = ctx.createLinearGradient(x0, 0, x1, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.20)');
    gl.addColorStop(0.08, 'rgba(255,255,255,0.04)');
    gl.addColorStop(0.75, 'rgba(255,255,255,0)');
    gl.addColorStop(0.86, 'rgba(255,255,255,0.12)');
    gl.addColorStop(0.9, 'rgba(255,255,255,0.02)');
    this.tankPath(ctx);
    ctx.fillStyle = gl;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(200,228,255,0.55)';
    ctx.stroke();
    // Steel rings.
    ctx.fillStyle = 'rgba(190,210,230,0.9)';
    ctx.fillRect(x0 - 6, top - 5, x1 - x0 + 12, 6);
    ctx.fillStyle = 'rgba(160,185,210,0.35)';
    for (const f of [0.33, 0.66]) ctx.fillRect(x0 - 3, top + (bot - top) * f, x1 - x0 + 6, 2);
    // Level float indicator on the right wall.
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(x1 + 6, level);
    ctx.lineTo(x1 + 16, level - 6);
    ctx.lineTo(x1 + 16, level + 6);
    ctx.closePath();
    ctx.fill();
  }
}
