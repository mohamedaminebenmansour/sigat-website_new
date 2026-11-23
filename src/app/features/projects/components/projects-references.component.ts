import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { Project } from '../../../core/models/project.model';
import { SAMPLE_DATA } from '../../../core/company/company-info';
import { HxRevealDirective } from '../../../shared/hydro/hx-reveal.directive';

/**
 * REFERENCES — the table a tender evaluator looks for: project, owner, place,
 * period, contract value band, status. Newest first. Table on laptop+, cards on phones.
 */
@Component({
  selector: 'app-projects-references',
  standalone: true,
  imports: [RouterLink, TranslatePipe, HxRevealDirective],
  template: `
    <section class="rf" aria-labelledby="rf-title">
      <div class="hx-container">
        <header class="hx-head hx-head--split hx-reveal" hxReveal>
          <div>
            <p class="hx-eyebrow">{{ 'rf_kicker' | translate }}</p>
            <h2 id="rf-title" class="hx-h2 hx-display">{{ 'rf_title' | translate }}</h2>
          </div>
          <a routerLink="/contact" [queryParams]="{ type: 'client' }" class="rf__ask">{{ 'rf_ask' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        </header>
        @if (sample) { <p class="pg-sample"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>{{ 'sample_note' | translate }}</p> }
        <div class="rf__wrap hx-reveal" hxReveal>
          <table class="rf__table">
            <thead>
              <tr>
                <th scope="col">{{ 'rf_col_project' | translate }}</th>
                <th scope="col">{{ 'rf_col_client' | translate }}</th>
                <th scope="col">{{ 'rf_col_place' | translate }}</th>
                <th scope="col">{{ 'rf_col_period' | translate }}</th>
                <th scope="col">{{ 'rf_col_amount' | translate }}</th>
                <th scope="col">{{ 'rf_col_status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr>
                  <td data-k="project"><a [routerLink]="['/projects', p.id]">{{ p.title }}</a>
                    @if (p.work) { <small>{{ 'pj_work_' + p.work | translate }}</small> }</td>
                  <td [attr.data-label]="'rf_col_client' | translate">{{ p.client }}</td>
                  <td [attr.data-label]="'rf_col_place' | translate">{{ p.location.split(',')[0] }}</td>
                  <td [attr.data-label]="'rf_col_period' | translate" dir="ltr">{{ p.startDate && p.endDate && p.startDate !== p.endDate ? p.startDate + '–' + p.endDate : (p.endDate || p.year) }}</td>
                  <td [attr.data-label]="'rf_col_amount' | translate">{{ p.amount ? ('rf_amount_' + p.amount | translate) : '—' }}</td>
                  <td [attr.data-label]="'rf_col_status' | translate">
                    @if (p.status === 'ongoing') { <span class="pg-badge pg-badge--progress">{{ 'rf_status_ongoing' | translate }}</span> }
                    @else { <span class="pg-badge pg-badge--done">{{ 'rf_status_done' | translate }}</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="rf__note">{{ 'rf_note' | translate }}</p>
      </div>
    </section>
  `
})
export class ProjectsReferencesComponent {
  readonly projects = input.required<Project[]>();
  readonly sample = SAMPLE_DATA;
  readonly rows = computed(() =>
    [...this.projects()].sort((a, b) => (b.endDate || b.year).localeCompare(a.endDate || a.year)));
}
