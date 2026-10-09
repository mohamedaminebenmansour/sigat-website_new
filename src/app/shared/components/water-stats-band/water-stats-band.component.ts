import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_STATS } from '../../../features/media-showcase/data/company-stats.data';
import { CompanyStat } from '../../../features/media-showcase/models/company-stat.model';
import {
  WAVE_POINTS,
  WATER_STATS_BAND_CONFIG,
  WAVE_VIEW,
  WaterStatsBandVariant,
  buildWavePath,
} from './water-stats-band.model';

/**
 * WaterStatsBand — reusable organic water transition with company statistics.
 *
 * Architecture — ONE and only one water wave:
 *   1. ONE authoritative SVG path — the curved upper water boundary
 *      overlapping the previous section (transparent above the curve).
 *   2. ONE water surface — gradient body with the statistics inside it;
 *      the next section simply begins underneath (straight hand-off).
 *
 * Motion: CSS transforms only (drift + sheen). Statistics count up once via
 * a single IntersectionObserver + a single requestAnimationFrame loop run
 * OUTSIDE the Angular zone. `prefers-reduced-motion` disables everything and
 * the final values (already rendered in the template) are kept.
 *
 * All tunable values live in WATER_STATS_BAND_CONFIG (water-stats-band.model.ts).
 */
@Component({
  selector: 'app-water-stats-band',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './water-stats-band.component.html',
  styleUrl: './water-stats-band.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterStatsBandComponent {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /** Placement variant — "hero" (after the hero video) or "footer". */
  readonly variant = input<WaterStatsBandVariant>('hero');

  /**
   * Statistics to display. Defaults to the EXISTING COMPANY_STATS source
   * (media-showcase feature) so company data is never duplicated.
   */
  readonly stats = input<readonly CompanyStat[]>(COMPANY_STATS);

  /** Variant-scoped configuration (single source of magic numbers). */
  protected readonly cfg = computed(
    () => WATER_STATS_BAND_CONFIG[this.variant()],
  );

  /** Unique SVG defs prefix — both variants may coexist on one page. */
  protected readonly uid = computed(() => `wsb-${this.variant()}`);

  /** The ONE authoritative wave path (seamless three-period geometry). */
  protected readonly wavePath = computed(() =>
    buildWavePath(WAVE_POINTS, WAVE_VIEW.width, WAVE_VIEW.height, 3),
  );

  /** Subtle SVG turbulence deformation (desktop + motion allowed only). */
  protected readonly rippleFilter = signal<string | null>(null);

  protected readonly waveWidthPx = `${WAVE_VIEW.width}px`;
  protected readonly waveViewBox = `0 0 ${WAVE_VIEW.width} ${WAVE_VIEW.height}`;

  /** Number spans to animate (template reference inside @for). */
  private readonly numberEls = viewChildren('number', { read: ElementRef });
  private countUpObserver: IntersectionObserver | null = null;
  private countUpFrame: number | null = null;

  constructor() {
    afterNextRender(() => {
      // DOM-only work: never triggers Angular change detection per frame.
      this.zone.runOutsideAngular(() => {
        this.setupRipple();
        this.setupCountUp();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.countUpObserver?.disconnect();
      this.countUpObserver = null;
      if (this.countUpFrame !== null) {
        cancelAnimationFrame(this.countUpFrame);
        this.countUpFrame = null;
      }
    });
  }

  /** Formats a number as a px length for a CSS custom property binding. */
  protected px(value: number): string {
    return `${value}px`;
  }

  /**
   * Very subtle SVG displacement, enabled ONLY on desktop without
   * reduced-motion — mobile and battery-sensitive devices keep the
   * pure-CSS wave (graceful degradation, see config `useRipple`).
   */
  private setupRipple(): void {
    if (!this.cfg().useRipple || typeof matchMedia !== 'function') {
      return;
    }
    const desktop = matchMedia('(min-width: 1024px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => {
      const id = `${this.uid()}-ripple`;
      const enabled = desktop.matches && !reduced.matches;
      this.zone.run(() => this.rippleFilter.set(enabled ? `url(#${id})` : null));
    };
    apply();
    desktop.addEventListener('change', apply);
    reduced.addEventListener('change', apply);
    this.destroyRef.onDestroy(() => {
      desktop.removeEventListener('change', apply);
      reduced.removeEventListener('change', apply);
    });
  }

  /**
   * Starts the count-up ONCE when the band first becomes visible, then
   * disconnects — the animation never restarts while the user is on the page.
   * Reduced-motion users keep the final values rendered in the template.
   */
  private setupCountUp(): void {
    const elements = this.numberEls().map((ref) => ref.nativeElement);
    const reducedMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      elements.length === 0 ||
      reducedMotion ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        this.countUpObserver = null;
        this.animateNumbers(elements);
      },
      { threshold: WATER_STATS_BAND_CONFIG.countUpThreshold },
    );
    observer.observe(this.hostRef.nativeElement);
    this.countUpObserver = observer;
  }

  /** Single rAF loop, outside Angular's zone — no CD per frame. */
  private animateNumbers(elements: HTMLElement[]): void {
    const values = this.stats().map((stat) => stat.value);
    const duration = WATER_STATS_BAND_CONFIG.countUpDurationMs;
    const stagger = WATER_STATS_BAND_CONFIG.countUpStaggerMs;
    const start = performance.now();

    for (const element of elements) {
      element.textContent = '0';
    }

    const step = (now: number): void => {
      const elapsed = now - start;
      let done = true;

      for (let i = 0; i < elements.length; i++) {
        const t = Math.min(1, Math.max(0, (elapsed - i * stagger) / duration));
        if (t < 1) {
          done = false;
        }
        const eased = 1 - Math.pow(1 - t, 3);
        elements[i].textContent = String(Math.round((values[i] ?? 0) * eased));
      }

      if (done) {
        this.countUpFrame = null;
        return;
      }
      this.countUpFrame = requestAnimationFrame(step);
    };

    this.countUpFrame = requestAnimationFrame(step);
  }
}

