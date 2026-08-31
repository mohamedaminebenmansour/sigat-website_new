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

      /* The center disc (>=768px) now presents the focused orbit value
         dynamically; the old static subtitle rule is no longer needed. */

      /* The center disc already carries this sentence on >=768px, so the header
         subtitle is hidden there and restored on mobile (project "md" breakpoint
         of 767px). ::ng-deep is required because the subtitle <p> lives inside
         the child SectionHeaderComponent; scoping it under .values-header keeps
         the rule local to this component's header instance. display:none avoids
         reserving layout space on desktop/tablet. */
      .values-header ::ng-deep p {
        display: none;
      }

      @media (max-width: 767px) {
        .values-header ::ng-deep p {
          display: block;
        }
      }
    `
  ],
  template: `
    <section class="values-section">
      <div class="values-container mx-auto px-4">
        <app-section-header
          class="values-header"
          [title]="'values_title' | translate"
          [subtitle]="'values_subtitle' | translate"
        />

        <!-- Desktop / tablet: automatic orbit presentation (observe only) -->
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

          <!-- Six values on fixed orbit slots (informational, non-interactive) -->
          @for (value of values; track value.id) {
            <div class="values-slot" [style]="slotStyle(value)">
              <app-value-card [value]="value" [active]="isFront(value)" />
            </div>
          }
        </div>

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
