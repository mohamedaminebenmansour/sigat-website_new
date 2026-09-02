import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';

const GALLERY_AUTOPLAY_MS = 3000;
const INTERACTION_RESUME_MS = 3000;
const SWIPE_THRESHOLD_PX = 42;
const SWIPE_MAX_DY_PX = 80;
const TRAVEL_MS = 950;

const SLOT_DEFS = [
  { id: 'center', cssClass: 'pgx-r0' },
  { id: 'topRight', cssClass: 'pgx-r1' },
  { id: 'bottomRight', cssClass: 'pgx-r2' },
  { id: 'bottomLeft', cssClass: 'pgx-r3' },
  { id: 'topLeft', cssClass: 'pgx-r4' },
] as const;

type SlotId = (typeof SLOT_DEFS[number])['id'];
type SlotIndex = 0 | 1 | 2 | 3 | 4;

interface GalleryCard {
  key: number;
  src: string;
  /** Visual slot index (0 = primary center). */
  slot: SlotIndex;
  cssClass: string;
  alt: string;
  isCenter: boolean;
}

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
       *   --h   height (any CSS length, e.g. 260px; overrides the automatic
       *         4:3 aspect-ratio for that slot — leave unset for auto ratio)
       *   --x   horizontal offset from stage center (negative = left)
       *   --y   top edge (%, of stage height; negative = up)
       *   --rot tilt (positive = clockwise, negative = counter)
       *   --s   overall scale (1 = natural)
       *   --r   corner radius
       *   --lift upward nudge on hover (px)
       * ============================================================== */
      :host { display: block; }

      .pgx { position: relative; isolation: isolate; width: 100%; max-width: 680px; margin-inline: auto; overflow: hidden; min-width: 0; }

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
        height: clamp(440px, 130vw, 560px);
        touch-action: pan-y;
      }

      .pgx-layer {
        position: absolute;
        left: calc(50% + var(--x, 0%));
        top: var(--y, 0%);
        width: var(--w, 70%);
        /* Manual height override: set --h (e.g. 260px) on a slot to fix its
           height. When --h is unset this computes to auto and the 4:3
           aspect-ratio below controls the size — behavior unchanged. */
        height: var(--h, auto);
        /* If --h is unset the fallback 4 / 3 applies as before. If --h holds
           a length (e.g. 260px), the var() substitution makes this value
           invalid at computed-value time, so aspect-ratio resets to its
           initial value (auto) and the explicit height wins. */
        aspect-ratio: var(--h, 4 / 3);
        padding: 0;
        overflow: hidden;
        border-radius: var(--r, 16px);
        background: #0f172a;
        cursor: pointer;
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 18px 40px -20px rgba(15, 23, 42, 0.5);
        transform: translateX(-50%) translateY(var(--lift, 0px))
                   rotate(var(--rot, 0deg)) scale(var(--s, 1))
                   var(--flip, scale(1) translate(0));
        transition:
          left 750ms cubic-bezier(0.22, 1, 0.36, 1),
          top 750ms cubic-bezier(0.22, 1, 0.36, 1),
          width 750ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 750ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 550ms ease,
          box-shadow 550ms ease;
        will-change: transform, opacity;
      }
      .pgx-layer.pgx-flipping { transition: none !important; }

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

      /* Crossfade: stable slot content swap (never moves the slot itself). */
      .pgx-img-stack {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .pgx-img {
        transition: opacity 700ms ease;
        will-change: opacity;
      }

      .pgx-img-hidden {
        opacity: 0;
        pointer-events: none;
      }

      /* ------------------------- MOBILE (default) ---------------------
       * Corner geometry, z-order: BOTTOM pair (34) > CENTER (30) > TOP
       * pair (26). Bottom corners cover the center slightly (~11% of its
       * height); the center covers the top corners. All four secondary
       * sizes differ. No horizontal escape. */
      .pgx-r0 {
        /* CHANGE THIS to make the panel wider/narrower (percentage of stage width) */
        --w: 82%;
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
        --w: 62%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 21%;
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
        --w: 48%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: 28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 72.5%;
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
        --w: 50%;
        /* CHANGE THIS to move it left/right (negative = left, positive = right) */
        --x: -28%;
        /* CHANGE THIS to move it up/down (negative = up, positive = down) */
        --y: 72%;
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
        --y: 18%;
        /* CHANGE THIS to tilt the panel (positive = clockwise, negative = counter) */
        --rot: 3deg;
        /* CHANGE THIS to scale the whole card (1 = natural size) */
        --s: 0.94;
        /* CHANGE THIS to corner roundness */
        --r: 14px;
        z-index: 26;
      }

      /* ------------------------------ TABLET --------------------------
       * Same relationships, compressed: bottom corners still overlap the
       * center from ABOVE; top corners still sit UNDER the center. */
      @media (min-width: 768px) {
        .pgx-stage { height: clamp(540px, 72vw, 640px); }
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
        .pgx-stage { height: clamp(660px, 80vh, 820px); }
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
        .pgx-img { transition-duration: 1ms; }
      }

      /* ==============================================================
       * MY CUSTOM OVERRIDES - change here to see immediate changes
       * --------------------------------------------------------------
       * ASYMMETRIC EDITORIAL COLLAGE (tablet + desktop, >=768px):
       *   r0  = MAIN / LARGE    (dominant upper-left anchor)
       *   r1  = UPPER RIGHT     (small, dips over MAIN's top-right)
       *   r4  = MIDDLE / BACK   (sits behind LOWER-RIGHT/FRONT)
       *   r3  = LOWER LEFT      (counterweight, overlaps MIDDLE/BACK)
       *   r2  = LOWER RIGHT/FRONT (strong foreground, overlaps MIDDLE)
       * Z-index layers the collage:  BACK = r0(2) / r4(3),
       *   MIDDLE = r4(3),  FRONT = r1(4) / r3(4) / r2(5).
       * All size/position values are percentages of the live stage and
       * are measured by the existing FLIP animation, so no animation or
       * timing logic is touched.
       *
       * This block is the LAST declaration of these selectors and is
       * gated to >=768px, so it wins over the tablet/desktop blocks on
       * those sizes while the base mobile layout (<768px) is preserved
       * unchanged.
       *
       * --h gives a slot a FIXED height (%, of stage height) and
       * disables the automatic 4:3 aspect-ratio for it; width stays
       * controlled by --w.
       * ============================================================== */
      @media (min-width: 768px) {
      .pgx-r0 {
        /* MAIN / LARGE - dominant upper-left anchor */
        --w: 74%;
        --h: 42%;
        --x: -11%;
        --y: 2%;
        --rot: 0deg;
        --s: 1;
        --r: 22px;
        z-index: 2;
      }
      .pgx-r1 {
        /* UPPER RIGHT - small, partially overlaps MAIN (top-right) */
        --w: 31.5%;
        --h: 28%;
        --x: 33.75%;
        --y: 17%;
        --rot: 1.6deg;
        --s: 1;
        --r: 16px;
        z-index: 4;
      }
      .pgx-r2 {
        /* LOWER RIGHT / FRONT - strong foreground layer */
        --w: 45%;
        --h: 38%;
        --x: 17.5%;
        --y: 60%;
        --rot: -1.2deg;
        --s: 1;
        --r: 18px;
        z-index: 5;
      }
      .pgx-r3 {
        /* LOWER LEFT - counterweight, overlaps MIDDLE/BACK */
        --w: 37%;
        --h: 29.5%;
        --x: -26.25%;
        --y: 51%;
        --rot: -2.2deg;
        --s: 1;
        --r: 16px;
        z-index: 4;
      }
      .pgx-r4 {
        /* MIDDLE / BACK - sits behind LOWER-RIGHT/FRONT */
        --w: 48.5%;
        --h: 33.5%;
        --x: 6.25%;
        --y: 39%;
        --rot: 0.6deg;
        --s: 1;
        --r: 18px;
        z-index: 3;
      }
      }
    `,
  ],
  template: `
    <div class="pgx">
      <div
        #stageEl
        class="pgx-stage"
        role="group"
        aria-roledescription="carousel"
        [attr.aria-label]="altText()"
        (pointerenter)="onStagePointerEnter()"
        (pointerleave)="onStagePointerLeave()"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      >
        @for (card of cards(); track card.key) {
          <button
            #slotEl
            type="button"
            [class]="'pgx-layer ' + card.cssClass"
            (click)="onLayerClick(card.slot)"
            [attr.aria-label]="card.alt"
            [attr.aria-current]="card.isCenter ? 'true' : null"
          >
            <img
              [ngSrc]="card.src"
              width="1280"
              height="960"
              class="pgx-img"
              [alt]="card.alt"
              [loading]="card.isCenter ? 'eager' : 'lazy'"
              [attr.fetchpriority]="card.isCenter ? 'high' : null"
              (error)="onImgError(card.src)"
            />
          </button>
        }
      </div>

      @if (cards().length >= 2) {
        <div class="pgx-controls">
          <button
            type="button"
            class="pgx-btn pgx-btn--prev"
            (click)="previous()"
            aria-label="Previous image"
            [disabled]="cards().length < 2"
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
            [disabled]="cards().length < 2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ProjectGalleryComponent {
  readonly images = input<string[]>([]);
  readonly altText = input<string>('');
  readonly cover = input<string>('');

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly offset = signal(0);

  private readonly failedImages = signal<ReadonlySet<string>>(new Set<string>());

  private readonly reduceMotion: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly hoverCapable: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(hover: hover) and (pointer: fine)').matches;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private swipeStart: { x: number; y: number; t: number } | null = null;
  private lastSwipeAt = 0;

  /** Transition lock (plain field, not a signal): prevents overlapping transitions. */
  private isTransitioning = false;
  private travelTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('stageEl') private stageEl?: ElementRef<HTMLElement>;
  @ViewChildren('slotEl') private slotEls?: QueryList<ElementRef<HTMLElement>>;

  constructor() {
    this.scheduleAutoplay(GALLERY_AUTOPLAY_MS);
    this.destroyRef.onDestroy(() => {
      this.clearTimer();
      if (this.travelTimer !== null) clearTimeout(this.travelTimer);
    });
  }

  readonly galleryImages = computed(() => {
    const raw = this.images();
    const cover = this.cover();
    const all = [cover, ...raw].filter((src): src is string => !!src && src.trim() !== '');
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const src of all) {
      if (!seen.has(src)) {
        seen.add(src);
        unique.push(src);
      }
    }
    return unique.filter(src => !this.failedImages().has(src));
  });

  readonly cards = computed<GalleryCard[]>(() => {
    const images = this.galleryImages();
    const n = images.length;
    if (n === 0) return [];

    const off = ((this.offset() % n) + n) % n;
    const count = Math.min(5, n);

    return Array.from({ length: count }, (_, i) => {
      const idx = (off + i) % n;
      return {
        key: idx,
        src: images[idx],
        slot: i as SlotIndex,
        cssClass: SLOT_DEFS[i].cssClass,
        alt: `${this.altText()} ${idx + 1}`,
        isCenter: i === 0,
      };
    });
  });

  readonly counter = computed(() => {
    const images = this.galleryImages();
    const n = images.length;
    if (n === 0) return { current: '00', total: '00' };
    const currentIdx = ((this.offset() % n) + n) % n;
    const current = String(currentIdx + 1).padStart(2, '0');
    const total = String(n).padStart(2, '0');
    return { current, total };
  });

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

  onLayerClick(slotIndex: SlotIndex): void {
    const images = this.galleryImages();
    const n = images.length;
    if (n < 2) return;
    if (Date.now() - this.lastSwipeAt < 350) return;

    if (slotIndex === 0) {
      this.scheduleAutoplay(INTERACTION_RESUME_MS);
      return;
    }

    const currentOffset = ((this.offset() % n) + n) % n;
    this.runTransition({
      sourceSlot: slotIndex,
      targetOffset: (currentOffset + slotIndex) % n,
      resumeMs: INTERACTION_RESUME_MS,
    });
  }

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
    if (!start || this.galleryImages().length < 2) return;
    if (Date.now() - start.t > 800) return;

    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dy) > SWIPE_MAX_DY_PX) return;

    this.lastSwipeAt = Date.now();
    const rtl = this.document.documentElement.dir === 'rtl';
    const forward = rtl ? dx > 0 : dx < 0;
    this.step(forward ? 1 : -1);
  }

  private step(dir: 1 | -1): void {
    const images = this.galleryImages();
    const n = images.length;
    if (n < 2) return;
    const current = ((this.offset() % n) + n) % n;
    this.runTransition({
      sourceSlot: (dir === 1 ? 1 : n - 1) as SlotIndex,
      targetOffset: (current + dir + n) % n,
      resumeMs: INTERACTION_RESUME_MS,
    });
  }

  /**
   * Single entry point for EVERY gallery transition (autoplay, arrows,
   * swipes and direct clicks). Guards against overlapping transitions and
   * plays the secondary -> primary travel animation, then hands back to
   * autoplay. All state mutation happens imperatively, never inside a
   * computed()/effect().
   */
  private runTransition(opts: {
    sourceSlot: SlotIndex;
    targetOffset: number;
    resumeMs: number;
  }): void {
    const n = this.galleryImages().length;
    if (n < 2) return;
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    this.beginFlip(opts.targetOffset);
    this.offset.set(((opts.targetOffset % n) + n) % n);
    this.scheduleAutoplay(opts.resumeMs);

    if (this.travelTimer !== null) clearTimeout(this.travelTimer);
    this.travelTimer = setTimeout(() => {
      this.isTransitioning = false;
      this.travelTimer = null;
      this.clearFlipStyles();
    }, TRAVEL_MS + 80);
  }

  /**
   * FLIP the REAL card elements. Each persistent <img> is keyed by its image
   * index (`cards().key`), so swapping a card's slot class moves that same DOM
   * element to a new position. We capture each card's old rect (FIRST), then
   * after the offset change we re-measure (LAST) and animate the same element
   * from old -> new via transform/scale + layout transitions. No clone / ghost
   * / duplicate image element is ever created.
   */
  private beginFlip(targetOffset: number): void {
    if (this.reduceMotion) return;
    if (!this.slotEls || !this.stageEl || this.slotEls.length < 1) return;
    const n = this.galleryImages().length;
    if (n < 2) return;

    // FIRST: record every visible card's current rect, keyed by image index.
    const first = new Map<number, DOMRect>();
    this.cards().forEach((card, i) => {
      const el = this.slotEls?.get(i);
      if (el) first.set(card.key, el.nativeElement.getBoundingClientRect());
    });

    // The offset change re-renders on the next change-detection cycle; wait two
    // frames so the DOM reflects the new slot assignments before measuring LAST.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.slotEls) return;

        const moving: { el: HTMLElement; dx: number; dy: number; sx: number }[] = [];

        this.cards().forEach((card, i) => {
          const ref = this.slotEls?.get(i);
          if (!ref) return;
          const f = first.get(card.key);
          if (!f) return; // entering card (n > 5) => appears in place, no ghost

          const el = ref.nativeElement;
          const last = el.getBoundingClientRect();
          const dx = f.left - last.left;
          const dy = f.top - last.top;
          const sx = f.width / last.width;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01) return;
          moving.push({ el, dx, dy, sx });
        });

        if (moving.length === 0) return;

        // INVERT: snap each real element back to its old spot (no transition),
        // measured from the live stage so the values are always viewport-correct.
        moving.forEach(m => {
          m.el.classList.add('pgx-flipping');
          m.el.style.setProperty('--flip', `translate(${m.dx}px, ${m.dy}px) scale(${m.sx})`);
        });
        const stage = this.stageEl?.nativeElement;
        if (stage) void stage.offsetHeight; // force reflow so the inverse is committed

        // PLAY: release the snap; the transition glides each real element to
        // its natural new slot position.
        moving.forEach(m => {
          m.el.classList.remove('pgx-flipping');
          m.el.style.setProperty('--flip', 'scale(1) translate(0)');
        });
      });
    });
  }

  /** Remove any leftover inline flip styles once the lock releases. */
  private clearFlipStyles(): void {
    if (!this.slotEls) return;
    this.slotEls.forEach(el => {
      el.nativeElement.style.removeProperty('--flip');
      el.nativeElement.classList.remove('pgx-flipping');
    });
  }

  private scheduleAutoplay(ms: number): void {
    this.clearTimer();
    const images = this.galleryImages();
    if (this.reduceMotion || images.length < 2) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const images = this.galleryImages();
      const n = images.length;
      if (n < 2) return;
      const current = ((this.offset() % n) + n) % n;
      this.runTransition({
        sourceSlot: 1,
        targetOffset: (current + 1) % n,
        resumeMs: GALLERY_AUTOPLAY_MS,
      });
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }
}
