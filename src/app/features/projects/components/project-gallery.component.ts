import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

const TRANSITION_MS = 700;

@Component({
  selector: 'app-project-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  styles: [
    `
      :host { display: block; }
      .pg { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden;
            border-radius: 1rem; background: #0f172a;
            box-shadow: 0 30px 60px -30px rgba(15,23,42,.5); }
      .pg-img { position: absolute; inset: 0; width: 100%; height: 100%;
                object-fit: cover; user-select: none; will-change: transform, opacity; }
      .pg-img--hidden { opacity: 0; }
      .pg-img--enter { z-index: 2; animation: pg-in var(--pg-t,700ms) cubic-bezier(.22,1,.36,1) both; }
      .pg-img--exit { z-index: 1; animation: pg-out var(--pg-t,700ms) cubic-bezier(.4,0,.2,1) both; }
      .pg-enter-right { --pg-sx: 2.5%; --pg-sy: 0; }
      .pg-enter-left { --pg-sx: -2.5%; --pg-sy: 0; }
      .pg-exit-left { --pg-sx: 0; --pg-sy: -0.65%; }
      .pg-exit-right { --pg-sx: 0; --pg-sy: 0.65%; }
      @keyframes pg-in { from { opacity: 0; transform: translate(var(--pg-sx,0),var(--pg-sy,0)) scale(1.03); }
                         to { opacity: 1; transform: translate(0,0) scale(1); } }
      @keyframes pg-out { to { opacity: 0; transform: translate(var(--pg-sx,0),var(--pg-sy,0)) scale(.98); } }
      .pg-dots { position: absolute; top: .9rem; inset-inline-start: .9rem; z-index: 4;
                 display: flex; gap: .35rem; padding: .3rem .55rem; border-radius: 999px;
                 background: rgba(15,23,42,.45); }
      .pg-dot { width: 1.05rem; height: 2px; border-radius: 999px; background: rgba(255,255,255,.35);
                transition: background .25s ease; }
      .pg-dot--on { background: #f59e0b; }
      .pg-arrow { position: absolute; top: 50%; translate: 0 -50%; z-index: 5; width: 44px; height: 44px;
                  display: flex; align-items: center; justify-content: center; padding: 0;
                  border: 1px solid rgba(255,255,255,.35); border-radius: 999px;
                  background: rgba(15,23,42,.45); color: #fff; cursor: pointer;
                  backdrop-filter: blur(6px); transition: background .2s ease; }
      .pg-arrow:hover { background: rgba(15,23,42,.7); }
      .pg-arrow:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .pg-arrow--prev { inset-inline-start: .75rem; }
      .pg-arrow--next { inset-inline-end: .75rem; }
      .pg-count { position: absolute; bottom: .75rem; inset-inline-end: .75rem; z-index: 4;
                  padding: .25rem .6rem; border: 1px solid rgba(255,255,255,.16); border-radius: 999px;
                  background: rgba(15,23,42,.5); color: #fff; font-size: .72rem; font-weight: 600;
                  letter-spacing: .12em; }
      @media (prefers-reduced-motion: reduce) {
        .pg-img--enter, .pg-img--exit { animation-duration: 1ms; }
      }
    `
  ],
  template: `
    <div class="pg" role="group" aria-roledescription="carousel" [attr.aria-label]="altText()">
      <img [class]="incomingLayerClass()" [ngSrc]="images()[preloadIndex()]" width="1280" height="960" priority alt="" />
      <img
        class="pg-img"
        [class]="activeLayerClass()"
        [ngSrc]="images()[activeIndex()]"
        width="1280"
        height="960"
        [alt]="altFor(activeIndex())"
      />

      <button type="button" class="pg-arrow pg-arrow--prev" (click)="previous()" aria-label="Previous image">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rtl:-scale-x-100" fill="none"
             viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round"
             stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <button type="button" class="pg-arrow pg-arrow--next" (click)="next()" aria-label="Next image">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rtl:-scale-x-100" fill="none"
             viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round"
             stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>

      <div class="pg-dots" role="group" aria-label="Slides">
        @for (_ of images(); track _; let i = $index) {
          <span class="pg-dot" [class.pg-dot--on]="i === activeIndex()"></span>
        }
      </div>

      <span class="pg-count" aria-live="polite">{{ counter().current }} / {{ counter().total }}</span>
    </div>
  `
})
export class ProjectGalleryComponent {
  readonly images = input<string[]>([]);
  readonly altText = input<string>('');

  protected readonly activeIndex = signal<number>(0);
  private readonly isTransitioning = signal(false);
  private readonly direction = signal<'left' | 'right'>('right');
  /** Index currently animating into view (the target of an in-flight transition). */
  private readonly transitionTarget = signal<number>(0);

  /** Image warming up in the preload layer (current active + or - 1). */
  protected readonly preloadIndex = computed(() => {
    const arr = this.images();
    if (arr.length < 2) return 0;
    if (this.isTransitioning()) return this.transitionTarget();
    return (this.activeIndex() + 1) % arr.length;
    // While a transition runs, keep the stopped layer as the just-entered image
  });

  protected readonly counter = computed(() => {
    const total = String(this.images().length).padStart(2, '0');
    const current = String(this.activeIndex() + 1).padStart(2, '0');
    return { current, total };
  });

  protected readonly activeLayerClass = computed(() => {
    const dir = this.direction();
    return this.isTransitioning() ? `pg-img pg-img--exit pg-exit-${dir}` : 'pg-img';
  });

  /** Preload layer: hidden at rest, plays the directional entrance on change. */
  protected readonly incomingLayerClass = computed(() => {
    const dir = this.direction();
    return this.isTransitioning()
      ? `pg-img pg-img--enter pg-enter-${dir}`
      : 'pg-img pg-img--hidden';
  });

  protected next(): void {
    this.goTo((this.activeIndex() + 1) % (this.images().length || 1), 'right');
  }

  protected previous(): void {
    const len = this.images().length;
    this.goTo((this.activeIndex() - 1 + len) % (len || 1), 'left');
  }

  protected altFor(index: number): string {
    const arr = this.images();
    return arr.length ? `${this.altText()} ${index + 1}` : '';
  }

  private goTo(target: number, direction: 'left' | 'right'): void {
    const len = this.images().length;
    if (len < 2 || this.isTransitioning() || target === this.activeIndex()) return;
    this.direction.set(direction);
    this.transitionTarget.set(target);
    // The target image is already sitting in the preload layer when it was a
    // neighbouring slide; otherwise it loads into that layer before we flip.
    this.isTransitioning.set(true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.activeIndex.set(target);
      this.isTransitioning.set(false);
    }, TRANSITION_MS);
  }

  private timer: ReturnType<typeof setTimeout> | null = null;
}