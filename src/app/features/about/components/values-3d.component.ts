import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';
import { COMPANY_VALUES } from './values.data';

/** Dwell time between automatic active-value steps (autoplay). */
const V3D_AUTOPLAY_MS = 4000;
/** Planets (= COMPANY_VALUES length). */
const V3D_SLOTS = 6;
/** Autoplay proceeds 0..n-1 then wraps. */
const V3D_STEP = 1;

/**
 * EXPERIMENTAL Version B — "SIGAT Values Solar System".
 * Each company value is a planet orbiting a glowing sun. The view is tilted
 * so orbits render as ellipses; every planet has its own radius and orbital
 * speed (like real planets). Click a planet to focus it; hover to pause.
 * Pure CSS 3D transforms + one rAF loop (no libraries, no DOM mutation).
 */
@Component({
  selector: 'app-values-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SectionHeaderComponent],
  styles: [
    `
      :host { display: block; }

      /* ================= VISUAL TUNING ================= */
      .v3d-scene {
        --v3d-tilt: 60deg;        /* camera tilt -> orbits become ellipses */
        --v3d-perspective: 1200px;/* camera distance (perspective)         */
        --v3d-base-r: 16cqw;      /* first orbit radius                    */
        --v3d-step-r: 5cqw;       /* orbit spacing                         */
        --v3d-sun: clamp(7.4rem, 20cqw, 11rem);
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        /* ------------------------------------------------ */
        container-type: inline-size;
        position: relative;
        width: min(100%, 44rem);
        aspect-ratio: 1 / 1;
        margin-inline: auto;
        perspective: var(--v3d-perspective);
        /* Keep far-side planets visible — depth must never be clipped. */
        overflow: visible;
      }

      /* Tilted orbital plane: the whole system leans back, so the circular
         orbits read as ellipses (CSS 3D perspective does the projection). */
      .v3d-system {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        transform: rotateX(var(--v3d-tilt));
        will-change: transform;
      }

      /* Glowing central sun — always mounted, shows the active value.
         Glow pulses gently (disabled under reduced motion). */
      .v3d-sun {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--v3d-sun);
        height: var(--v3d-sun);
        border-radius: 50%;
        /* Billboard: center via translate, then counter-rotate the parent tilt
           so the sun stays a PERFECT circle facing the camera, while remaining
           inside the tilted plane so planets still pass behind it (occlusion). */
        transform: translate(-50%, -50%) rotateX(calc(var(--v3d-tilt) * -1));
        background: radial-gradient(circle at 30% 30%, #fff5c0 0%, #ffd06b 55%, #ffb347 100%);
        box-shadow: 0 0 46px rgba(255, 179, 71, 0.55), inset 0 0 0 6px rgba(255, 245, 192, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20;
        animation: v3d-sun-pulse 3.2s ease-in-out infinite;
      }
      @keyframes v3d-sun-pulse {
        0%, 100% { box-shadow: 0 0 42px rgba(255, 179, 71, 0.5), inset 0 0 0 6px rgba(255, 245, 192, 0.6); }
        50%     { box-shadow: 0 0 80px rgba(255, 179, 71, 0.7), 0 0 150px rgba(255, 140, 0, 0.35), inset 0 0 0 6px rgba(255, 245, 192, 0.65); }
      }

      .v3d-sun-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        width: 100%;
        padding: 0 14%;
        text-align: center;
        animation: v3d-swap 300ms var(--v3d-ease) both;
        color: #78350f;
      }
      .v3d-sun-content i { font-size: clamp(1.3rem, 4.2cqw, 2rem); line-height: 1; }
      .v3d-sun-content h3 {
        margin: 0;
        font-size: clamp(0.82rem, 2.7cqw, 1.1rem);
        font-weight: 700;
        line-height: 1.2;
      }
      .v3d-sun-content p {
        margin: 0;
        font-size: clamp(0.6rem, 1.9cqw, 0.78rem);
        line-height: 1.4;
        color: #92400e;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      @keyframes v3d-swap {
        0%   { opacity: 0; transform: scale(0.94); }
        60%  { opacity: 1; transform: scale(1.03); }
        100% { opacity: 1; transform: scale(1); }
      }
      /* Planets: each orbits the sun with its own transform; billboarded so
         label + icon stay readable despite the system tilt. Real 3D paint
         order means a planet passing behind the sun is genuinely behind it. */
      .v3d-planet {
        position: absolute;
        left: 50%;
        top: 50%;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.35);
        cursor: pointer;
        transform-style: preserve-3d;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font: inherit;
        transition: box-shadow 300ms ease, border-color 300ms ease;
      }
      .v3d-planet.active {
        border-color: #ffffff;
        box-shadow: 0 0 26px currentColor, inset 0 0 0 1px rgba(255, 255, 255, 0.7);
      }
      /* Subtle glow-trail behind the active planet (soft, non-distracting). */
      .v3d-planet.active::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: 0 0 14px currentColor;
        pointer-events: none;
      }
      .v3d-planet:focus-visible {
        outline: 2px solid #ffffff;
        outline-offset: 3px;
      }

      .v3d-planet-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        height: 100%;
        padding: 0.3rem;
        text-align: center;
        border-radius: inherit;
        overflow: hidden;
        color: #ffffff;
        text-shadow: 0 0 5px rgba(0, 0, 0, 0.55);
      }
      .v3d-planet-inner i { font-size: clamp(0.9rem, 2.6cqw, 1.3rem); line-height: 1; }
      .v3d-planet-inner span {
        font-size: clamp(0.56rem, 1.6cqw, 0.74rem);
        font-weight: 600;
        line-height: 1.1;
      }

      /* Dashed orbital guide ring, laid flat in the XZ plane so it matches
         the rotateY-based orbit path and appears as an ellipse under tilt. */
      .v3d-ring {
        position: absolute;
        left: 50%;
        top: 50%;
        border: 1px dashed rgba(30, 58, 138, 0.25);
        border-radius: 50%;
        transform-style: preserve-3d;
        transform: rotateX(90deg);
        pointer-events: none;
      }

      /* Pagination dots below/over the sun. */
      .v3d-dots {
        position: absolute;
        left: 50%;
        bottom: 6%;
        transform: translateX(-50%);
        display: flex;
        gap: 0.4rem;
        z-index: 30;
      }
      .v3d-dot {
        width: 0.55rem;
        height: 0.55rem;
        padding: 0;
        border-radius: 9999px;
        border: 1px solid rgba(30, 58, 138, 0.45);
        background: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        transition: background 250ms ease, transform 250ms ease;
      }
      .v3d-dot.active {
        background: #1e3a8a;
        transform: scale(1.25);
      }
      .v3d-dot:focus-visible {
        outline: 2px solid #1e3a8a;
        outline-offset: 2px;
      }

      /* Mobile: gentler tilt; all sizes scale via cqw automatically. */
      @media (max-width: 640px) {
        .v3d-scene { --v3d-tilt: 48deg; }
      }

      /* Reduced motion: no orbit loop / autoplay, no transitions or pulsing. */
      @media (prefers-reduced-motion: reduce) {
        .v3d-sun-content { animation: none; }
        .v3d-sun { animation: none; }
        .v3d-planet, .v3d-dot { transition: none; }
        .v3d-planet.active::after { box-shadow: none; }
      }
    `,
  ],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'values_title' | translate"
          [subtitle]="'values_subtitle' | translate"
        />

        <div class="v3d-scene">
          <div class="v3d-system">
            <!-- Orbital guide rings (behind planets). -->
            @for (value of values; track value.id; let i = $index) {
              <div
                class="v3d-ring"
                aria-hidden="true"
                [style.width]="orbitDiameter(i)"
                [style.height]="orbitDiameter(i)"
                [style.marginLeft]="orbitHalf(i)"
                [style.marginTop]="orbitHalf(i)"
              ></div>
            }

            <!-- Central sun. -->
            <div class="v3d-sun">
              <div class="v3d-sun-content">
                <i [class]="activeValue().icon" aria-hidden="true"></i>
                <h3>{{ activeValue().titleKey | translate }}</h3>
                <p>{{ activeValue().descriptionKey | translate }}</p>
              </div>
              <div class="v3d-dots" role="group" aria-label="Company values">
                @for (value of values; track value.id; let i = $index) {
                  <button
                    type="button"
                    class="v3d-dot"
                    [class.active]="i === activeIndex()"
                    (click)="selectPlanet(i)"
                    [attr.aria-label]="value.titleKey | translate"
                    [attr.aria-current]="i === activeIndex() ? 'true' : null"
                  ></button>
                }
              </div>
            </div>

            <!-- Orbiting planets. -->
            @for (value of values; track value.id; let i = $index) {
              <button
                type="button"
                class="v3d-planet"
                [class.active]="i === activeIndex()"
                [style]="getPlanetStyle(i)"
                (click)="selectPlanet(i)"
                [attr.aria-label]="value.titleKey | translate"
                [attr.aria-current]="i === activeIndex() ? 'true' : null"
              >
                <span class="v3d-planet-inner">
                  <i [class]="value.icon" aria-hidden="true"></i>
                  <span>{{ value.titleKey | translate }}</span>
                </span>
              </button>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class Values3dComponent {
  /** Shared data — the ONLY source of truth (never copied, never reordered). */
  readonly values = COMPANY_VALUES;

  readonly activeIndex = signal(0);
  readonly activeValue = computed(() => this.values[this.activeIndex()]);

  /** Per-planet orbital angle (deg) — updated every frame by the rAF loop. */
  private readonly planetAngles = signal<number[]>(this.values.map(() => 0));

  private readonly zone = inject(NgZone);
  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly reduceMotion: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.onDestroy());
    // Start the orbit loop only in the browser (SSR-safe).
    afterNextRender(() => {
      if (!this.reduceMotion) this.startAnimation();
    });
    this.scheduleAutoplay(V3D_AUTOPLAY_MS);
  }

  /** Orbit ring diameter for guide ring i (matches the planet radius). */
  orbitDiameter(i: number): string {
    return `calc((var(--v3d-base-r) + ${i} * var(--v3d-step-r)) * 2)`;
  }
  /** Negative half-diameter used to center each ring on the sun. */
  orbitHalf(i: number): string {
    return `calc((var(--v3d-base-r) + ${i} * var(--v3d-step-r)) * -1)`;
  }

  /** Per-planet orbital speed in deg/frame produced by speed() deltas. */
  speed(i: number): number {
    return 0.12 + i * 0.05;
  }

  planetColor(i: number): string {
    return ['#ffb347', '#2563eb', '#0ea5e9', '#6366f1', '#1d4ed8', '#0f766e'][i % 6];
  }

  planetSize(i: number): string {
    return `clamp(2.8rem, ${6.5 + i * 0.5}cqw, 4.6rem)`;
  }

  planetRadius(i: number): string {
    return `calc(var(--v3d-base-r) + ${i} * var(--v3d-step-r))`;
  }

  getPlanetStyle(i: number): string {
    const angle = this.planetAngles()[i];
    const size = this.planetSize(i);
    const radius = this.planetRadius(i);
    const color = this.planetColor(i);
    // active planet scales up 1.3 via extra scale at the END (after billboard).
    const scale = i === this.activeIndex() ? ' scale(1.3)' : '';
    return (
      `width: ${size}; height: ${size};` +
      `margin-left: calc(${size} / -2); margin-top: calc(${size} / -2);` +
      `background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${color} 90%);` +
      `color: ${color};` +
      `transform: rotateY(${angle}deg) translateX(${radius}) rotateY(${-angle}deg) ` +
      `rotateX(calc(var(--v3d-tilt) * -1))${scale};`
    );
  }

  selectPlanet(index: number): void {
    const i = ((index % V3D_SLOTS) + V3D_SLOTS) % V3D_SLOTS;
    this.activeIndex.set(i);
    // Orbital position is NOT touched — the planet keeps its current angle.
    this.scheduleAutoplay(V3D_AUTOPLAY_MS);
  }

  /** Single rAF loop: advances every planet independently, continuously,
      until the component is destroyed (no hover-pause). Runs outside the
      Angular zone so each frame only does one signal write (cheap, no extra
      CD cycles in the zone). Delta-time keeps speed stable across refresh
      rates (60/120/144Hz). */
  private startAnimation(): void {
    this.zone.runOutsideAngular(() => {
      const step = (timestamp: number) => {
        const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 16.667 : 1;
        const next = this.planetAngles().map((a, i) => a + this.speed(i) * delta);
        this.planetAngles.set(next);
        this.lastTimestamp = timestamp;
        this.animationFrame = requestAnimationFrame(step);
      };
      this.animationFrame = requestAnimationFrame(step);
    });
  }

  private scheduleAutoplay(ms: number): void {
    this.clearTimer();
    if (this.reduceMotion || this.values.length < 2) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.activeIndex.update((i) => (i + V3D_STEP) % V3D_SLOTS);
      this.scheduleAutoplay(V3D_AUTOPLAY_MS);
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onDestroy(): void {
    this.clearTimer();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}