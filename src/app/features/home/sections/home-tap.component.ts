import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { Bubbles, Droplets, GRAVITY, WaveSurface, drawWater, fitCanvas, rand } from '../../../shared/hydro/hydro-physics';
import { HxWaveEdgeComponent } from '../../../shared/hydro/hx-wave-edge.component';
import { Path, Seg, buildPath, clamp, drawGlassPipe } from '../../../shared/hydraulics/hydraulics-core';

/**
 * CHAPTER 06 — THE OUTLET (call to action).
 * The end of the network, drawn as a real installation: the supply main
 * (glass, full of water under pressure) → pressure gauge on a tee →
 * quarter-turn BALL VALVE with its orange lever → long-radius elbow →
 * flanged outlet discharging into the pool.
 *
 * Physics, kept consistent:
 *  - the lever lies along the pipe when open, across it when shut (seen in
 *    perspective, so it foreshortens while it turns);
 *  - the free area of the ball bore grows ≈ (opening)², so Q ∝ f(θ);
 *  - the outlet velocity rises with Q and the jet obeys continuity: it leaves
 *    the bore, then narrows as it accelerates (w ∝ √(v0/v)) and breaks up into
 *    drops (Plateau–Rayleigh) before the pool;
 *  - the gauge upstream reads the static pressure when shut and drops by the
 *    friction loss (∝ Q²) while flowing;
 *  - closing fast stops the column abruptly: Joukowsky surge (ΔP ∝ Δv), a
 *    damped pressure wave on the gauge and a short shudder of the line;
 *  - shut, the outlet still drips (the water left below the ball drains).
 * Hover / focus the main button, or tap anywhere (touch) to work the valve.
 */
@Component({
  selector: 'app-home-tap',
  standalone: true,
  imports: [RouterLink, TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section #sec class="hx-tap" id="ch-tap" data-chapter="06" (pointerdown)="onTouch($event)">
      <app-hx-wave-edge color="#ffffff" back="#2f8fe0" [flip]="true" />
      <canvas #cv class="hx-tap__cv" aria-hidden="true"></canvas>

      <div class="hx-tap__copy">
        <p class="hx-eyebrow hx-eyebrow--light">{{ 'hx_tap_kicker' | translate }}</p>
        <h2 class="hx-h2 hx-display">{{ 'hx_tap_title' | translate }}</h2>
        <p class="hx-lead">{{ 'hx_tap_text' | translate }}</p>
        <div class="hx-hero__ctas">
          <a routerLink="/contact" class="hx-btn hx-btn--primary"
             (mouseenter)="open.set(true)" (mouseleave)="open.set(false)"
             (focus)="open.set(true)" (blur)="open.set(false)">
            {{ 'hx_tap_cta' | translate }} <i class="fa-solid fa-faucet-drip" aria-hidden="true"></i>
          </a>
          <a routerLink="/partnerships" class="hx-btn hx-btn--ghost">{{ 'hx_tap_partner' | translate }}</a>
        </div>
      </div>
    </section>
  `
})
export class HomeTapComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;

  readonly open = signal(false);
  private readonly wave = new WaveSurface({ columns: 110, speed: 300, stiffness: 12, damping: 2 });
  private readonly drops = new Droplets();
  private readonly bubbles = new Bubbles();
  private off?: () => void;

  /** valve opening 0 (shut) … 1 (open); the actuator is a hand: ~0.7 s to open, faster to slam */
  private theta = 0;
  private q = 0;              // flow / rated
  private flowPh = 0;         // ∫ q dt (advects the streaks smoothly)
  private hammer = -1;        // time since a fast closure, −1 = none
  private hammerA = 0;        // surge amplitude (∝ the velocity that was stopped)
  private dripClock = 1;
  private breakClock = 0;
  private level = 0;
  private clock = 0;
  private manual = false;     // touch: tap toggles the valve
  private demoUntil = -1;     // opens once by itself when the section comes into view
  private geo?: { key: string; pipe: Path; sValve: number; ox: number; oy: number; r: number; xValve: number; xGauge: number; y: number; dir: 1 | -1 };

  onTouch(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('a,button')) return;
    this.manual = !this.manual;          // tap / click the scene: work the valve by hand
  }

  ngAfterViewInit(): void {
    this.wave.swell = 3;
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  private surfaceY = (x: number) => this.level + this.wave.offsetAt(x);

  /** installation geometry (canvas coordinates) */
  private layout(w: number, h: number) {
    const narrow = w < 1024;
    const rtl = document.documentElement.dir === 'rtl';
    const key = `${w}x${h}x${rtl}`;
    if (this.geo?.key === key) return this.geo;
    const r = narrow ? 10 : 13;
    const left = Math.max(16, (w - 1200) / 2 + 32);
    // desktop: left column, high; tablets/phones: below the copy, above the pool
    let ox = narrow ? w * 0.62 : left + clamp(w * 0.2, 220, 300);
    const y = narrow ? this.level - 240 : h * 0.24;
    const B = r * 3.2, drop = narrow ? 50 : 70;
    const oy = y + B + drop;
    const dir: 1 | -1 = rtl ? -1 : 1;
    if (rtl) ox = w - ox;
    const x0 = rtl ? w + 40 : -40;
    const pipe = buildPath(x0, y, [
      ['L', ox - dir * B, y] as Seg,
      ['Q', ox, y, ox, y + B] as Seg,
      ['L', ox, oy] as Seg
    ]);
    const run = Math.abs(ox - dir * B - x0) - 40;              // visible straight run
    const xValve = ox - dir * (B + Math.min(run * 0.42, 150));
    const xGauge = ox - dir * (B + Math.min(run * 0.78, 290));
    const sValve = Math.abs(xValve - x0);
    this.geo = { key, pipe, sValve, ox, oy, r, xValve, xGauge, y, dir };
    return this.geo;
  }

  private tick(dt: number): void {
    const { w, h, ctx } = fitCanvas(this.cv.nativeElement);
    this.wave.resize(w);
    this.level = w < 1024 ? h - 110 : h * 0.8;
    const g = this.layout(w, h);
    this.clock += dt;
    if (this.demoUntil < 0 && dt > 0 && this.sec.nativeElement.getBoundingClientRect().top < window.innerHeight * 0.45) this.demoUntil = this.clock + 2.8;

    // ---- valve + column
    const want = this.open() || this.manual || this.clock < this.demoUntil ? 1 : 0;
    const prevTheta = this.theta;
    const rate = want > this.theta ? 1.4 : 3.2;                  // a hand opens gently, lets go fast
    this.theta = clamp(this.theta + Math.sign(want - this.theta) * rate * dt, 0, 1);
    const fOpen = this.theta * this.theta;                       // ball-bore free area ≈ θ²
    const prevQ = this.q;
    this.q += (fOpen - this.q) * Math.min(1, dt * 7);            // column inertia
    if (this.q < 0.003) this.q = 0;
    // fast closure with water moving → surge
    const closing = (prevTheta - this.theta) / Math.max(dt, 1e-3);
    if (this.theta === 0 && prevTheta > 0 && prevQ > 0.05 && closing > 1.5) { this.hammer = 0; this.hammerA = Math.min(1, prevQ * 1.6); }
    if (this.hammer >= 0) { this.hammer += dt; if (this.hammer > 2.5) this.hammer = -1; }
    this.flowPh += dt * this.q;

    const v0 = 70 + 230 * this.q;                                // outlet velocity (px/s)
    const rIn = g.r - 2.5;
    const w0 = rIn * Math.sqrt(Math.min(1, (this.q * 300) / v0)); // continuity at the outlet

    if (dt > 0) {
      this.wave.step(dt);
      // shut: residual drip from the outlet
      this.dripClock -= dt;
      if (this.q < 0.05 && this.dripClock <= 0) {
        this.dripClock = rand(0.8, 1.5) + (this.theta === 0 ? 0 : 0.4);
        this.drops.spawn(g.ox, g.oy + 4, 0, 30, 3.2);
      }
      if (this.q >= 0.05) {
        this.breakClock -= dt;
        while (this.breakClock <= 0) {
          this.breakClock += 0.02 / this.q;
          const by = this.breakY(g.oy);
          const v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (by - g.oy));
          this.drops.spawn(g.ox + rand(-1.5, 1.5), by, rand(-12, 12), v, rand(1.8, 3.4) * (0.6 + this.q * 0.6));
        }
        if (Math.random() < this.q * 0.7) this.bubbles.spawn(g.ox + rand(-18, 18), this.level + rand(14, 70), rand(0.8, 3));
      }
      this.drops.impact = this.q >= 0.05 ? 0.12 : 1;
      this.drops.step(dt, this.surfaceY, this.wave, h);
      this.bubbles.step(dt, this.surfaceY, this.wave);
    }

    ctx.clearRect(0, 0, w, h);
    // the line shudders for an instant on a surge
    const shake = this.hammer >= 0 ? Math.sin(this.hammer * 70) * Math.exp(-this.hammer * 7) * 2.2 * this.hammerA : 0;
    ctx.save();
    ctx.translate(0, shake);
    this.drawInstallation(ctx, g);
    ctx.restore();
    this.drawStream(ctx, g.ox, g.oy, v0, w0);
    this.drops.draw(ctx);
    drawWater(ctx, this.wave, this.level, w, h, {
      surface: 'rgba(110,198,255,0.85)', body: 'rgba(22,112,200,0.95)', deep: '#0b4c91'
    });
    this.bubbles.draw(ctx, 0.8);
  }

  /** gauge reading: static head when shut, minus friction loss ∝ Q² while flowing, plus surge */
  private pressure(): number {
    let p = 0.68 - 0.3 * this.q * this.q;
    if (this.hammer >= 0) p += 0.42 * this.hammerA * Math.exp(-this.hammer * 1.8) * Math.cos(this.hammer * 2 * Math.PI * 2.6);
    return clamp(p, 0.02, 1.1);
  }

  private drawInstallation(ctx: CanvasRenderingContext2D, g: NonNullable<HomeTapComponent['geo']>): void {
    const { pipe, sValve, r, y, dir } = g;
    // upstream: always full, under pressure. downstream: full only while it flows
    drawGlassPipe(ctx, pipe, { r, flow: 110, t: this.flowPh, rings: [60], s0: 0, s1: sValve });
    drawGlassPipe(ctx, pipe, { r, flow: 110, t: this.flowPh, s0: sValve, s1: pipe.length, water: this.q > 0.03 });

    const body = (x: number, bw: number, bh: number) => {
      const gr = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
      gr.addColorStop(0, '#5d9be0'); gr.addColorStop(0.35, '#2a6fc4'); gr.addColorStop(1, '#123f7a');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, Math.min(7, bh / 4)); ctx.fill();
      ctx.strokeStyle = 'rgba(8,30,60,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    };
    const flange = (fx: number, fy: number, vertical: boolean) => {
      ctx.fillStyle = '#8fa4b8';
      if (vertical) ctx.fillRect(fx - r * 0.28, fy - r * 1.55, r * 0.56, r * 3.1);
      else ctx.fillRect(fx - r * 1.55, fy - r * 0.28, r * 3.1, r * 0.56);
      ctx.fillStyle = '#4b5d70';
      for (const k of [-1.25, 1.25]) { ctx.beginPath(); ctx.arc(vertical ? fx : fx + r * k, vertical ? fy + r * k : fy, Math.max(1.4, r * 0.14), 0, 7); ctx.fill(); }
    };
    ctx.save();
    ctx.lineCap = 'round';

    // pressure gauge on a tee (upstream of the valve)
    {
      const x = g.xGauge;
      ctx.fillStyle = '#8fa4b8'; ctx.fillRect(x - r * 0.32, y - r * 2.7, r * 0.64, r * 1.7);
      body(x, r * 1.5, r * 2.4);
      const gr = Math.max(13, r * 1.55), gy = y - r * 2.7 - gr;
      ctx.beginPath(); ctx.arc(x, gy, gr, 0, 7); ctx.fillStyle = '#f7fafc'; ctx.fill();
      ctx.strokeStyle = '#8fa4b8'; ctx.lineWidth = Math.max(2, gr * 0.16); ctx.stroke();
      ctx.strokeStyle = 'rgba(31,59,87,0.55)'; ctx.lineWidth = 1;
      for (let k = 0; k <= 10; k++) {                                      // dial ticks over 270°
        const a = -Math.PI * 1.25 + (k / 10) * Math.PI * 1.5;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * gr * 0.62, gy + Math.sin(a) * gr * 0.62); ctx.lineTo(x + Math.cos(a) * gr * 0.78, gy + Math.sin(a) * gr * 0.78); ctx.stroke();
      }
      ctx.strokeStyle = '#d64545'; ctx.lineWidth = Math.max(1.5, gr * 0.1);
      ctx.beginPath(); ctx.arc(x, gy, gr * 0.7, Math.PI * 0.05, Math.PI * 0.25); ctx.stroke();   // red zone (test pressure)
      const ang = -Math.PI * 1.25 + this.pressure() * Math.PI * 1.5 + Math.sin(this.clock * 23) * 0.012 * this.q;
      ctx.strokeStyle = '#1f3b57'; ctx.lineWidth = Math.max(1.4, gr * 0.09);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + Math.cos(ang) * gr * 0.74, gy + Math.sin(ang) * gr * 0.74); ctx.stroke();
      ctx.fillStyle = '#1f3b57'; ctx.beginPath(); ctx.arc(x, gy, gr * 0.12, 0, 7); ctx.fill();
    }

    // quarter-turn ball valve: flanged body, stem, orange lever
    {
      const x = g.xValve;
      flange(x - r * 1.9, y, true); flange(x + r * 1.9, y, true);
      body(x, r * 3.4, r * 2.8);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * 1.05, 0, 0, 7); ctx.fill();   // ball housing
      ctx.fillStyle = '#245fae'; ctx.fillRect(x - r * 0.55, y - r * 2.1, r * 1.1, r * 0.75);  // mounting pad
      ctx.strokeStyle = '#c7d2dd'; ctx.lineWidth = Math.max(2.5, r * 0.3);
      ctx.beginPath(); ctx.moveTo(x, y - r * 2.1); ctx.lineTo(x, y - r * 2.7); ctx.stroke();  // stem
      // lever: along the pipe when open, pointing at the viewer when shut (foreshortened)
      const phi = (1 - this.theta) * Math.PI / 2, L = r * 5;
      const lx = x + dir * L * Math.cos(phi), ly = y - r * 2.75 + L * 0.32 * Math.sin(phi);
      ctx.strokeStyle = '#c4570e'; ctx.lineWidth = Math.max(5, r * 0.62);
      ctx.beginPath(); ctx.moveTo(x, y - r * 2.75); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = Math.max(3.5, r * 0.45); ctx.stroke();
      ctx.fillStyle = '#ff9d55'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(3, r * 0.34), 0, 7); ctx.fill();   // grip
      ctx.fillStyle = '#4b5d70'; ctx.beginPath(); ctx.arc(x, y - r * 2.75, Math.max(2, r * 0.24), 0, 7); ctx.fill();   // nut
    }

    // flanged outlet at the end of the drop
    flange(g.ox, g.oy - r * 0.15, false);
    ctx.restore();
  }

  /** the coherent column gets longer with the flow (more inertia) */
  private breakY(oy: number): number {
    return oy + (this.level - oy) * (0.3 + 0.55 * this.q);
  }

  private drawStream(ctx: CanvasRenderingContext2D, x: number, oy: number, v0: number, w0: number): void {
    if (this.q < 0.05) return;
    const end = this.breakY(oy);
    const t = this.clock;
    const n = 24;
    const half = (i: number) => {
      const y = oy + ((end - oy) * i) / n;
      const v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (y - oy));
      // continuity A·v = const → w ∝ √(v0/v); varicose ripple grows downstream
      return { y, ww: w0 * Math.sqrt(v0 / v) * (1 + 0.16 * (i / n) * Math.sin(y * 0.22 - t * 30)) };
    };
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = half(i); i ? ctx.lineTo(x - p.ww, p.y) : ctx.moveTo(x - p.ww, p.y); }
    for (let i = n; i >= 0; i--) { const p = half(i); ctx.lineTo(x + p.ww, p.y); }
    ctx.closePath();
    const gr = ctx.createLinearGradient(x - w0, 0, x + w0, 0);
    gr.addColorStop(0, 'rgba(140,210,255,0.7)');
    gr.addColorStop(0.45, 'rgba(240,250,255,0.95)');
    gr.addColorStop(1, 'rgba(100,180,245,0.75)');
    ctx.fillStyle = gr;
    ctx.fill();
  }
}
