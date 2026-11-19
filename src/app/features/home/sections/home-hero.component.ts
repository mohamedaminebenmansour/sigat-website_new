import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import {
  Bubbles, Droplets, WaveSurface, clamp, drawWater, fitCanvas, lerp, rand, smooth
} from '../../../shared/hydro/hydro-physics';

/**
 * CHAPTER 01 — LA SOURCE
 * Sticky hero: the site video sits behind a live water surface. Scrolling
 * raises the water level until the headline is submerged and the second
 * message appears "underwater", flowing seamlessly into the next chapter.
 * Pointer: move across the surface to make waves, click/tap to drop water.
 */
@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section #track class="hx-hero" id="ch-source" data-chapter="01">
      <div #stage class="hx-hero__stage"
           (pointermove)="onMove($event)" (pointerdown)="onDown($event)" (pointerleave)="lastPtr = null">
        <video #vid class="hx-hero__video" muted loop playsinline preload="metadata"
               poster="assets/media/hero/AEP-ouled-khalfallah-poster.webp" aria-hidden="true">
          <source src="assets/media/hero/AEP-ouled-khalfallah-01.web.mp4" type="video/mp4" />
        </video>
        <div class="hx-hero__shade" aria-hidden="true"></div>

        <div class="hx-hero__copy">
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'hx_hero_eyebrow' | translate }}</p>
          <h1 class="hx-hero__title hx-display">
            <span>{{ 'hx_hero_title_1' | translate }}</span>
            <span class="hx-hero__title-accent">{{ 'hx_hero_title_2' | translate }}</span>
          </h1>
          <p class="hx-hero__sub">{{ 'hx_hero_sub' | translate }}</p>
          <div class="hx-hero__ctas">
            <a routerLink="/contact" class="hx-btn hx-btn--primary">
              {{ 'hx_hero_cta_primary' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </a>
            <a routerLink="/projects" class="hx-btn hx-btn--ghost">{{ 'hx_hero_cta_secondary' | translate }}</a>
          </div>
        </div>

        <canvas #cv class="hx-hero__water" aria-hidden="true"></canvas>

        <div class="hx-hero__deep" aria-live="off">
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'hx_hero_deep_kicker' | translate }}</p>
          <h2 class="hx-display">{{ 'hx_hero_deep_title' | translate }}</h2>
          <p>{{ 'hx_hero_deep_text' | translate }}</p>
        </div>

        <div class="hx-hero__cue" aria-hidden="true">
          <span class="hx-hero__hint">{{ 'hx_hero_hint' | translate }}</span>
          <span class="hx-hero__drop"></span>
          <span>{{ 'hx_hero_cue' | translate }}</span>
        </div>
      </div>
    </section>
  `
})
export class HomeHeroComponent implements AfterViewInit, OnDestroy {
  readonly ticker = inject(HydroTicker);
  @ViewChild('track', { static: true }) track!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stage!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @ViewChild('vid', { static: true }) vid!: ElementRef<HTMLVideoElement>;

  private readonly wave = new WaveSurface({ columns: 140, speed: 360, stiffness: 9, damping: 1.1 });
  private readonly drops = new Droplets();
  private readonly bubbles = new Bubbles();
  private off?: () => void;
  private level = 0;
  private lastP = -1;
  private levelV = 0;
  private bubbleClock = 0;
  private w = 1;
  private h = 1;
  lastPtr: { x: number; y: number; t: number } | null = null;

  ngAfterViewInit(): void {
    this.wave.swell = 5;
    // Angular does not reflect the muted attribute; autoplay needs it set.
    const v = this.vid.nativeElement;
    v.muted = true;
    if (!this.ticker.reducedMotion) v.play().catch(() => undefined);
    this.off = this.ticker.register(this.track.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  private progress(): number {
    const r = this.track.nativeElement.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
  }

  private surfaceY = (x: number) => this.level + this.wave.offsetAt(x);

  private tick(dt: number): void {
    const { w, h, ctx } = fitCanvas(this.cv.nativeElement);
    this.w = w; this.h = h;
    this.wave.resize(w);

    const p = this.progress();
    // only touch the style when the scroll actually moved (a custom-property write = style recalc)
    if (Math.abs(p - this.lastP) > 0.0004) { this.lastP = p; this.stage.nativeElement.style.setProperty('--p', p.toFixed(4)); }

    // Target level: 76% of the screen → above the top (fully submerged).
    const target = lerp(h * 0.76, -h * 0.14, smooth(clamp(p * 1.15, 0, 1)));
    if (!this.level) this.level = target;
    const prev = this.level;
    // Water level follows the scroll with a little inertia (mass).
    this.level += (target - this.level) * Math.min(1, dt * 7 || 1);
    const v = dt > 0 ? (this.level - prev) / dt : 0;
    const accel = v - this.levelV;
    this.levelV = v;
    // A container that accelerates makes its water slosh against the walls.
    if (Math.abs(accel) > 4) {
      this.wave.splash(0, accel * 0.22, 90);
      this.wave.splash(w, -accel * 0.22, 90);
    }

    if (dt > 0) {
      this.wave.step(dt);
      this.drops.step(dt, this.surfaceY, this.wave, h);
      this.bubbles.step(dt, this.surfaceY, this.wave);
      // Bubbles drift up through the submerged part of the scene.
      const depth = h - this.level;
      this.bubbleClock -= dt;
      if (depth > 120 && this.bubbleClock <= 0) {
        this.bubbleClock = rand(0.05, 0.22) * (h / Math.max(depth, 1));
        this.bubbles.spawn(rand(0, w), h + 8, rand(1.2, 4.2));
      }
    }

    ctx.clearRect(0, 0, w, h);
    drawWater(ctx, this.wave, this.level, w, h, {
      surface: 'rgba(92,182,245,0.50)',
      body: 'rgba(12,86,168,0.84)',
      deep: '#04294f'
    });
    this.bubbles.draw(ctx, 0.9);
    this.drops.draw(ctx);
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.cv.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onMove(e: PointerEvent): void {
    if (this.ticker.reducedMotion) return;
    const p = this.local(e);
    const now = performance.now();
    if (this.lastPtr) {
      const dt = Math.max(8, now - this.lastPtr.t) / 1000;
      const vy = (p.y - this.lastPtr.y) / dt;
      const vx = (p.x - this.lastPtr.x) / dt;
      const sy = this.surfaceY(p.x);
      // Crossing the surface pushes it; skimming along it leaves a wake.
      if (Math.abs(p.y - sy) < 36) {
        this.wave.splash(p.x, clamp(vy * 0.28, -260, 260) + Math.min(120, Math.abs(vx) * 0.05), 26);
        if (Math.abs(vx) + Math.abs(vy) > 1400 && Math.random() < 0.5) {
          this.drops.spawn(p.x, sy - 3, vx * 0.15, -rand(260, 520), rand(1.2, 2.6));
        }
      }
    }
    this.lastPtr = { x: p.x, y: p.y, t: now };
  }

  onDown(e: PointerEvent): void {
    if (this.ticker.reducedMotion) return;
    if ((e.target as HTMLElement).closest('a,button')) return;
    const p = this.local(e);
    if (p.y < this.surfaceY(p.x) - 10) {
      // Above water: release a drop that falls under gravity.
      this.drops.spawn(p.x, p.y, rand(-20, 20), 0, rand(3.6, 4.8));
    } else {
      // Under water: an air burst.
      for (let i = 0; i < 14; i++) this.bubbles.spawn(p.x + rand(-14, 14), p.y + rand(-10, 10), rand(1, 4.5));
    }
  }
}
