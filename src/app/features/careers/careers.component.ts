import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SAMPLE_DATA } from '../../core/company/company-info';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { OPENINGS } from './careers.data';
import { CareersReservoirComponent } from './careers-reservoir.component';

/**
 * CAREERS — join the people who build the water network.
 * Hero → why SIGAT (foam, fading to white) → open positions → how we hire = a reservoir that fills as you read
 * (under a water surface, out through a wave) → spontaneous application on light water → footer.
 * Every "Apply" goes to the contact form with the job route preselected.
 */
@Component({
  selector: 'app-careers',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeroComponent, HxRevealDirective, CareersReservoirComponent],
  template: `
    <app-page-hero photo="assets/media/gallery/20231229-pipeline" crumb="nav_careers" kicker="careers_kicker" title="careers_title" sub="careers_sub" fillBelow="#eef6fd">
      <a routerLink="/careers" fragment="openings" (click)="go($event, 'openings')" class="hx-btn hx-btn--primary">{{ 'careers_cta_openings' | translate }}</a>
      <a routerLink="/contact" [queryParams]="{ type: 'job', role: 'j_spontaneous' }" class="hx-btn hx-btn--ghost">{{ 'careers_cta_spontaneous' | translate }}</a>
    </app-page-hero>

    <section class="pg cr-why">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'careers_why_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'careers_why_title' | translate }}</h2>
        </header>
        <div class="pg-grid">
          @for (w of why; track w.k) {
            <div class="pg-card hx-reveal" hxReveal>
              <i class="fa-solid {{ w.icon }}" aria-hidden="true"></i>
              <h3>{{ 'careers_why_' + w.k + '_t' | translate }}</h3>
              <p>{{ 'careers_why_' + w.k | translate }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section id="openings" class="pg pg--white">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'careers_open_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'careers_open_title' | translate }}</h2>
        </header>
        @if (sample) { <p class="pg-sample"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>{{ 'sample_note' | translate }}</p> }
        <ul class="cr-list">
          @for (o of openings; track o.id) {
            <li class="cr-job hx-reveal" hxReveal>
              <i class="fa-solid {{ o.icon }}" aria-hidden="true"></i>
              <div class="cr-job__txt">
                <h3>{{ 'careers_job_' + o.id + '_title' | translate }}</h3>
                <p>{{ 'careers_job_' + o.id + '_desc' | translate }}</p>
                <div class="cr-job__meta">
                  <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>{{ o.place | translate }}</span>
                  <span><i class="fa-regular fa-file-lines" aria-hidden="true"></i>{{ 'careers_contract_' + o.contract | translate }}</span>
                </div>
              </div>
              <a class="hx-btn hx-btn--primary cr-job__btn" routerLink="/contact" [queryParams]="{ type: 'job', role: o.role }">{{ 'careers_apply' | translate }}</a>
            </li>
          } @empty {
            <li class="cr-none">{{ 'careers_none' | translate }}</li>
          }
        </ul>
      </div>
    </section>

    <app-careers-reservoir />

    <section class="pg cr-spont">
      <div class="hx-container">
        <div class="pg-cta">
          <div>
            <h2 class="hx-display">{{ 'careers_spont_title' | translate }}</h2>
            <p>{{ 'careers_spont_text' | translate }}</p>
          </div>
          <a routerLink="/contact" [queryParams]="{ type: 'job', role: 'j_spontaneous' }" class="hx-btn hx-btn--primary">{{ 'careers_cta_spontaneous' | translate }}</a>
        </div>
      </div>
    </section>
  `
})
export class CareersComponent {
  readonly openings = OPENINGS;
  readonly sample = SAMPLE_DATA;
  readonly why = [
    { k: 'field', icon: 'fa-water' },
    { k: 'learn', icon: 'fa-graduation-cap' },
    { k: 'safety', icon: 'fa-shield-halved' },
    { k: 'grow', icon: 'fa-arrow-trend-up' },
  ];

  go(e: Event, id: string): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
