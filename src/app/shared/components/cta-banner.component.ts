import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/**
 * ============================================================
 * MANUAL CTA BUTTON CONFIGURATION
 * ============================================================
 *
 * This is the MAIN MANUAL COLOR CONFIGURATION AREA for the CTA
 * button. Change any value here and the button reflects it
 * immediately — no need to touch the template or CSS.
 *
 * --- General --------------------------------------------------
 * `enabled`:
 *   Set `false` to hide the button entirely.
 *
 * `label`:
 *   The translation key used by the button. Uses the project's
 *   existing `nav_partner_cta` key (already present in fr/en/ar),
 *   so no new translation key is needed.
 *
 * `route`:
 *   The internal Angular route the button points to. Rendered with
 *   `[routerLink]` so navigation happens in-app (no page reload).
 *
 * `externalUrl`:
 *   Optional external URL. When set, it takes precedence over
 *   `route` and the button opens the link in a new tab.
 *
 * `variant`:
 *   Visual style. `'primary'` keeps the current orange design.
 *
 * --- Colors (edit here) ---------------------------------------
 * `backgroundColor`:
 *   Button fill color. e.g. change to '#1E3A8A' (SIGAT blue) and
 *   the button uses it immediately.
 *
 * `textColor`:
 *   Button label color.
 *
 * `hoverColor`:
 *   Fill color applied on hover / keyboard focus.
 *
 * `borderColor`:
 *   Optional border color. 'transparent' = no visible border.
 *   (Rendered via an inset shadow so the button size never shifts.)
 *
 * Keep this configuration centralized. Do not duplicate CTA
 * configuration in the template.
 * ============================================================
 */
@Component({
  selector: 'app-cta-banner',
  standalone: true,
  imports: [RouterLink],
  styles: [
    `
      .cta-button {
        background: var(--cta-bg);
        color: var(--cta-text);
        /* Border is rendered with an inset shadow so adding a border
           color never changes the button dimensions. */
        box-shadow: inset 0 0 0 1px var(--cta-border);
      }
      .cta-button:hover {
        background: var(--cta-hover);
      }
      .cta-button:focus-visible {
        background: var(--cta-hover);
        outline: 2px solid var(--cta-hover);
        outline-offset: 2px;
      }
    `,
  ],
  template: `
    <section
      class="py-10 md:py-12"
      style="background-color: rgb(32 56 167 / 82%)"
    >
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">{{ title() }}</h2>
        @if (description()) {
          <p class="text-lg text-gray-300 max-w-2xl mx-auto mb-8">{{ description() }}</p>
        }
        @if (buttonVisible) {
          @if (externalUrl) {
            <a
              [href]="externalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="cta-button inline-block font-semibold px-8 py-3 rounded-lg transition-colors text-base"
              [style.--cta-bg]="CTA_CONFIG.backgroundColor"
              [style.--cta-text]="CTA_CONFIG.textColor"
              [style.--cta-hover]="CTA_CONFIG.hoverColor"
              [style.--cta-border]="CTA_CONFIG.borderColor"
            >
              {{ buttonLabel }}
            </a>
          } @else {
            <a
              [routerLink]="ctaRoute"
              class="cta-button inline-block font-semibold px-8 py-3 rounded-lg transition-colors text-base"
              [style.--cta-bg]="CTA_CONFIG.backgroundColor"
              [style.--cta-text]="CTA_CONFIG.textColor"
              [style.--cta-hover]="CTA_CONFIG.hoverColor"
              [style.--cta-border]="CTA_CONFIG.borderColor"
            >
              {{ buttonLabel }}
            </a>
          }
        }
      </div>
    </section>
  `,
})
export class CtaBannerComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly buttonText = input<string>('');
  readonly buttonRoute = input<string>('');

  private readonly translate = inject(TranslateService);

  /**
   * ============================================================
   * MANUAL CTA BUTTON CONFIGURATION
   * ============================================================
   * MAIN MANUAL COLOR CONFIGURATION AREA — edit the colors below.
   * `backgroundColor` / `textColor` / `hoverColor` / `borderColor`
   * are consumed by the template via CSS variables.
   */
  protected readonly CTA_CONFIG = {
    enabled: true,
    label: 'nav_partner_cta',
    route: '/partnerships',
    externalUrl: null as string | null,
    variant: 'primary',

    // ==========================================================
    // MANUAL COLORS — change these values whenever needed.
    // ==========================================================
    backgroundColor: '#E59A2F', // orange (existing)
    textColor: '#FFFFFF',       // white
    hoverColor: '#D97706',      // darker orange on hover
    borderColor: 'transparent', // optional border (no visible border by default)
  };

  /** Whether the CTA button should be rendered. */
  protected readonly buttonVisible =
    this.CTA_CONFIG.enabled &&
    (this.CTA_CONFIG.externalUrl != null || this.CTA_CONFIG.route !== '');

  /** External URL (new tab) when configured, otherwise null. */
  protected readonly externalUrl = this.CTA_CONFIG.externalUrl;

  /** Internal Angular route used with [routerLink]. */
  protected readonly ctaRoute = this.CTA_CONFIG.route;

  /** Button text: explicit input wins, otherwise the configured translation key. */
  protected get buttonLabel(): string {
    if (this.buttonText()) {
      return this.buttonText();
    }
    return this.translate.instant(this.CTA_CONFIG.label);
  }
}
