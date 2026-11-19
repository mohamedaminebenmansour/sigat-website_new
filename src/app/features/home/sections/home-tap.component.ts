import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { Bubbles, Droplets, GRAVITY, WaveSurface, drawWater, fitCanvas, rand } from '../../../shared/hydro/hydro-physics';

/**
 * CHAPTER 06 — LE ROBINET
 * The end of the journey: a tap above a pool. Idle, it drips. Hover or
 * focus the call-to-action and the valve opens: a laminar stream that
 * narrows as it accelerates (continuity) and breaks up into drops near the
 * pool (Plateau–Rayleigh instability) before hitting the surface.
 */
@Component({
  selector: 'app-home-tap',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section #sec class="hx-tap" id="ch-tap" data-chapter="06" (pointerdown)="onTouch($event)">
      <canvas #cv class="hx-tap__cv" aria-hidden="true"></canvas>
      <div #faucet class="hx-tap__faucet" aria-hidden="true">
        <svg viewBox="0 0 220 140">
          <defs>
            <linearGradient id="hxChrome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" /><stop offset=".35" stop-color="#c9d6e2" />
              <stop offset=".6" stop-color="#7c90a4" /><stop offset="1" stop-color="#e8eef4" />
            </linearGradient>
          </defs>
          <rect x="0" y="34" width="70" height="30" rx="6" fill="url(#hxChrome)" />
          <path d="M60 36 H150 Q186 36 186 72 V104 H160 V78 Q160 64 146 64 H60 Z" fill="url(#hxChrome)" />
          <rect x="156" y="102" width="34" height="10" rx="3" fill="#8fa3b6" />
          <g class="hx-tap__handle">
            <rect x="96" y="14" width="10" height="24" fill="#8fa3b6" />
            <rect x="66" y="6" width="70" height="12" rx="6" fill="#ff7a1a" />
          </g>
        </svg>
      </div>

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
  @ViewChild('faucet', { static: true }) faucet!: ElementRef<HTMLElement>;

  readonly open = signal(false);
  private readonly wave = new WaveSurface({ columns: 110, speed: 300, stiffness: 12, damping: 2 });
  private readonly drops = new Droplets();
  private readonly bubbles = new Bubbles();
  private off?: () => void;
  private flow = 0;
  private dripClock = 1;
  private breakClock = 0;
  private level = 0;
  private clock = 0;
  /** Opens the tap by itself once, so touch users see the stream too. */
  private demoUntil = -1;

  onTouch(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') this.demoUntil = this.clock + 3;
  }

  ngAfterViewInit(): void {
    this.wave.swell = 3;
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  private surfaceY = (x: number) => this.level + this.wave.offsetAt(x);

  /** Spout position in canvas coordinates (read from the faucet SVG). */
  private spout(): { x: number; y: number } {
    const c = this.cv.nativeElement.getBoundingClientRect();
    const f = this.faucet.nativeElement.getBoundingClientRect();
    return { x: f.left - c.left + f.width * (173 / 220), y: f.top - c.top + f.height * (112 / 140) };
  }

  private tick(dt: number): void {
    const { w, h, ctx } = fitCanvas(this.cv.nativeElement);
    this.wave.resize(w);
    this.level = h * 0.8;
    const s = this.spout();

    // Valve opening eases (a real quarter-turn valve isn't instantaneous).
    this.clock += dt;
    if (this.demoUntil < 0 && dt > 0 && this.sec.nativeElement.getBoundingClientRect().top < window.innerHeight * 0.45) this.demoUntil = this.clock + 2.6;
    const want = this.open() || this.clock < this.demoUntil ? 1 : 0;
    this.flow += (want - this.flow) * Math.min(1, dt * 4);

    if (dt > 0) {
      this.wave.step(dt);
      // Idle drip: a drop detaches when its weight beats surface tension.
      this.dripClock -= dt;
      if (this.flow < 0.15 && this.dripClock <= 0) {
        this.dripClock = rand(0.9, 1.6);
        this.drops.spawn(s.x, s.y + 4, 0, 30, 3.4);
      }
      // Stream break-up: drops shed from the bottom of the coherent column.
      if (this.flow > 0.15) {
        this.breakClock -= dt;
        while (this.breakClock <= 0) {
          this.breakClock += 0.02 / this.flow;
          const breakY = this.breakY(s.y);
          const v = Math.sqrt(140 * 140 + 2 * GRAVITY * (breakY - s.y));
          this.drops.spawn(s.x + rand(-1.5, 1.5), breakY, rand(-12, 12), v, rand(1.8, 3.2) * (0.6 + this.flow * 0.5));
        }
        if (Math.random() < this.flow * 0.7) {
          this.bubbles.spawn(s.x + rand(-16, 16), this.level + rand(14, 70), rand(0.8, 3));
        }
      }
      // A dense stream hands over less momentum per drop than a lone drip.
      this.drops.impact = this.flow > 0.15 ? 0.12 : 1;
      this.drops.step(dt, this.surfaceY, this.wave, h);
      this.bubbles.step(dt, this.surfaceY, this.wave);
    }

    this.sec.nativeElement.style.setProperty('--flow', this.flow.toFixed(3));
    ctx.clearRect(0, 0, w, h);
    this.drawStream(ctx, s);
    this.drops.draw(ctx);
    drawWater(ctx, this.wave, this.level, w, h, {
      surface: 'rgba(110,198,255,0.85)', body: 'rgba(22,112,200,0.95)', deep: '#0b4c91'
    });
    this.bubbles.draw(ctx, 0.8);
  }

  /** The coherent column length grows with flow rate (more inertia). */
  private breakY(spoutY: number): number {
    return spoutY + (this.level - spoutY) * (0.35 + 0.5 * this.flow);
  }

  private drawStream(ctx: CanvasRenderingContext2D, s: { x: number; y: number }): void {
    if (this.flow < 0.15) return;
    const end = this.breakY(s.y);
    const v0 = 140;
    const w0 = 3 + 6 * this.flow;
    const t = performance.now() / 1000;
    const n = 22;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const y = s.y + ((end - s.y) * i) / n;
      const v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (y - s.y));
      // Continuity A·v = const → width ∝ √(v0/v); varicose ripple grows downstream.
      const ww = w0 * Math.sqrt(v0 / v) * (1 + 0.18 * (i / n) * Math.sin(y * 0.22 - t * 30));
      i ? ctx.lineTo(s.x - ww, y) : ctx.moveTo(s.x - ww, y);
    }
    for (let i = n; i >= 0; i--) {
      const y = s.y + ((end - s.y) * i) / n;
      const v = Math.sqrt(v0 * v0 + 2 * GRAVITY * (y - s.y));
      const ww = w0 * Math.sqrt(v0 / v) * (1 + 0.18 * (i / n) * Math.sin(y * 0.22 - t * 30));
      ctx.lineTo(s.x + ww, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(s.x - w0, 0, s.x + w0, 0);
    g.addColorStop(0, 'rgba(140,210,255,0.7)');
    g.addColorStop(0.45, 'rgba(240,250,255,0.95)');
    g.addColorStop(1, 'rgba(100,180,245,0.75)');
    ctx.fillStyle = g;
    ctx.fill();
  }
}
