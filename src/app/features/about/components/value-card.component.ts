import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CompanyValue } from './values.data';

/**
 * One reusable value card used by the Values orbit.
 *
 * The card is presentational: it receives a single `CompanyValue` and renders
 * its icon, translated title and translated description. Visual "active"
 * emphasis is controlled by the parent via the `active` input. No animation
 * state is owned here.
 */
@Component({
  selector: 'app-value-card',
  standalone: true,
  imports: [TranslatePipe],
  styles: [
    `
      :host {
        display: block;
      }

      .value-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        aspect-ratio: 1 / 1;
        box-sizing: border-box;
        padding: 0.7rem 0.8rem;
        border-radius: 9999px;
        overflow: hidden;
        background: linear-gradient(150deg, rgba(255, 255, 255, 0.96) 0%, rgba(226, 232, 240, 0.12) 100%);
        border: 1.5px solid rgba(30, 58, 138, 0.22);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(15, 23, 42, 0.08);
        color: #1e3a8a;
        font: inherit;
        cursor: pointer;
        transition: transform 0.35s ease-out, box-shadow 0.35s ease-out;
      }

      .value-card.active {
        transform: scale(1.05);
        background: linear-gradient(150deg, #ffffff 0%, #dbeafe 70%, rgba(30, 58, 138, 0.06) 100%);
        border: 2.5px solid rgba(30, 58, 138, 0.65);
        box-shadow: 0 18px 46px rgba(30, 58, 138, 0.28), 0 2px 6px rgba(15, 23, 42, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.7);
        color: #1e3a8a;
      }

      /* Inner content capsule: constrains icon/title/description so nothing
         reaches the pill's curved ends (keeps all text inside the circle). */
      .value-card__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.35rem;
        width: 100%;
        /* Percentage-based measure so the content capsule always stays inside
           the circular boundary at any card size. */
        max-width: 78%;
        margin-inline: auto;
        /* Long translated words (FR/AR) must wrap, never escape the circle. */
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .value-card .icon,
      .value-card .title {
        flex-shrink: 0;
      }

      .value-card .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 9999px;
        background: rgba(30, 58, 138, 0.07);
        color: #1e40af;
      }

      .value-card .icon i {
        font-size: 1.12rem;
        line-height: 1;
      }

      .value-card.active .icon {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b5bdb 100%);
        color: #ffffff;
        box-shadow: 0 6px 18px rgba(30, 58, 138, 0.32);
      }

      .value-card .title {
        display: block;
        font-size: clamp(0.78rem, 1.2vw, 0.86rem);
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.15;
        margin: 0;
        max-width: 100%;
      }

      .value-card .desc {
        display: -webkit-box;
        font-size: clamp(0.66rem, 0.95vw, 0.74rem);
        line-height: 1.32;
        max-width: 100%;
        margin: 0;
        color: rgba(30, 58, 138, 0.82);
        overflow-wrap: break-word;
        /* Progressive disclosure: the description may truncate; icon and title
           must always stay fully visible. The full text lives in the center. */
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .value-card:focus-visible {
        outline: 2px solid rgba(30, 58, 138, 0.6);
        outline-offset: 3px;
      }

      @media (max-width: 767px) {
        .value-card {
          height: auto;
          padding: 1rem 0.9rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .value-card {
          transition: none;
        }
      }
    `
  ],
  template: `
    <button
      type="button"
      class="value-card"
      [class.active]="active()"
      [attr.aria-label]="value().titleKey | translate"
      (click)="select.emit()"
    >
      <div class="value-card__content">
        <span class="icon">
          <i [class]="value().icon" aria-hidden="true"></i>
        </span>
        <span class="title">{{ value().titleKey | translate }}</span>
        <span class="desc">{{ value().descriptionKey | translate }}</span>
      </div>
    </button>
  `
})
export class ValueCardComponent {
  readonly value = input.required<CompanyValue>();
  readonly active = input(false);
  /** Emitted when the user activates the card (click / Enter / Space). */
  readonly select = output<void>();
}