import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_PROFILE_PDF } from '../../core/company/company-info';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { PartnershipsJointComponent } from './partnerships-joint.component';

/**
 * PARTNERSHIPS — who SIGAT works with, and the door for each of them.
 * Hero → why SIGAT (honest: no certification claimed, ISO is in progress)
 * → four kinds of partners, each linked to its contact route → process = a flanged joint made up on site
 * → profile CTA. Colours: white → foam → (under the surface) joint → (wave) light water #eaf5fd → footer.
 */
@Component({
  selector: 'app-partnerships',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeroComponent, HxRevealDirective, PartnershipsJointComponent],
  template: `
    <app-page-hero photo="assets/media/gallery/20240428-station" crumb="nav_partnerships" kicker="pt_kicker" title="pt_title" sub="pt_sub" fillBelow="#ffffff" [phase]="0.7">
      <a routerLink="/contact" [queryParams]="{ type: 'partner' }" class="hx-btn hx-btn--primary">{{ 'pt_cta_partner' | translate }}</a>
      <a routerLink="/contact" [queryParams]="{ type: 'supplier' }" class="hx-btn hx-btn--ghost">{{ 'pt_cta_supplier' | translate }}</a>
    </app-page-hero>

    <section class="pg pt-who">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'pt_who_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pt_who_title' | translate }}</h2>
          <p class="hx-lead hx-lead--dark">{{ 'pt_who_sub' | translate }}</p>
        </header>
        <div class="pg-grid">
          @for (w of who; track w.k) {
            <div class="pg-card hx-reveal" hxReveal>
              <i class="fa-solid {{ w.icon }}" aria-hidden="true"></i>
              <h3>{{ 'pt_who_' + w.k + '_t' | translate }}</h3>
              <p>{{ 'pt_who_' + w.k | translate }}</p>
              <a class="pg-card__link" routerLink="/contact" [queryParams]="{ type: w.type }">{{ 'pt_who_' + w.k + '_cta' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="pg pg--foam">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'pt_why_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pt_why_title' | translate }}</h2>
        </header>
        <div class="pg-grid">
          @for (w of why; track w.k) {
            <div class="pg-card hx-reveal" hxReveal>
              <i class="fa-solid {{ w.icon }}" aria-hidden="true"></i>
              <h3>{{ 'pt_why_' + w.k + '_t' | translate }}</h3>
              <p>{{ 'pt_why_' + w.k | translate }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <app-partnerships-joint />

    <section class="pg cr-spont">
      <div class="hx-container">
        <div class="pg-cta">
          <div>
            <h2 class="hx-display">{{ 'pt_profile_title' | translate }}</h2>
            <p>{{ 'pt_profile_text' | translate }}</p>
          </div>
          @if (pdf) {
            <a [href]="pdf" download class="hx-btn hx-btn--primary"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i> {{ 'pt_profile_download' | translate }}</a>
          } @else {
            <a routerLink="/contact" [queryParams]="{ type: 'partner' }" class="hx-btn hx-btn--primary"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> {{ 'pt_profile_request' | translate }}</a>
          }
        </div>
      </div>
    </section>
  `
})
export class PartnershipsComponent {
  readonly pdf = COMPANY_PROFILE_PDF;
  readonly who = [
    { k: 'jv', icon: 'fa-handshake', type: 'partner' },
    { k: 'supplier', icon: 'fa-truck-ramp-box', type: 'supplier' },
    { k: 'subc', icon: 'fa-helmet-safety', type: 'subcontractor' },
    { k: 'eng', icon: 'fa-compass-drafting', type: 'partner' },
  ];
  readonly why = [
    { k: 'focus', icon: 'fa-water' },
    { k: 'teams', icon: 'fa-people-group' },
    { k: 'public', icon: 'fa-building-columns' },
    { k: 'quality', icon: 'fa-clipboard-check' },
    { k: 'local', icon: 'fa-map-location-dot' },
    { k: 'pay', icon: 'fa-file-invoice' },
  ];
}
