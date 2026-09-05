import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
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
/** Ellipse aspect ratio (radiusY / radiusX) - the fixed "camera tilt". */
const V3D_ELLIPSE_RATIO = 0.6;
const V3D_DEG = Math.PI / 180;
/** Near/far visual scale range - smooth and deliberately modest. */
const V3D_MIN_SCALE = 0.82;
const V3D_MAX_SCALE = 1.06;
/** Near/far opacity range (far planets stay clearly readable). */
const V3D_MIN_OPACITY = 0.75;
const V3D_MAX_OPACITY = 1;
/** Per-planet orbital speed (radians per second) - inner fast, outer calm. */
const V3D_SPEEDS = [0.32, 0.27, 0.23, 0.2, 0.17, 0.14];
/** Initial offsets (radians) so the six planets start spread around the sun. */
const V3D_START_ANGLES = [0.4, 1.6, 3.0, 4.4, 5.6, 2.4];
/** Fixed planet accent colors (SIGAT identity: warm gold + cool blues). */
const V3D_COLORS = ['#f59e0b', '#2563eb', '#0ea5e9', '#6366f1', '#1d4ed8', '#0f766e'];
/** radiusX = this fraction x scene width; successive orbits step by fraction. */
const V3D_RX1_FRAC = 0.25;
const V3D_STEP_FRAC = 0.04;

/** Per-planet visual geometry, recomputed every frame from the orbit angle. */
interface PlanetGeometry {
  x: number;
  y: number;
  depth: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * EXPERIMENTAL Version B - "SIGAT Values Solar System".
 * Each company value is a planet orbiting a glowing sun. Technically this is a
 * PURE 2D "faux-3D" visualization - no rotateX, rotateY, perspective or
 * preserve-3d. Planet positions come from ellipse math about the 50/50 center,
 * and depth is derived continuously from the vertical orbit position, so it
 * reads as a tilted solar system purely through scale + opacity + z-index.
 * The orbital loop (A) and the active-value autoplay (B) are independent and
 * hover NEVER pauses the motion. One rAF loop runs inside Zone.runOutsideAngular
 * and writes per-frame transforms straight to the DOM (no change detection).
 */
@Component({
  selector: 'app-values-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SectionHeaderComponent],
  styles: [`
      :host { display: block; }

      /* Section + header: fills the viewport below the fixed navbar; the
         margin-bottom reserves a safe crawl for mobile browser chrome. */
      .v3d-section {
        position: relative;
        background: linear-gradient(180deg, #ffffff 0%, #f4f7fc 100%);
        overflow: hidden;
        width: 100%;
        min-height: calc(100vh - 5.5rem);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-block: 1.5rem 0.5rem;
        margin-bottom: 8rem;
      }
      .v3d-header { width: 100%; }

      /* Scene - geometry root. container-type lets every size resolve from
         the container width (cqw) so the system scales responsively. */
      .v3d-scene {
        --v3d-rx1: 25cqw;
        --v3d-step: 4cqw;
        --v3d-rx2: calc(var(--v3d-rx1) + var(--v3d-step));
        --v3d-rx3: calc(var(--v3d-rx1) + var(--v3d-step) * 2);
        --v3d-rx4: calc(var(--v3d-rx1) + var(--v3d-step) * 3);
        --v3d-rx5: calc(var(--v3d-rx1) + var(--v3d-step) * 4);
        --v3d-rx6: calc(var(--v3d-rx1) + var(--v3d-step) * 5);
        --v3d-ratio: 0.6;
        --v3d-planet: clamp(2.6rem, 8.75cqw, 4.4rem);
        --v3d-sun: clamp(7rem, 17cqw, 10.5rem);
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        container-type: inline-size;
        position: relative;
        margin-inline: auto;
        width: min(100%, 820px);
        aspect-ratio: 100 / 64;
      }

      /* Orbit rings - genuine 2D ellipses (width != height), normal border.
         No rotateX, no preserve-3d. */
      .v3d-orbits { position: absolute; inset: 0; }
      .v3d-orbit {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border: 1px solid rgba(30, 58, 138, 0.16);
        border-radius: 50%;
        pointer-events: none;
      }
      .v3d-orbit:nth-of-type(2n) { border-style: dashed; }
      .v3d-orbit.o1 { width: calc(var(--v3d-rx1) * 2);      height: calc(var(--v3d-rx1) * 2 * var(--v3d-ratio)); }
      .v3d-orbit.o2 { width: calc(var(--v3d-rx2) * 2);      height: calc(var(--v3d-rx2) * 2 * var(--v3d-ratio)); }
      .v3d-orbit.o3 { width: calc(var(--v3d-rx3) * 2);      height: calc(var(--v3d-rx3) * 2 * var(--v3d-ratio)); }
      .v3d-orbit.o4 { width: calc(var(--v3d-rx4) * 2);      height: calc(var(--v3d-rx4) * 2 * var(--v3d-ratio)); }
      .v3d-orbit.o5 { width: calc(var(--v3d-rx5) * 2);      height: calc(var(--v3d-rx5) * 2 * var(--v3d-ratio)); }
      .v3d-orbit.o6 { width: calc(var(--v3d-rx6) * 2);      height: calc(var(--v3d-rx6) * 2 * var(--v3d-ratio)); }

      /* Planets - centered at 50/50; fixed size/color come from instance
         styles so selecting a value never reconfigures the loop. The per-frame
         transform is written directly to style.transform by the rAF loop and
         has NO CSS transition (that would ghost/lag the motion). */
      .v3d-planet {
        --v3d-pc: #0ea5e9;
        position: absolute;
        left: 50%;
        top: 50%;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.45);
        padding: 0;
        margin: 0;
        font: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.92) 0%, var(--v3d-pc) 82%, rgba(0, 0, 0, 0.18) 100%);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        transform: translate(-50%, -50%);
        will-change: transform;
        transition: box-shadow 250ms ease, border-color 250ms ease, filter 250ms ease;
        -webkit-tap-highlight-color: transparent;
      }
      .v3d-planet.active { border-color: #ffffff; }
      .v3d-planet-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        height: 100%;
        padding: 0.35rem 0.3rem;
        text-align: center;
        border-radius: inherit;
        overflow: hidden;
        color: #ffffff;
        text-shadow: 0 1px 3px rgba(15, 23, 42, 0.55);
        user-select: none;
      }
      .v3d-planet-inner i { font-size: clamp(0.95rem, 2.8cqw, 1.35rem); line-height: 1; }
      .v3d-planet-inner span {
        font-size: clamp(0.5rem, 1.4cqw, 0.72rem);
        font-weight: 700;
        line-height: 1.08;
        letter-spacing: 0.01em;
        max-width: 100%;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Hover: beaming emphasis ONLY - it NEVER pauses orbital motion. */
      .v3d-planet:hover {
        border-color: rgba(255, 255, 255, 0.95);
        filter: brightness(1.15);
        box-shadow:
          0 14px 36px rgba(15, 23, 42, 0.34),
          0 0 0 3px color-mix(in srgb, var(--v3d-pc) 55%, transparent),
          0 0 30px color-mix(in srgb, var(--v3d-pc) 60%, transparent);
      }
      .v3d-planet.active::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: 0 0 16px 3px color-mix(in srgb, var(--v3d-pc) 70%, transparent);
        pointer-events: none;
      }
      .v3d-planet:focus-visible {
        outline: 3px solid #1e3a8a;
        outline-offset: 3px;
        border-radius: 50%;
      }
      /* ================= Central sun ================= */
      .v3d-sun {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--v3d-sun);
        height: var(--v3d-sun);
        z-index: 400;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.65);
        background: radial-gradient(circle at 30% 28%, #fff6cf 0%, #ffd76b 48%, #ffb347 92%);
        box-shadow: 0 0 40px rgba(255, 179, 71, 0.5), 0 0 110px rgba(255, 140, 0, 0.26),
          inset 0 0 0 8px rgba(255, 245, 192, 0.6), inset 0 -14px 26px rgba(234, 88, 12, 0.34);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: v3d-sun-pulse 3.2s ease-in-out infinite;
      }
      @keyframes v3d-sun-pulse {
        0%, 100% { box-shadow: 0 0 40px rgba(255, 179, 71, 0.5), 0 0 110px rgba(255, 140, 0, 0.26), inset 0 0 0 8px rgba(255, 245, 192, 0.6); }
        50%      { box-shadow: 0 0 64px rgba(255, 179, 71, 0.66), 0 0 150px rgba(255, 140, 0, 0.34), inset 0 0 0 8px rgba(255, 245, 192, 0.66); }
      }
      .v3d-sun-halo {
        position: absolute;
        left: 50%;
        top: 50%;
        width: calc(var(--v3d-sun) * 1.6);
        height: calc(var(--v3d-sun) * 1.6);
        z-index: 80;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 179, 71, 0.35) 0%, rgba(255, 179, 71, 0.12) 48%, transparent 72%);
        filter: blur(2px);
        pointer-events: none;
      }
      .v3d-sun-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        padding: 0 14%;
        text-align: center;
        color: #78350f;
        animation: v3d-swap 300ms var(--v3d-ease) both;
      }
      .v3d-sun-content i { font-size: clamp(1.25rem, 3.9cqw, 1.9rem); line-height: 1; }
      .v3d-sun-content h3 { margin: 0; font-size: clamp(0.82rem, 2.6cqw, 1.08rem); font-weight: 800; line-height: 1.18; }
      .v3d-sun-content p {
        margin: 0;
        font-size: clamp(0.55rem, 1.75cqw, 0.76rem);
        line-height: 1.4;
        color: #92400e;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      @keyframes v3d-swap {
        0%   { opacity: 0; transform: scale(0.94); }
        60%  { opacity: 1; transform: scale(1.03); }
        100% { opacity: 1; transform: scale(1); }
      }

      /* ================= Pagination dots ================= */
      .v3d-dots {
        position: absolute;
        left: 50%;
        top: calc(50% + var(--v3d-sun) / 2 + 0.7rem);
        transform: translateX(-50%);
        z-index: 500;
        display: flex;
        gap: 0.45rem;
      }
      .v3d-dot {
        width: 0.55rem;
        height: 0.55rem;
        padding: 0;
        border-radius: 9999px;
        border: 1px solid rgba(30, 58, 138, 0.45);
        background: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        transition: background 250ms ease, transform 250ms ease;
      }
      .v3d-dot.active { background: #f59e0b; transform: scale(1.3); }
      .v3d-dot:focus-visible { outline: 2px solid #1e3a8a; outline-offset: 2px; }

      /* ================= Responsive geometry ================= */
      @media (max-width: 900px) {
        .v3d-scene {
          --v3d-planet: clamp(2.5rem, 8.75cqw, 3.5rem);
          --v3d-sun: clamp(6.3rem, 18cqw, 8.5rem);
          width: min(100%, 30rem);
          aspect-ratio: 100 / 74;
        }
      }
      @media (max-width: 560px) {
        .v3d-scene {
          --v3d-planet: clamp(2.35rem, 8.25cqw, 3rem);
          --v3d-sun: clamp(5.2rem, 15.5cqw, 6.4rem);
          width: min(100%, 22rem);
          aspect-ratio: 100 / 82;
        }
      }

      /* ================= Reduced motion ================= */
      @media (prefers-reduced-motion: reduce) {
        .v3d-sun-content { animation: none; }
        .v3d-sun { animation: none; }
        .v3d-planet, .v3d-dot { transition: none; }
        .v3d-planet.active::after { box-shadow: none; }
      }
    `,
  ],
  template: `
    <section class="v3d-section">
      <div class="v3d-header py-4 sm:py-6 px-4">
        <app-section-header
          [title]="'values_title' | translate"
          [subtitle]="'values_subtitle' | translate"
        />
      </div>

      <div class="v3d-scene">
        <!-- Orbital guide rings (2D ellipses) - behind everything. -->
        <div class="v3d-orbits" aria-hidden="true">
          <div class="v3d-orbit o1"></div>
          <div class="v3d-orbit o2"></div>
          <div class="v3d-orbit o3"></div>
          <div class="v3d-orbit o4"></div>
          <div class="v3d-orbit o5"></div>
          <div class="v3d-orbit o6"></div>
        </div>

        <!-- Soft halo shield keeps the sun visually dominant. -->
        <div class="v3d-sun-halo" aria-hidden="true"></div>

        <!-- Central sun - always shows the active value. -->
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

        <!-- Orbiting planets - exactly six, positioned by the rAF loop. -->
        <div class="v3d-planets">
          @for (value of values; track value.id; let i = $index) {
            <button
              type="button"
              class="v3d-planet"
              [class.active]="i === activeIndex()"
              [style.--v3d-pc]="planetColor(i)"
              [style.width]="planetSize()"
              [style.height]="planetSize()"
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
    </section>
  `,
})


export class Values3dComponent {
  /** Shared data - the ONLY source of truth (never copied, never reordered). */
  readonly values = COMPANY_VALUES;

  readonly activeIndex = signal(0);
  readonly activeValue = computed(() => this.values[this.activeIndex()]);

  /** Per-planet current orbital angle (radians) - advanced by the rAF loop. */
  private readonly angles = new Float64Array(V3D_SLOTS);

  private readonly zone = inject(NgZone);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reduceMotion: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private sceneWidth = 0;

  private planets: HTMLElement[] = [];
  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Randomize start positions ONCE so every reload looks fresh.
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.angles[i] = V3D_START_ANGLES[i] + Math.random() * Math.PI * 2;
    }
    inject(DestroyRef).onDestroy(() => this.onDestroy());

    afterNextRender(() => {
      this.applyStaticGeometry();
      if (this.reduceMotion) return; // planets placed once and stay
      this.startAnimation();
      this.scheduleAutoplay(V3D_AUTOPLAY_MS);
    });
  }

  /** Fixed accent color per planet (exposed to the template). */
  planetColor(i: number): string {
    return V3D_COLORS[i % V3D_COLORS.length];
  }
  /** Responsive planet size from the scene custom property. */
  planetSize(): string {
    return 'var(--v3d-planet)';
  }

  selectPlanet(index: number): void {
    const i = ((index % V3D_SLOTS) + V3D_SLOTS) % V3D_SLOTS;
    this.activeIndex.set(i);
    // Orbital position is untouched - the planet keeps moving from where it is.
    this.scheduleAutoplay(V3D_AUTOPLAY_MS);
  }

  /** Pure 2D ellipse geometry about the 50/50 center. No rotateY/X or 3D. */
  private calculatePlanetGeometry(index: number, angle: number): PlanetGeometry {
    const rx = this.sceneWidth * (V3D_RX1_FRAC + index * V3D_STEP_FRAC);
    const ry = rx * V3D_ELLIPSE_RATIO;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const depth = (Math.sin(angle) + 1) / 2; // 0 far (back) -> 1 near (front)
    const scale = V3D_MIN_SCALE + depth * (V3D_MAX_SCALE - V3D_MIN_SCALE);
    const opacity = V3D_MIN_OPACITY + depth * (V3D_MAX_OPACITY - V3D_MIN_OPACITY);
    const zIndex = Math.round(depth * 100);
    return { x, y, depth, scale, opacity, zIndex };
  }

  private composePlanetTransform(g: PlanetGeometry): string {
    return `translate3d(${g.x}px, ${g.y}px, 0) translate(-50%, -50%) scale(${g.scale.toFixed(4)})`;
  }

  /** Reads the scene size and derives the ellipse radii used by CSS + JS. */
  private applyStaticGeometry(): void {
    const host = this.elementRef.nativeElement;
    const scene = host.querySelector<HTMLElement>('.v3d-scene');
    const width = scene ? scene.clientWidth : 0;
    this.sceneWidth = Math.max(0, width);

    this.planets = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet'));
    this.applyAnimation();
  }

  /** ONE rAF loop: advances every planet continuously until destroyed, runs
      outside the Angular zone and writes only to style props (no CD per frame). */
  private startAnimation(): void {
    this.zone.runOutsideAngular(() => {
      const step = (timestamp: number) => {
        const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 16.667 : 1;
        this.lastTimestamp = timestamp;
        for (let i = 0; i < this.angles.length; i++) {
          this.angles[i] += V3D_SPEEDS[i] * V3D_DEG * delta;
        }
        this.applyAnimation();
        this.animationFrame = requestAnimationFrame(step);
      };
      this.animationFrame = requestAnimationFrame(step);
    });
  }

  private applyAnimation(): void {
    const nodes = this.planets;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el) continue;
      const g = this.calculatePlanetGeometry(i, this.angles[i]);
      el.style.transform = this.composePlanetTransform(g);
      el.style.zIndex = String(g.zIndex);
      el.style.opacity = String(g.opacity);
    }
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