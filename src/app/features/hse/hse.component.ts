import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_INFO } from '../../core/company/company-info';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { HseTrenchComponent } from './hse-trench.component';

/**
 * HSE & QUALITY — what SIGAT does on site, and where it stands on certification.
 * SIGAT is NOT ISO certified yet: the three standards are shown "in progress"
 * from COMPANY_INFO.certifications (flip a status to 'certified' when obtained).
 * No invented statistics.
 * Flow: commitments (white → foam) → ISO path (foam) → the shored trench, under the surface (site steps)
 * → (wave) CTA on light water #eaf5fd → footer.
 */
@Component({
  selector: 'app-hse',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeroComponent, HxRevealDirective, HseTrenchComponent],
  template: `
    <app-page-hero photo="assets/media/gallery/20230618-riprap" crumb="nav_hse" kicker="hse_kicker" title="hse_title" sub="hse_subtitle" fillBelow="#ffffff" [phase]="1.6" />

    <section class="pg hse-commit">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'hse_commit_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'hse_commit_title' | translate }}</h2>
        </header>
        <div class="pg-grid">
          @for (c of commits; track c.k) {
            <div class="pg-card hx-reveal" hxReveal>
              <i class="fa-solid {{ c.icon }}" aria-hidden="true"></i>
              <h3>{{ 'hse_c_' + c.k + '_t' | translate }}</h3>
              <p>{{ 'hse_c_' + c.k | translate }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="pg pg--foam">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'hse_iso_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'hse_iso_title' | translate }}</h2>
          <p class="hx-lead hx-lead--dark">{{ 'hse_iso_sub' | translate }}</p>
        </header>
        <div class="pg-grid">
          @for (c of certs; track c.std) {
            <div class="pg-card hx-reveal" hxReveal>
              <i class="fa-solid fa-certificate" aria-hidden="true"></i>
              <h3>{{ c.std }}</h3>
              <p>{{ 'hse_iso_' + c.key | translate }}</p>
              <p style="margin-top:.9rem">
                @if (c.status === 'certified') {
                  <span class="pg-badge pg-badge--done"><i class="fa-solid fa-check" aria-hidden="true"></i>{{ 'hse_iso_done' | translate }} {{ c.year }}</span>
                } @else {
                  <span class="pg-badge pg-badge--progress"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>{{ 'hse_iso_progress' | translate }}</span>
                }
              </p>
            </div>
          }
        </div>
      </div>
    </section>

    <app-hse-trench />

    <section class="pg cr-spont">
      <div class="hx-container">
        <div class="pg-cta">
          <div>
            <h2 class="hx-display">{{ 'hse_cta_title' | translate }}</h2>
            <p>{{ 'hse_cta_text' | translate }}</p>
          </div>
          <a routerLink="/contact" [queryParams]="{ type: 'client' }" class="hx-btn hx-btn--primary">{{ 'hse_cta_btn' | translate }}</a>
        </div>
      </div>
    </section>
  `
})
export class HseComponent {
  readonly certs = COMPANY_INFO.certifications;
  readonly commits = [
    { k: 'safety', icon: 'fa-helmet-safety' },
    { k: 'quality', icon: 'fa-clipboard-check' },
    { k: 'env', icon: 'fa-leaf' },
  ];
}
