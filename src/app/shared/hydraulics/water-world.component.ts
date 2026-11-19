import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  PLATFORM_ID, inject, signal, viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WaterWorldEngine, WWStat, WWValue } from './water-world-engine';
import { COMPANY_VALUES } from '../../features/about/components/values.data';

/** Company figures carried by the numbered drops (value, i18n label key). */
const STATS: [string, string][] = [
  ['15+', 'home_stat_years'],
  ['120+', 'home_stat_projects'],
  ['500 km+', 'home_stat_pipelines'],
  ['300+', 'home_stat_employees'],
];
/** Values orbiting the pump — same six company values as the About page (emoji drawn on canvas). */
const VALUE_EMOJI: Record<string, string> = {
  quality: '🏅', engagement: '🤝', responsibility: '⚖️', safety: '🛡️', sustainability: '♻️', environment: '🌱',
};
const VALUES: [string, string, string][] = COMPANY_VALUES.map(v => [VALUE_EMOJI[v.id] ?? '💧', v.titleKey, v.descriptionKey]);

/** The brand water picture used as the scene backdrop (height / width). */
const PICTURE_ASPECT = 1600 / 1131;
/** Sparkle points on the picture's crystal "SIGAT" letters (fractions of the picture). */
const PICTURE_SPARKLES: [number, number][] = [
  [0.585, 0.135], [0.675, 0.155], [0.79, 0.205], [0.865, 0.135], [0.97, 0.135], [0.77, 0.29], [0.955, 0.325],
];

/**
 * Home "water world": logo reservoir fed by the pump, numbered drops, SIGAT water letters,
 * company story and values orbiting the pump — one continuous hydraulic scene.
 */
@Component({
  selector: 'app-water-world',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section #section class="ww relative overflow-clip" id="about-sigat">
      <!-- The brand water picture, at the picture's exact proportions. Layout
           anchors live inside this frame in picture coordinates (%), so the
           live logo, its drop and the water line stay locked to the photo. -->
      <div class="ww-pic" data-ww="picture" aria-hidden="true">
        <picture>
          <source media="(max-width: 767px)" srcset="assets/media/home/sigat-water-768.webp" />
          <img src="assets/media/home/sigat-water.webp" alt="" decoding="async" />
        </picture>
        <div data-ww="logo" class="ww-a ww-a--logo"></div>
        <div data-ww="sigat" class="ww-a ww-a--sigat"></div>
        <div data-ww="surface" class="ww-a ww-a--surface"></div>
      </div>
      <div class="pointer-events-none absolute inset-0">
        <canvas #canvas class="sticky top-0 block w-full" aria-hidden="true"></canvas>
      </div>

      <div class="relative container mx-auto px-4">
        <h2 class="sr-only">SIGAT</h2>
        <!-- keeps the story card below the picture's water line -->
        <div class="ww-spacer" aria-hidden="true"></div>

        <ul class="sr-only">
          @for (s of stats; track s[1]) { <li>{{ s[0] }} {{ s[1] | translate }}</li> }
        </ul>

        <div class="flex justify-end">
          <div class="max-w-xl rounded-3xl border border-white/70 bg-white/55 p-7 shadow-xl shadow-blue-950/10 backdrop-blur-md">
            <p class="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-700">{{ 'ww_about_eyebrow' | translate }}</p>
            <h2 class="mb-3 mt-1.5 font-serif text-3xl font-bold text-blue-950 md:text-4xl">{{ 'about_story_title' | translate }}</h2>
            <p class="leading-relaxed text-blue-950/85">{{ 'about_story_text' | translate }}</p>
            <p class="mt-4 rounded-r-xl border-l-4 border-blue-700 bg-white/60 px-4 py-3 text-sm italic text-blue-950/80">
              {{ 'about_story_highlight' | translate }}
            </p>
          </div>
        </div>

        <div class="mt-24 text-center md:mt-32">
          <p class="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-800">{{ 'about_values_title' | translate }}</p>
          <h2 class="mx-auto mt-1.5 max-w-3xl font-serif text-2xl font-bold text-blue-950 md:text-4xl">{{ 'ww_values_subtitle' | translate }}</h2>
        </div>
        <div data-ww="orbit" class="mx-auto h-[430px] max-w-5xl md:h-[600px]"></div>

        <div class="mx-auto -mt-8 min-h-[92px] max-w-xl rounded-3xl border border-white/70 bg-white/55 px-6 py-4 text-center shadow-xl shadow-blue-950/10 backdrop-blur-md"
             aria-live="polite">
          @if (focus() >= 0) {
            <h3 class="mb-1 text-lg font-bold text-blue-950">{{ values[focus()][0] }}&nbsp; {{ values[focus()][1] | translate }}</h3>
            <p class="leading-relaxed text-blue-950/80">{{ values[focus()][2] | translate }}</p>
            <a routerLink="/about" fragment="values" class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900">
              {{ 'hx_values_more' | translate }} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
            </a>
          }
        </div>
        <ul class="sr-only">
          @for (v of values; track v[1]) { <li>{{ v[1] | translate }} — {{ v[2] | translate }}</li> }
        </ul>
        <!-- Values are clickable: tap a bubble in the orbit or one of these valves.
             The chosen value stays selected (the pump keeps it in front of you). -->
        <div class="ww-chips" role="tablist" [attr.aria-label]="'about_values_title' | translate">
          @for (v of values; track v[1]; let i = $index) {
            <button type="button" role="tab" class="ww-chip" [class.is-on]="focus() === i"
                    [attr.aria-selected]="focus() === i" (click)="select(i)">
              <span aria-hidden="true">{{ v[0] }}</span> {{ v[1] | translate }}
            </button>
          }
        </div>
        <div class="h-28"></div>
      </div>
    </section>
  `,
})
export class WaterWorldComponent implements AfterViewInit, OnDestroy {
  readonly stats = STATS;
  readonly values = VALUES;
  readonly focus = signal(-1);

  /** pin a value (chips below the orbit; bubbles call the engine directly) */
  select(i: number): void { this.engine?.select(i); this.focus.set(i); }

  private readonly sectionRef = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly translate = inject(TranslateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private engine?: WaterWorldEngine;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private sub?: Subscription;
  private onResize = () => this.engine?.layout();

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const section = this.sectionRef().nativeElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.zone.runOutsideAngular(() => {
      this.engine = new WaterWorldEngine(section, this.canvasRef().nativeElement, {
        stats: [], values: [], assetBase: 'assets/brand/', reducedMotion: reduced,
        picture: { aspect: PICTURE_ASPECT, sparkles: PICTURE_SPARKLES },
        onFocus: i => this.zone.run(() => this.focus.set(i)),
        onSelect: i => this.zone.run(() => this.focus.set(i)),
      });
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(section);
      window.addEventListener('resize', this.onResize);
      document.fonts?.ready.then(this.onResize);
      this.io = new IntersectionObserver(([e]) => e.isIntersecting ? this.engine?.start() : this.engine?.stop(), { threshold: 0.01 });
      this.io.observe(section);
    });
    const keys = [...STATS.map(s => s[1]), ...VALUES.map(v => v[1])];
    this.sub = this.translate.stream(keys).subscribe((t: Record<string, string>) => {
      const stats: WWStat[] = STATS.map(([value, k]) => ({ value, label: t[k] ?? k }));
      const values: WWValue[] = VALUES.map(([icon, k]) => ({ icon, title: t[k] ?? k }));
      this.engine?.setContent(stats, values);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.ro?.disconnect();
    this.io?.disconnect();
    window.removeEventListener('resize', this.onResize);
    this.engine?.destroy();
  }
}
