import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';

/** Autoplay interval between automatic stack rotations (single scheduler). */
const GALLERY_AUTOPLAY_MS = 3500;
/** Grace period after a manual interaction before autoplay resumes. */
const INTERACTION_RESUME_MS = 3500;
/** Horizontal distance (px) required for a swipe to register. */
const SWIPE_THRESHOLD_PX = 42;
/** Max vertical travel (px) still treated as a horizontal swipe. */
const SWIPE_MAX_DY_PX = 80;

/**
 * Stacked / offset editorial project gallery.
 *
 * The stack is a logical circular ordering: the source image array is never
 * mutated. Each image's distance from the active index (its "rank") drives a
 * deterministic CSS position/rotation/scale, so when the active index changes
 * every layer physically animates from its old slot into its new one.
 *
 * Rank map (desktop): 0 = principal (center, full size), 1..3 = supporting
 * layers behind, >= 4 = hidden entry slot (images slide in from there).
 */

@Component({
  selector: 'app-project-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  styles: [
    `
      :host { display: block; }

      .pgx { position: relative; isolation: isolate; width: 100%; max-width: 560px; margin-inline: auto; }

      /* ------------------------------------------------------------------
       * Vertical staggered editorial stack. Each image is anchored by its
       * TOP edge (--y in % of stage height) and horizontal offset (--x in %
       * of stage width). Rank drives position, size, rotation, shadow and
       * opacity; changing the active index re-ranks every layer so each card
       * physically animates into its new slot.
       * ------------------------------------------------------------------ */
      .pgx-stage {
        position: relative;
        width: 100%;
        height: clamp(360px, 118vw, 430px);
        touch-action: pan-y;
      }

      .pgx-layer {
        position: absolute;
        left: calc(50% + var(--x, 0%));
        top: var(--y, 0%);
        width: var(--w, 70%);
        aspect-ratio: 4 / 3;
        padding: 0;
        overflow: hidden;
        border-radius: var(--r, 16px);
        background: #0f172a;
        cursor: pointer;
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 18px 40px -20px rgba(15, 23, 42, 0.5);
        transform: translateX(-50%) translateY(var(--lift, 0px))
                   rotate(var(--rot, 0deg)) scale(var(--s, 1));
        transition:
          transform 750ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 550ms ease,
          box-shadow 550ms ease;
        will-change: transform, opacity;
      }

      .pgx-layer:focus-visible {
        outline: 2px solid #ffffff;
        outline-offset: 3px;
        z-index: 70 !important;
      }

      .pgx-layer img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        user-select: none;
        -webkit-user-drag: none;
      }

      .pgx-layer:not(.pgx-r0) img { filter: brightness(0.95) saturate(0.96); }

      /* ------------------------- MOBILE (default) --------------------- */
      .pgx-r0 { --w: 82%; --x: 0%;   --y: 2%;   --s: 1.05; --r: 16px; --rot: 0deg; }
      .pgx-r1 { --w: 72%; --x: 14%;  --y: 46%; --s: 0.82; --r: 14px; --rot: 1.4deg; opacity: 0.96; }
      .pgx-r2 { --w: 62%; --x: -15%; --y: 78%; --s: 0.74; --r: 14px; --rot: -1.6deg; opacity: 0.9; }
      .pgx-r3,
      .pgx-rh { --w: 58%; --x: 4%;   --y: 100%; --s: 0.64; --r: 14px; --rot: 1deg; opacity: 0; pointer-events: none; }

      /* ------------------------------ TABLET -------------------------- */
      @media (min-width: 768px) {
        .pgx-stage { height: clamp(430px, 62vw, 500px); }
        .pgx-r0 { --w: 78%; --s: 1.03; --r: 18px; }
        .pgx-r1 { --w: 66%; --x: 12%; --y: 30%; --s: 0.84; --rot: 1.3deg; }
        .pgx-r2 { --w: 56%; --x: -14%; --y: 50%; --s: 0.75; --rot: -1.5deg; }
        .pgx-r3 { --y: 72%; opacity: 0.92; pointer-events: auto; }
        .pgx-rh { --y: 98%; }
      }

      /* ----------------------------- DESKTOP -------------------------- */
      @media (min-width: 1024px) {
        .pgx-stage { height: clamp(520px, 60vw, 600px); }
        .pgx-r0 { --w: 80%; --s: 1.06; --r: 22px; box-shadow: 0 34px 68px -26px rgba(15, 23, 42, 0.6); }
        .pgx-r1 { --w: 68%; --x: 16%; --y: 34%; --s: 0.86; --rot: 1.4deg; }
        .pgx-r2 { --w: 56%; --x: -18%; --y: 54%; --s: 0.76; --rot: -1.6deg; }
        .pgx-r3 { --x: 6%;  --y: 78%; --w: 48%; --s: 0.66; --rot: 1deg; opacity: 0.92; }
        .pgx-rh { --y: 103%; --w: 44%; --s: 0.6; --rot: -0.8deg; opacity: 0; }
      }

      /* Hover (fine pointers only): subtle lift / reveal, never aggressive. */
      @media (hover: hover) and (pointer: fine) {
        .pgx-layer:not(.pgx-r0):hover {
          --lift: -5px;
          opacity: 1;
          box-shadow: 0 28px 54px -24px rgba(15, 23, 42, 0.55);
        }
        .pgx-layer:not(.pgx-r0):hover img { filter: none; }
        .pgx-r0:hover { --lift: -2px; }
      }

.pgx-controls {
        margin-top: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.25rem;
      }

      .pgx-btn {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.18);
        background: #ffffff;
        color: #1e293b;
        cursor: pointer;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .pgx-btn:hover { background: #f1f5f9; }
      .pgx-btn:focus-visible { outline: 2px solid #1e3a8a; outline-offset: 2px; }
      .pgx-btn:disabled { opacity: 0.4; cursor: default; }
      .pgx-btn svg { width: 18px; height: 18px; }

      :host-context([dir='rtl']) .pgx-btn--prev svg,
      :host-context([dir='rtl']) .pgx-btn--next svg { transform: scaleX(-1); }

      .pgx-counter {
        min-width: 4.5rem;
        text-align: center;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        color: #475569;
        font-variant-numeric: tabular-nums;
      }

      @media (min-width: 768px) {
        .pgx-controls { position: absolute; inset: 0; z-index: 100; margin: 0; pointer-events: none; }
        .pgx-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: auto;
          background: rgba(255, 255, 255, 0.88);
          border-color: rgba(15, 23, 42, 0.12);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10);
        }
        .pgx-btn--prev { left: 0.75rem; }
        .pgx-btn--next { right: 0.75rem; }
        :host-context([dir='rtl']) .pgx-btn--prev { left: auto; right: 0.75rem; }
        :host-context([dir='rtl']) .pgx-btn--next { right: auto; left: 0.75rem; }
        .pgx-counter {
          position: absolute;
          bottom: 0.85rem;
          inset-inline-end: 0.85rem;
          min-width: 0; z-index: 110;
          padding: 0.25rem 0.7rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.55);
          color: #ffffff;
        }
      }

      /* Desktop: translucent floating controls layered above all image cards (cards live inside the isolated stage context). */
      @media (min-width: 768px) {
        .pgx-btn {
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }
        .pgx-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.98);
          transform: translateY(calc(-50% - 1px));
          box-shadow: 0 10px 22px -8px rgba(15, 23, 42, 0.16);
        }
        @supports (backdrop-filter: blur(6px)) {
          .pgx-btn { background: rgba(255, 255, 255, 0.72); backdrop-filter: blur(6px); }
          .pgx-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.85); }
        }
      }

      /* Compact in-flow controls on small phones (they sit below the stage). */
      @media (max-width: 639px) {
        .pgx-btn { width: 40px; height: 40px; }
        .pgx-btn svg { width: 16px; height: 16px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .pgx-layer { transition-duration: 1ms; }
      }
    `,
  ],
  template: `
    <div class="pgx">
      <div
        class="pgx-stage"
        role="group"
        aria-roledescription="carousel"
        [attr.aria-label]="altText()"
        (pointerenter)="onStagePointerEnter()"
        (pointerleave)="onStagePointerLeave()"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      >
        @for (src of images(); track src; let i = $index) {
          <button
            type="button"
            [class]="'pgx-layer ' + layerClass(i)"
            [style.zIndex]="50 - rankOf(i)"
            (click)="onLayerClick(i)"
            [attr.aria-label]="altFor(i)"
            [attr.aria-current]="i === activeIndex() ? 'true' : null"
          >
            <img
              [ngSrc]="src"
              width="1280"
              height="960"
              [alt]="altFor(i)"
              [loading]="i === activeIndex() ? 'eager' : 'lazy'"
              [attr.fetchpriority]="i === activeIndex() ? 'high' : null"
            />
          </button>
        }
      </div>

      <div class="pgx-controls">
        <button
          type="button"
          class="pgx-btn pgx-btn--prev"
          (click)="previous()"
          aria-label="Previous image"
          [disabled]="images().length < 2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <p class="pgx-counter" aria-live="polite">
          {{ counter().current }} / {{ counter().total }}
        </p>

        <button
          type="button"
          class="pgx-btn pgx-btn--next"
          (click)="next()"
          aria-label="Next image"
          [disabled]="images().length < 2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class ProjectGalleryComponent {
  readonly images = input<string[]>([]);
  readonly altText = input<string>('');

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Index (into the original, immutable array) of the principal image. */
  readonly activeIndex = signal(0);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private swipeStart: { x: number; y: number; t: number } | null = null;
  private lastSwipeAt = 0;

  private readonly reduceMotion: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly hoverCapable: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(hover: hover) and (pointer: fine)').matches;

  constructor() {
    this.scheduleAutoplay(GALLERY_AUTOPLAY_MS);
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  /** Compact 01 / 05 counter. */
  readonly counter = computed(() => {
    const total = String(this.images().length).padStart(2, '0');
    const current = String(this.activeIndex() + 1).padStart(2, '0');
    return { current, total };
  });

  /** Circular distance from the principal image (0 = principal). */
  rankOf(i: number): number {
    const n = this.images().length || 1;
    return (i - this.activeIndex() + n) % n;
  }

  /** Deterministic slot class for a layer at rank r. */
  layerClass(i: number): string {
    const r = this.rankOf(i);
    if (r === 0) return 'pgx-r0';
    if (r >= 1 && r <= 3) return `pgx-r${r}`;
    return 'pgx-rh';
  }

  altFor(i: number): string {
    return this.images().length ? `${this.altText()} ${i + 1}` : '';
  }

  next(): void {
    this.step(1);
  }

  previous(): void {
    this.step(-1);
  }

  /** Clicking any image promotes it to principal and resets the countdown. */
  onLayerClick(i: number): void {
    // Ignore the synthetic click that follows a swipe gesture.
    if (Date.now() - this.lastSwipeAt < 350) return;
    if (i === this.activeIndex()) {
      this.scheduleAutoplay(INTERACTION_RESUME_MS);
      return;
    }
    this.activeIndex.set(i);
    this.scheduleAutoplay(INTERACTION_RESUME_MS);
  }

  /** Desktop only: hovering the stage pauses the whole scheduler. */
  onStagePointerEnter(): void {
    if (this.hoverCapable && !this.reduceMotion) this.clearTimer();
  }

  onStagePointerLeave(): void {
    if (this.hoverCapable && !this.reduceMotion) {
      this.scheduleAutoplay(GALLERY_AUTOPLAY_MS);
    }
  }

  onPointerDown(ev: PointerEvent): void {
    this.swipeStart = { x: ev.clientX, y: ev.clientY, t: Date.now() };
  }

  onPointerUp(ev: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start || this.images().length < 2) return;
    if (Date.now() - start.t > 800) return;

    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dy) > SWIPE_MAX_DY_PX) return;

    this.lastSwipeAt = Date.now();
    const rtl = this.document.documentElement.dir === 'rtl';
    const forward = rtl ? dx > 0 : dx < 0;
    this.step(forward ? 1 : -1);
  }

  // -------------------------------------------------------------------
  //  Single autoplay scheduler (one chained timeout, always cleaned up)
  // -------------------------------------------------------------------

  private step(dir: 1 | -1): void {
    const n = this.images().length;
    if (n < 2) return;
    this.activeIndex.update(v => (v + dir + n) % n);
    this.scheduleAutoplay(INTERACTION_RESUME_MS);
  }

  private scheduleAutoplay(ms: number): void {
    this.clearTimer();
    if (this.reduceMotion || this.images().length < 2) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.activeIndex.update(v => (v + 1) % (this.images().length || 1));
      this.scheduleAutoplay(GALLERY_AUTOPLAY_MS);
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
