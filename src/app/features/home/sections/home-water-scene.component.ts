import {
  AfterViewInit, Component, DestroyRef, ElementRef, NgZone, OnDestroy, ViewChild, inject, output
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { COMPANY_STATS } from '../../media-showcase/data/company-stats.data';
import { WaterSceneEngine } from './water-scene-engine';

/**
 * HOME · À PROPOS — the SIGAT water scene.
 * The official logo is a living reservoir (variable level, pump refill),
 * the 3D crystal SIGAT letters rise one by one from the waves raised by
 * falling drops, each holding sloshing water; the figures float as buoys;
 * the story is written ON the water. Click a letter, the water or the air.
 * See water-scene-engine.ts for the physics.
 */
@Component({
  selector: 'app-home-water-scene',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section #sec class="ws" id="about-sigat"
             (pointerdown)="onDown($event)" (pointermove)="onMove($event)" (pointerup)="onUp()" (pointercancel)="onUp()" (pointerleave)="onUp()">
      <div class="ws__band" aria-hidden="true"><canvas #cv class="ws__cv"></canvas></div>
      <h2 class="sr-only">SIGAT — {{ 'ha_title' | translate }}</h2>
      <ul class="sr-only">
        @for (s of stats; track s.labelKey) { <li>{{ s.value }}{{ s.suffix }} {{ s.labelKey | translate }}</li> }
      </ul>

      <!-- the story, written on the water -->
      <div #story class="ws__story">
        <p class="ws__kicker">{{ 'ww_about_eyebrow' | translate }}</p>
        <h3 class="ws__title hx-display">{{ 'about_story_title' | translate }}</h3>
        <p class="ws__text">{{ 'about_story_text' | translate }}</p>
        <p class="ws__quote">{{ 'about_story_highlight' | translate }}</p>
        <a routerLink="/about" class="ws__link">{{ 'hx_res_link' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        <p class="ws__hint">{{ 'ws_hint' | translate }}</p>
      </div>
    </section>
  `
})
export class HomeWaterSceneComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @ViewChild('story', { static: true }) story!: ElementRef<HTMLElement>;

  /** x of the logo's J-tail as a fraction of the width — the pump riser below aligns to it. */
  readonly tailX = output<number>();
  readonly stats = COMPANY_STATS;

  private engine?: WaterSceneEngine;
  private off?: () => void;
  private ro?: ResizeObserver;
  private lastTail = -1;

  ngAfterViewInit(): void {
    const sec = this.sec.nativeElement;
    this.engine = new WaterSceneEngine(this.cv.nativeElement, sec, this.story.nativeElement, this.ticker.reducedMotion);
    this.engine.onTail = f => {
      if (Math.abs(f - this.lastTail) < 0.0005) return;
      this.lastTail = f;
      this.zone.run(() => this.tailX.emit(f));
    };
    const relayout = () => this.engine?.layout(sec.clientWidth || window.innerWidth, window.innerHeight);
    relayout();
    this.ro = new ResizeObserver(relayout);
    this.ro.observe(this.story.nativeElement);
    window.addEventListener('resize', relayout);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', relayout));
    document.fonts?.ready.then(relayout);

    // five drops: the four company figures + the founding year (one per SIGAT letter)
    const keys = [...this.stats.map(s => s.labelKey), 'ws_founded'];
    const sub = this.translate.stream(keys).subscribe((t: Record<string, string>) => {
      this.engine?.setFigures([
        ...this.stats.map(s => ({
          value: `${s.value}${s.suffix.startsWith('km') ? ' ' : ''}${s.suffix}`,
          label: t[s.labelKey] ?? s.labelKey
        })),
        { value: '2010', label: t['ws_founded'] ?? 'ws_founded' }
      ]);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    this.off = this.ticker.register(sec, dt => this.engine?.frame(dt, sec.getBoundingClientRect().top));
  }

  ngOnDestroy(): void {
    this.off?.();
    this.ro?.disconnect();
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.sec.nativeElement.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** tap / click: heavy water falls from high above */
  onDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('a,button')) return;
    this.engine?.pointerDown(...this.local(e));
  }

  /** drag (mouse pressed or finger): wake across the water, pushes the letters */
  onMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    this.engine?.pointerMove(...this.local(e));
  }

  onUp(): void { this.engine?.pointerUp(); }
}
