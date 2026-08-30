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
const GALLERY_AUTOPLAY_MS = 3000;
/** Grace period after a manual interaction before autoplay resumes. */
const INTERACTION_RESUME_MS = 3000;
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
      /* ==============================================================
       * HOW TO TWEAK THIS GALLERY
       * To resize/move/rotate a panel, edit the --w, --x, --y, --rot
       * values in the "MY CUSTOM OVERRIDES" block at the BOTTOM of
       * this styles array. It sits AFTER every media query, so its
       * values always win on every screen size. Save + refresh the
       * browser to see changes.
       *
       * Variable legend (consumed by the .pgx-layer rule below):
       *   --w   width  (% of stage width)
       *   --x   horizontal offset from stage center (negative = left)
       *   --y   top edge (%, of stage height; negative = up)
       *   --rot tilt (positive = clockwise, negative = counter)
       *   --s   overall scale (1 = natural)
       *   --r   corner radius
       *   --lift upward nudge on hover (px)
       * ============================================================== */
      :host { display: block; }

      .pgx { position: relative; isolation: isolate; width: 100%; max-width: 680px; margin-inline: auto; }

      /* ------------------------------------------------------------------
       * Editorial CORNER composition: CENTER + TOP-LEFT / TOP-RIGHT /
       * BOTTOM-LEFT / BOTTOM-RIGHT, all with different sizes. Z-order:
       * BOTTOM pair (34) covers the CENTER (30) slightly (~11% of its
       * height); the CENTER covers the TOP pair (26). Opposing left-pair
       * rotations create the editorial side conflict. Rank drives position,
       * size, rotation, z-index and opacity; each card physically animates
       * into its new slot. All 5 slots are always valid and visible.
       * ------------------------------------------------------------------ */
      .pgx-stage {
        position: relative;
        width: 100%;
        height: clamp(470px, 126vw, 540px);
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

      /* ------------------------- MOBILE (default) ---------------------
       * Corner geometry, z-order: BOTTOM pair (34) > CENTER (30) > TOP
       * pair (26). Bottom corners cover the center slightly (~11% of its
       * height); the center covers the top corners. All four secondary
       * sizes differ. No horizontal escape. */
      .pgx-r0 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 72%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 0%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 25%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 0deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 1;
        /* CHANGE THIS to corner roundness */
        --r: 18px;
        z-index: 30;
      }
      .pgx-r1 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 32%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 11%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 1.8deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.94;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: 26;
      }
      .pgx-r2 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 28%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 62.5%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -1.4deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.9;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: 34;
      }
      .pgx-r3 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 30%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 62%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -3deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.92;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: 34;
      }
      .pgx-r4 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 34%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -29%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 8%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 3deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.94;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: 26;
      }
      .pgx-rh { --w: 40%; --x: 0%;    --y: 30%;  --s: 0.8;  --r: 14px; --rot: 0.6deg;  z-index: 20; opacity: 0; pointer-events: none; }

      /* ------------------------------ TABLET --------------------------
       * Same relationships, compressed: bottom corners still overlap the
       * center from ABOVE; top corners still sit UNDER the center. */
      @media (min-width: 768px) {
        .pgx-stage { height: clamp(520px, 96vw, 600px); }
      .pgx-r0 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 54%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: ;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 28%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: ;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: 20px;
        z-index: ;
      }
      .pgx-r1 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 30%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 30%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 9%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 1.7deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r2 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 28%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 31%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 65%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -1.4deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r3 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 30%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -32%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 65%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -3.2deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r4 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 32%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 7%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 3.2deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      }

      /* ----------------------------- DESKTOP --------------------------
       * Full composition: large center (52%) framed by four differently
       * sized corners (34/30/32/28). Bottom pair overlaps the center by
       * ~11% of its height and covers it; top pair dips under it. The
       * opposing left-pair rotations create the editorial side conflict. */
      @media (min-width: 1024px) {
        .pgx-stage { height: clamp(560px, 94vw, 660px); }
      .pgx-r0 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 52%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: ;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 29%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: ;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: ;
        /* CHANGE THIS to corner roundness */
        --r: 22px;
        z-index: ;
      }
      .pgx-r1 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 30%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 30%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 10%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 1.8deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r2 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 28%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 32%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 66%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -1.4deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r3 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 32%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -32%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 66%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -3.5deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.94;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      .pgx-r4 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 34%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 8%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 3.5deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: ;
        z-index: ;
      }
      }

      /* Hover (fine pointers only): subtle lift / reveal, never aggressive.
         Bottom pair rises above siblings (may cover center - it already
         does); TOP pair is capped BELOW the center so the center image is
         never obscured by a hovered top corner. */
      @media (hover: hover) and (pointer: fine) {
        .pgx-r2:hover,
        .pgx-r3:hover {
          --lift: -5px;
          --s: 1.02;
          opacity: 1;
          z-index: 38;
          box-shadow: 0 28px 54px -24px rgba(15, 23, 42, 0.55);
        }
        .pgx-r1:hover,
        .pgx-r4:hover {
          --lift: -5px;
          --s: 1.02;
          opacity: 1;
          z-index: 29;
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

      /* ==============================================================
       * MY CUSTOM OVERRIDES - change here to see immediate changes
       * --------------------------------------------------------------
       * Edit --w / --x / --y / --rot (and optionally --s / --r /
       * --lift) below. This block is the LAST declaration of these
       * selectors, so it wins over the mobile/tablet/desktop blocks
       * above on EVERY screen size (same specificity => source order
       * decides). Values below are the current live desktop values,
       * so the gallery looks identical until you change something.
       * ============================================================== */
      .pgx-r0 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 52%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 0%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 29%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 0deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 1;
        /* CHANGE THIS to corner roundness */
        --r: 22px;
        z-index: ;
      }
      .pgx-r1 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 48%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 20%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 10%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 1.8deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: ;
      }
      .pgx-r2 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 48%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 26%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 60%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -1.4deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: ;
      }
      .pgx-r3 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 50%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -32%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 54%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: -3.5deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.94;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: ;
      }
      .pgx-r4 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 55%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 14%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 3.5deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.96;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: ;
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
        @for (src of validImages(); track src; let i = $index) {
          @if (!hasFailed(src)) {
            <button
              type="button"
              [class]="'pgx-layer ' + layerClass(i)"
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
                (error)="onImgError(src)"
              />
            </button>
          }
        }
      </div>

      <div class="pgx-controls">
        <button
          type="button"
          class="pgx-btn pgx-btn--prev"
          (click)="previous()"
          aria-label="Previous image"
          [disabled]="validImages().length < 2"
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
          [disabled]="validImages().length < 2"
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

  /**
   * Sources whose <img> failed to load. Failed images are removed from the
   * stack gracefully (no broken-image icon); the remaining layers keep the
   * composition functional. Immutable updates keep OnPush change detection
   * correct.
   */
  private readonly failedImages = signal<ReadonlySet<string>>(new Set<string>());

  /** True once the given source has failed to load (hidden from the stack). */
  protected hasFailed(src: string): boolean {
    return this.failedImages().has(src);
  }

  /** Sources that are actually loadable. The stack is built ONLY from these,
   *  so a broken image frees its slot and the next valid image fills it —
   *  the gallery renders one card per valid image (up to 5 slots). */
  protected readonly validImages = computed(() =>
    this.images().filter(src => !this.failedImages().has(src)),
  );

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
    const total = String(this.validImages().length).padStart(2, '0');
    const current = String(this.activeIndex() + 1).padStart(2, '0');
    return { current, total };
  });

  /** Circular distance from the principal image (0 = principal). */
  rankOf(i: number): number {
    const n = this.validImages().length || 1;
    return (i - this.activeIndex() + n) % n;
  }

  /** Deterministic slot class for a layer at rank r.
   *  Corner composition: 0 = CENTER, 1 = TOP-RIGHT, 2 = BOTTOM-RIGHT,
   *  3 = BOTTOM-LEFT, 4 = TOP-LEFT, >= 5 = hidden entry slot. */
  layerClass(i: number): string {
    const r = this.rankOf(i);
    if (r === 0) return 'pgx-r0';
    if (r >= 1 && r <= 4) return `pgx-r${r}`;
    return 'pgx-rh';
  }

  altFor(i: number): string {
    return this.validImages().length ? `${this.altText()} ${i + 1}` : '';
  }

  /** Gracefully drop a broken image from the stack (no broken-image icon). */
  onImgError(src: string): void {
    this.failedImages.update(prev => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
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
    if (!start || this.validImages().length < 2) return;
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
    const n = this.validImages().length;
    if (n < 2) return;
    this.activeIndex.update(v => (v + dir + n) % n);
    this.scheduleAutoplay(INTERACTION_RESUME_MS);
  }

  private scheduleAutoplay(ms: number): void {
    this.clearTimer();
    if (this.reduceMotion || this.validImages().length < 2) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.activeIndex.update(v => (v + 1) % (this.validImages().length || 1));
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
