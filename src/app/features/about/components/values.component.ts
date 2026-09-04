import {
  Component,
  signal,
  computed,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';
import { ValueCardComponent } from './value-card.component';
import { CompanyValue, COMPANY_VALUES } from './values.data';

/**
 * Number of orbit slots (equal to the number of values).
 * A single scheduler keeps the state deterministic: every value advances to
 * the next clockwise slot when the offset increments.
 */
const SLOT_COUNT = 6;

/** Clockwise slot angles in degrees (0 = right, positive = downward). */
const SLOT_ANGLES = [-90, -30, 30, 90, 150, 210];

/** The slot that carries the "active / front" emphasis (bottom-most). */
const FRONT_SLOT = 3;

/**
 * Half-width (degrees) of the tiny invisible stub arc that carries each
 * arrowhead. The stub runs clockwise, so the auto-oriented marker points
 * along the true circular tangent at the arc midpoint.
 */
const ARROW_HEAD_STUB_DEG = 2;

/** SVG user-space orbit geometry of the arrow layer: the viewBox is sized so
 *  that radius 100 user units renders at exactly --values-r px — the circle
 *  passing through the CENTERS of the six value cards. */
const ARROW_SVG_RADIUS = 100;
const ARROW_SVG_CENTER = 100;

/** Point on the card-center orbit circle at `angleDeg` (0 = right, clockwise). */
function pointOnOrbit(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const fmt = (v: number) => String(Number(v.toFixed(2)));
  return (
    fmt(ARROW_SVG_CENTER + ARROW_SVG_RADIUS * Math.cos(rad)) +
    ' ' +
    fmt(ARROW_SVG_CENTER + ARROW_SVG_RADIUS * Math.sin(rad))
  );
}

/**
 * The six arrowhead carriers, derived from the ONE orbit geometry model
 * (SLOT_ANGLES + card-center orbit radius). Segment i spans the 60° arc from
 * slot i to slot (i + 1) % SLOT_COUNT; only a tiny invisible stub around the
 * arc MIDPOINT is emitted, and its auto-oriented marker renders the only
 * visible part: the arrowhead at the exact middle of the connection,
 * pointing along the clockwise circular tangent. The end angle normalization
 * is inherent here (cos/sin handle any angle), so F -> A uses the exact same
 * rule as the other five segments. The "lead" head is the one on the segment
 * entering the front (active) slot.
 */
const ARROW_PATHS: readonly { d: string; lead: boolean }[] = SLOT_ANGLES.map(
  (startAngle, i) => {
    const mid = startAngle + 180 / SLOT_COUNT;
    return {
      d: `M ${pointOnOrbit(mid - ARROW_HEAD_STUB_DEG)} A ${ARROW_SVG_RADIUS} ${ARROW_SVG_RADIUS} 0 0 1 ${pointOnOrbit(mid)}`,
      lead: (i + 1) % SLOT_COUNT === FRONT_SLOT
    };
  }
);

/** How long each orbit state stays visible before the next step. */
const DWELL_MS = 4000;

/** Reveal stagger between the six cards when the section enters view. */
const REVEAL_STAGGER_MS = 140;

/**
 * Values section orchestrator.
 *
 * Owns a single rotation timer, the active offset signal, the pause state and
 * the viewport reveal. It does not contain per-value card markup.
 */

@Component({
  selector: 'app-values',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent, ValueCardComponent],
  styles: [
    `
      :host {
        display: block;
      }

      /* The header (title + subtitle) now lives in the LEFT editorial column
         of the two-column layout, so the old rule that force-hid the header
         subtitle on >=768px is no longer needed. The intro paragraph below
         the header carries the general values philosophy (values_intro). */
      .values-editorial {
        min-width: 0; /* never let long translated words widen the grid track */
      }

      /* Left-align + typographically match the shared section header inside
         the editorial column (its own defaults are centered / text-3xl).
         Sizes mirror the Company Story (.cs-title / .cs-text) so the two
         sections read identically. Scoped ::ng-deep because the markup
         belongs to the child SectionHeaderComponent; only this instance is
         affected. */
      .values-editorial ::ng-deep app-section-header > div {
        text-align: start;
        margin-bottom: 0;
      }
      .values-editorial ::ng-deep app-section-header .flex {
        justify-content: flex-start;
      }
      .values-editorial ::ng-deep app-section-header h2 {
        margin: 0;
        font-size: clamp(1.75rem, 1.15rem + 2.2vw, 2.5rem);
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.015em;
        color: #0f172a;
      }
      .values-editorial ::ng-deep app-section-header p {
        margin: 0;
        margin-top: 1.25rem;
        font-size: 1rem;
        line-height: 1.75;
        color: #475569;
      }

      /* Intro paragraph mirrors .cs-text exactly. */
      .values-intro {
        margin: 0;
        max-width: 34rem;
        font-size: 1rem;
        line-height: 1.75;
        color: #475569;
        overflow-wrap: break-word;
      }

      @media (min-width: 1024px) {
        .values-intro {
          font-size: 1.0625rem;
        }
      }
    `
  ],
  template: `
    <section class="values-section">
      <!-- Decorative washed engineering photo: an absolutely positioned layer
           with its own opacity/filter so the content above stays fully opaque.
           Decorative only (aria-hidden) and pointer-events: none. -->
      <div class="values-background" aria-hidden="true"></div>

      <div class="container values-content mx-auto px-4">
        <div class="values-grid">
          <!-- LEFT: editorial introduction (static, presentational only).
               Does not name individual values — the orbit presents those. -->
          <div class="values-editorial">
            <app-section-header
              class="values-header"
              [title]="'values_title' | translate"
              [subtitle]="'values_subtitle' | translate"
            />
            <p class="values-intro">{{ 'values_intro' | translate }}</p>
          </div>

          <!-- RIGHT: the existing interactive orbit (design unchanged). -->
          <div
            class="values-orbit"
          #orbitShell
          (mouseenter)="onEnterZone()"
          (mouseleave)="onLeaveZone()"
          [class.revealed]="revealed()"
          role="group"
          [attr.aria-label]="'values_title' | translate"
        >
          <!-- Decorative rings connecting the center to the values -->
          <div class="values-ring-outer" aria-hidden="true"></div>
          <div class="values-ring-inner" aria-hidden="true"></div>

          <!-- Decorative clockwise direction arrows between the fixed orbit
               slots. The layer rotates by 60deg per orbit step with the same
               easing as the cards, so arrows and cards travel as ONE system;
               the 6-fold symmetric end state keeps the geometry correct.
               viewBox spans 220 units mapped onto 2.2 x --values-arrow-r, so
               radius 100 = --values-arrow-r exactly, with a 10-unit symmetric
               margin so no arrowhead can reach the SVG edge. -->
          @if (showOrbitArrows) {
          <div
            class="values-arrow-layer"
            aria-hidden="true"
            [style.transform]="'translate(-50%, -50%) rotate(' + activeOffset() * 60 + 'deg)'"
          >
            <svg viewBox="-10 -10 220 220" focusable="false">
              <defs>
                <marker
                  id="values-arrowhead"
                  viewBox="0 0 10 10"
                  refX="5.5"
                  refY="5"
                  markerWidth="8.3"
                  markerHeight="8.3"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M1 1.8 L8 5 L1 8.2" fill="none" stroke="#1e3a8a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
                </marker>
              </defs>
                                          <!-- Six INVISIBLE clockwise arc stubs, ONE per 60° slot section,
                   generated from the same orbit geometry as the cards (SLOT_ANGLES,
                   card-center radius). Each stub spans ±2° around the MIDPOINT of
                   its 60° connection and carries ONLY the arrowhead, auto-oriented
                   along the circular tangent — the connecting line itself is not
                   drawn. The lead head sits on the segment entering the front slot. -->
              @for (arrow of arrowPaths; track $index) {
                <path
                  class="values-arrow"
                  [class.values-arrow-lead]="arrow.lead"
                  [attr.d]="arrow.d"
                  marker-end="url(#values-arrowhead)"
                />
              }
              </svg>
          </div>
          }

          <!-- Center: large dynamic display of the currently focused value.
               The circular container stays mounted; only its content swaps. -->
          <div class="values-center">
            <div class="values-center-core">
              @for (v of [activeCenterValue()]; track v.id) {
                <div class="values-center-content">
                  <span class="values-center-icon" aria-hidden="true">
                    <i [class]="v.icon"></i>
                  </span>
                  <h3 class="values-center-title">{{ v.titleKey | translate }}</h3>
                  <p class="values-center-desc">{{ v.descriptionKey | translate }}</p>
                </div>
              }
              <div
                class="values-center-dots"
                role="group"
                [attr.aria-label]="'values_title' | translate"
              >
                @for (value of values; track value.id) {
                  <button
                    type="button"
                    class="values-center-dot"
                    [class.active]="isFront(value)"
                    [attr.aria-current]="isFront(value) ? 'true' : null"
                    [attr.aria-label]="value.titleKey | translate"
                    (click)="selectValue(value)"
                  ></button>
                }
              </div>
            </div>
          </div>

          <!-- Six values on fixed orbit slots. Each card is an accessible
               button: activating it focuses that value (orbit rotates, center
               and dots update, autoplay restarts from the selection). -->
          @for (value of values; track value.id) {
            <div class="values-slot" [style]="slotStyle(value)">
              <app-value-card [value]="value" [active]="isFront(value)" (select)="selectValue(value)" />
            </div>
          }
          </div>
        </div>
        <!-- /.values-grid -->

        <!-- Mobile: compact interactive disclosure (explore) -->
        <ul class="values-mobile" role="list">
          @for (value of values; track value.id) {
            <li class="values-mobile-item" [class.open]="activeMobileId() === value.id">
              <button
                type="button"
                class="values-mobile-trigger"
                (click)="toggleMobile(value.id)"
                [attr.aria-expanded]="activeMobileId() === value.id"
                [attr.aria-controls]="'value-panel-' + value.id"
              >
                <span class="values-mobile-icon" aria-hidden="true">
                  <i [class]="value.icon"></i>
                </span>
                <span class="values-mobile-title">{{ value.titleKey | translate }}</span>
                <span class="values-mobile-indicator" aria-hidden="true">
                  {{ activeMobileId() === value.id ? '−' : '+' }}
                </span>
              </button>
              <div
                class="values-mobile-panel"
                [id]="'value-panel-' + value.id"
                [class.open]="activeMobileId() === value.id"
              >
                <p>{{ value.descriptionKey | translate }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </section>
  `
})
export class ValuesComponent implements AfterViewInit, OnDestroy {
  readonly values = COMPANY_VALUES;

  /** Generated arrow geometry (same orbit model as the cards). */
  readonly arrowPaths = ARROW_PATHS;

  // ==========================================
  // VALUES ORBIT — ARROW VISIBILITY
  // true  = arrows visible (current approved design)
  // false = arrows hidden completely; the orbit, six value
  //         circles, center and rotation are untouched.
  // Toggle this value to compare both designs.
  // ==========================================
  readonly showOrbitArrows = false;

  /** Visual orbit rotation step (advanced by the single timer). */
  readonly activeOffset = signal(0);

  /**
   * The value currently occupying the front slot — the single source of truth
   * for the center display. Read-only: it only reads `activeOffset` through
   * the existing `slotIndex()` mapping (never writes to signals).
   */
  readonly activeCenterValue = computed<CompanyValue>(
    () => this.values.find((v) => this.slotIndex(v) === FRONT_SLOT) ?? this.values[0]
  );

  /** True while the user interacts with the orbit (hover / focus). */
  readonly isPaused = signal(false);

  /** True once the section has entered the viewport (one-shot reveal). */
  readonly revealed = signal(false);

  /** Id of the single expanded value in the mobile disclosure (null = none). */
  readonly activeMobileId = signal<string | null>(null);

  /** Respect prefers-reduced-motion by disabling the automatic orbit. */
  readonly reducedMotion = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  @ViewChild('orbitShell') shellRef?: ElementRef<HTMLElement>;

  constructor() {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.reducedMotion.set(true);
    }
  }

  ngAfterViewInit(): void {
    // Reveal immediately if the orbit is already in the viewport, otherwise
    // wait for the scroll listener below.
    this.tryReveal();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelTimer();
  }

  /** One-shot reveal when the orbit enters the viewport. */
  @HostListener('document:scroll')
  onScroll(): void {
    if (!this.revealed()) {
      this.tryReveal();
    }
  }

  private tryReveal(): void {
    const shell = this.shellRef?.nativeElement;
    if (!shell) {
      return;
    }
    const rect = shell.getBoundingClientRect();
    const viewportHeight = document.documentElement?.clientHeight ?? 0;
    // Consider it "entered viewport" once its top passes an 85% mark.
    if (rect.top < viewportHeight * 0.85 && rect.bottom > 0) {
      this.revealed.set(true);
      this.scheduleNext();
    }
  }

  /**
   * Map a value to the current clockwise orbit slot.
   * The data array is never reordered — only the visual offset changes.
   */
  slotIndex(value: CompanyValue): number {
    const index = this.values.indexOf(value);
    return (index + this.activeOffset()) % SLOT_COUNT;
  }

  /** Whether this value currently occupies the emphasized front slot. */
  isFront(value: CompanyValue): boolean {
    return this.slotIndex(value) === FRONT_SLOT;
  }

  /** Inline style: orbit placement (responsive radius via CSS var) + reveal delay. */
  slotStyle(value: CompanyValue): string {
    const slot = this.slotIndex(value);
    const angle = SLOT_ANGLES[slot];
    const delay = this.values.indexOf(value) * REVEAL_STAGGER_MS;
    return (
      'transform: translate(-50%,-50%) rotate(' +
      angle +
      'deg) translate(var(--values-r)) rotate(' +
      -angle +
      'deg);' +
      ' animation-delay: ' +
      delay +
      'ms;'
    );
  }

  /**
   * Mobile disclosure: open the tapped value, or close it if already open.
   * Only one value can be expanded at a time.
   */
  /**
   * Pagination navigation: rotate the orbit so `value` reaches the front slot.
   * Only `activeOffset` changes — the data array is never reordered — and the
   * dwell timer restarts so autoplay stays consistent after the interaction.
   */
  selectValue(value: CompanyValue): void {
    const index = this.values.indexOf(value);
    const offset = (FRONT_SLOT - index + SLOT_COUNT) % SLOT_COUNT;
    if (offset === this.activeOffset()) {
      return;
    }
    this.activeOffset.set(offset);
    this.scheduleNext();
  }

  toggleMobile(id: string): void {
    this.activeMobileId.update((current) => (current === id ? null : id));
  }

  onEnterZone(): void {
    this.isPaused.set(true);
    this.cancelTimer();
  }

  onLeaveZone(): void {
    this.isPaused.set(false);
    this.scheduleNext();
  }

  /** Schedule the single rotation step if idle / not paused / motion allowed. */
  private scheduleNext(): void {
    this.cancelTimer();
    if (this.destroyed || this.reducedMotion() || this.isPaused()) {
      return;
    }
    this.timer = setTimeout(() => this.advanceOnce(), DWELL_MS);
  }

  private advanceOnce(): void {
    this.timer = null;
    if (this.destroyed || this.reducedMotion() || this.isPaused()) {
      return;
    }
    this.activeOffset.set((this.activeOffset() + 1) % SLOT_COUNT);
    this.scheduleNext();
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
