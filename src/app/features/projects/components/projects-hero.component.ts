import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { Bubbles, Droplets, GRAVITY, WaveSurface, clamp, drawWater, fitCanvas, rand } from '../../../shared/hydro/hydro-physics';

/**
 * PROJECTS HERO — the outfall.
 *
 * The pipe that runs through the whole site ends here. A black PE100 main
 * (blue co-extruded stripes = drinking water) runs partly full; at its
 * outlet the flow leaves the invert as a free overfall:
 *   x(t) = x0 − v0·t,   y(t) = y0 + ½·g·t²
 * The nappe thins as it accelerates (continuity: q = h·v), breaks into
 * drops near the pool and hammers the surface (momentum → waves, air
 * entrainment → bubbles). The pool's deep colour is the next section.
 */
@Component({
  selector: 'app-projects-hero',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section #sec class="pj-hero" (pointerdown)="poke($event)">
      <canvas #cv class="pj-hero__cv" aria-hidden="true"></canvas>
      <div class="hx-container pj-hero__copy">
        <p class="hx-eyebrow">{{ 'pj_hero_kicker' | translate }}</p>
        <h1 class="hx-display">{{ 'pj_hero_title' | translate }}</h1>
        <p class="pj-hero__sub">{{ 'pj_hero_sub' | translate }}</p>
        <dl class="pj-hero__facts">
          <div><dt>{{ count() }}</dt><dd>{{ 'pj_fact_projects' | translate }}</dd></div>
          <div><dt>{{ regions() }}</dt><dd>{{ 'pj_fact_regions' | translate }}</dd></div>
          <div><dt>2010</dt><dd>{{ 'pj_fact_since' | translate }}</dd></div>
        </dl>
      </div>
    </section>
  `
})
export class ProjectsHeroComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  readonly count = input(0);
  readonly regions = input(0);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;

  private readonly wave = new WaveSurface({ columns: 120, speed: 330, stiffness: 10, damping: 1.8 });
  private readonly drops = new Droplets();
  private readonly bubbles = new Bubbles();
  private off?: () => void;
  private t = 0;
  private flow = 0;          // valve opening 0..1 (primes when the page opens)
  private shed = 0;
  private level = 0;
  private g = { w: 1, h: 1, ox: 0, oy: 0, R: 80, pool: 0, x0: 0, y0: 0, depth: 0, v0: 0 };

  ngAfterViewInit(): void {
    this.wave.swell = 3.5;
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  poke(e: PointerEvent): void {
    const r = this.cv.nativeElement.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.abs(y - this.level) < 60) this.wave.splash(x, 380, 34);
  }

  private surfaceY = (x: number) => this.level + this.wave.offsetAt(x);

  private geometry(w: number, h: number): void {
    const g = this.g;
    const wide = w >= 1024;
    g.w = w; g.h = h;
    g.R = clamp(Math.min(w * 0.1, h * 0.15), 44, 120);
    g.ox = wide ? w * 0.66 : w * 0.62;
    g.oy = wide ? h * 0.36 : h * 0.7;
    g.pool = wide ? h * 0.84 : h * 0.93;
    const inner = g.R * 0.86;
    g.depth = inner * 0.5;                    // partly full pipe: h/D ≈ 0.25
    g.x0 = g.ox; g.y0 = g.oy + inner;           // invert (pipe bottom) at the outlet
    // Choose v0 so the nappe lands ~40 % across the screen: t = √(2H/g)
    const H = g.pool - g.y0;
    const land = wide ? w * 0.42 : w * 0.22;
    g.v0 = (g.x0 - land) / Math.sqrt((2 * H) / GRAVITY);
  }

  private tick(dt: number): void {
    const { w, h, ctx } = fitCanvas(this.cv.nativeElement);
    this.geometry(w, h);
    const g = this.g;
    this.wave.resize(w);
    this.level = g.pool;
    this.t += dt;
    // the valve opens progressively (no water hammer): first-order ramp
    this.flow += (1 - this.flow) * (dt > 0 ? Math.min(1, dt * 0.9) : 1);

    const fall = Math.sqrt((2 * (g.pool - g.y0)) / GRAVITY);
    const impactX = g.x0 - g.v0 * fall;
    if (dt > 0) {
      this.wave.step(dt);
      // Continuous momentum flux of the nappe into the pool.
      const vy = GRAVITY * fall;
      this.wave.splash(impactX, vy * this.flow * dt * 1.3, 26);
      // Break-up: drops shed from the lower nappe.
      this.shed -= dt;
      while (this.shed <= 0) {
        this.shed += 0.018 / Math.max(0.2, this.flow);
        const tt = fall * rand(0.72, 0.95);
        this.drops.spawn(g.x0 - g.v0 * tt + rand(-6, 6), g.y0 + 0.5 * GRAVITY * tt * tt, -g.v0 * rand(0.9, 1.05), GRAVITY * tt, rand(1.4, 3.2));
      }
      this.drops.impact = 0.15;
      this.drops.step(dt, this.surfaceY, this.wave, h);
      if (Math.random() < this.flow) this.bubbles.spawn(impactX + rand(-30, 30), g.pool + rand(12, 70), rand(0.8, 3.2));
      this.bubbles.step(dt, this.surfaceY, this.wave);
    }

    ctx.clearRect(0, 0, w, h);
    this.drawPipe(ctx);
    this.drawNappe(ctx, fall);
    this.drops.draw(ctx);
    drawWater(ctx, this.wave, this.level, w, h, { surface: 'rgba(110,200,255,0.9)', body: 'rgba(24,110,200,0.95)', deep: '#0a3d73' });
    this.bubbles.draw(ctx, 0.8);
    // foam at the plunge point
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 14; i++) {
      const x = impactX + Math.sin(this.t * 7 + i * 1.7) * 26 * (i / 14);
      ctx.beginPath();
      ctx.arc(x, this.surfaceY(x) - 2, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** PE100 main seen in perspective: body to the right, outlet facing left. */
  private drawPipe(ctx: CanvasRenderingContext2D): void {
    const { ox, oy, R, w } = this.g;
    const rx = R * 0.34;
    // body
    const body = ctx.createLinearGradient(0, oy - R, 0, oy + R);
    body.addColorStop(0, '#11161c'); body.addColorStop(0.28, '#4a5866'); body.addColorStop(0.42, '#262f38');
    body.addColorStop(0.85, '#0c1015'); body.addColorStop(1, '#1b232b');
    ctx.fillStyle = body;
    ctx.fillRect(ox, oy - R, w - ox + 10, 2 * R);
    // blue co-extruded stripes (potable-water PE)
    ctx.strokeStyle = '#2f8fe0'; ctx.lineWidth = Math.max(2, R * 0.05);
    for (const f of [-0.62, 0.62]) { ctx.beginPath(); ctx.moveTo(ox + rx * Math.sqrt(1 - f * f), oy + f * R); ctx.lineTo(w + 10, oy + f * R); ctx.stroke(); }
    // electrofusion coupler band
    const cx = ox + Math.min(w - ox - 40, R * 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(cx, oy - R * 1.04, R * 0.5, R * 2.08);
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(cx + R * 0.18, oy - R * 1.04, R * 0.08, R * 0.2);
    // rim (wall thickness) + interior
    ctx.beginPath(); ctx.ellipse(ox, oy, rx, R, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2b3540'; ctx.fill();
    const ri = 0.86;
    const inner = ctx.createLinearGradient(ox - rx, 0, ox + rx, 0);
    inner.addColorStop(0, '#05080b'); inner.addColorStop(1, '#1b252f');
    ctx.beginPath(); ctx.ellipse(ox, oy, rx * ri, R * ri, 0, 0, Math.PI * 2);
    ctx.fillStyle = inner; ctx.fill();
    // water in the pipe (free-surface flow), seen through the outlet
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ox, oy, rx * ri, R * ri, 0, 0, Math.PI * 2); ctx.clip();
    const top = oy + R * ri - this.g.depth;
    const wg = ctx.createLinearGradient(0, top, 0, oy + R);
    wg.addColorStop(0, '#7fd0ff'); wg.addColorStop(1, '#1565c0');
    ctx.fillStyle = wg;
    ctx.fillRect(ox - rx, top + Math.sin(this.t * 4) * 1.5, rx * 2, R * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox - rx, top + Math.sin(this.t * 4) * 1.5); ctx.lineTo(ox + rx, top + Math.sin(this.t * 4 + 1) * 1.5); ctx.stroke();
    ctx.restore();
    // rim highlight
    ctx.beginPath(); ctx.ellipse(ox, oy, rx, R, 0, Math.PI * 0.6, Math.PI * 1.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  }

  /** Free overfall: a ribbon between the upper and lower nappe surfaces. */
  private drawNappe(ctx: CanvasRenderingContext2D, fall: number): void {
    const { x0, y0, v0, depth } = this.g;
    if (this.flow < 0.05) return;
    const n = 30;
    const up: [number, number][] = [], lo: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * fall * 0.98;
      const vx = v0, vy = GRAVITY * t;
      const v = Math.hypot(vx, vy);
      // q = h·v → the nappe thins as it accelerates; surface disturbances grow downstream
      const grow = t / fall;
      const th = depth * this.flow * (v0 / v) * (1 + (0.04 + 0.08 * grow) * Math.sin(t * 90 - this.t * 30));
      const x = x0 - vx * t, y = y0 + 0.5 * GRAVITY * t * t;
      // offset the upper surface along the normal of the trajectory
      const nx = -vy / v, ny = vx / v;
      lo.push([x, y]);
      up.push([x + nx * th, y - ny * th]);
    }
    const grad = ctx.createLinearGradient(x0, y0 - depth, x0 - v0 * fall, this.g.pool);
    grad.addColorStop(0, 'rgba(120,205,255,0.95)'); grad.addColorStop(1, 'rgba(60,150,235,0.75)');
    ctx.beginPath();
    up.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // aerated edges: the falling jet entrains air and whitens toward the pool
    const white = ctx.createLinearGradient(x0, y0, x0 - v0 * fall, this.g.pool);
    white.addColorStop(0, 'rgba(255,255,255,0.35)'); white.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.lineWidth = 2.2; ctx.strokeStyle = white;
    ctx.beginPath(); up.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); lo.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    // streaks advected with the flow
    ctx.save(); ctx.clip();
    ctx.setLineDash([14, 22]); ctx.lineDashOffset = -this.t * 260;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.6;
    for (const k of [0.3, 0.65]) {
      ctx.beginPath();
      up.forEach(([x, y], i) => { const [lx, ly] = lo[i]; const X = lx + (x - lx) * k, Y = ly + (y - ly) * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    }
    ctx.restore();
  }
}
