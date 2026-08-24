import { Component, input } from '@angular/core';
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
        gap: 0.45rem;
        text-align: center;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 0.85rem 1.1rem;
        border-radius: 9999px;
        background: linear-gradient(150deg, rgba(255, 255, 255, 0.96) 0%, rgba(226, 232, 240, 0.12) 100%);
        border: 1.5px solid rgba(30, 58, 138, 0.22);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(15, 23, 42, 0.08);
        color: #1e3a8a;
        transition: transform 0.35s ease-out, box-shadow 0.35s ease-out;
      }

      .value-card.active {
        transform: scale(1.05);
        background: linear-gradient(150deg, #ffffff 0%, #dbeafe 70%, rgba(30, 58, 138, 0.06) 100%);
        border: 2.5px solid rgba(30, 58, 138, 0.65);
        box-shadow: 0 18px 46px rgba(30, 58, 138, 0.28), 0 2px 6px rgba(15, 23, 42, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.7);
        color: #1e3a8a;
      }

      .value-card .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 9999px;
        background: rgba(30, 58, 138, 0.07);
        color: #1e40af;
      }

      .value-card .icon i {
        font-size: 1.25rem;
        line-height: 1;
      }

      .value-card.active .icon {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b5bdb 100%);
        color: #ffffff;
        box-shadow: 0 6px 18px rgba(30, 58, 138, 0.32);
      }

      .value-card h3 {
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.1;
        margin: 0;
      }

      .value-card p {
        font-size: 0.78rem;
        line-height: 1.4;
        max-width: 11.5rem;
        margin: 0;
        color: rgba(30, 58, 138, 0.82);
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
      [attr.title]="value().titleKey | translate"
    >
      <span class="icon">
        <i [class]="value().icon" aria-hidden="true"></i>
      </span>
      <h3>{{ value().titleKey | translate }}</h3>
      <p>{{ value().descriptionKey | translate }}</p>
    </button>
  `
})
export class ValueCardComponent {
  readonly value = input.required<CompanyValue>();
  readonly active = input(false);
}