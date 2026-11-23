import { AfterViewInit, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_INFO, COMPANY_MAILTO } from '../../core/company/company-info';
import { PageHeroComponent } from '../../shared/components/page-hero.component';

/**
 * LEGAL — mentions légales + privacy policy (#privacy).
 * Company identity comes from COMPANY_INFO.legal; empty values read "being updated".
 * Personal data: Tunisian organic law n° 2004-63 of 27 July 2004 (INPDP).
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeroComponent],
  template: `
    <app-page-hero photo="assets/media/gallery/20231222-pipeline" crumb="legal_crumb" kicker="legal_kicker" title="legal_title" [short]="true" fillBelow="#ffffff" />

    <section class="pg pg--white">
      <div class="hx-container lg-doc">
        <nav class="lg-toc" aria-label="sommaire">
          <a href="#editor" (click)="go($event, 'editor')">{{ 'legal_editor_t' | translate }}</a>
          <a href="#ip" (click)="go($event, 'ip')">{{ 'legal_ip_t' | translate }}</a>
          <a href="#privacy" (click)="go($event, 'privacy')">{{ 'legal_privacy_t' | translate }}</a>
          <a href="#cookies" (click)="go($event, 'cookies')">{{ 'legal_cookies_t' | translate }}</a>
        </nav>

        <article>
          <h2 id="editor" class="hx-display">{{ 'legal_editor_t' | translate }}</h2>
          <dl class="lg-dl">
            <dt>{{ 'legal_name' | translate }}</dt><dd>{{ info.legalName }} ({{ info.name }})</dd>
            <dt>{{ 'legal_form' | translate }}</dt><dd>{{ info.legal.form || ('legal_pending' | translate) }}</dd>
            <dt>{{ 'legal_seat' | translate }}</dt><dd>{{ info.address }}</dd>
            <dt>{{ 'legal_rne' | translate }}</dt><dd>{{ info.legal.rne || ('legal_pending' | translate) }}</dd>
            <dt>{{ 'legal_tax' | translate }}</dt><dd>{{ info.legal.taxId || ('legal_pending' | translate) }}</dd>
            <dt>{{ 'legal_capital' | translate }}</dt><dd>{{ info.legal.capital || ('legal_pending' | translate) }}</dd>
            <dt>{{ 'legal_director' | translate }}</dt><dd>{{ info.legal.director || ('legal_pending' | translate) }}</dd>
            <dt>{{ 'legal_contact' | translate }}</dt><dd><a [href]="mailto" dir="ltr">{{ info.email }}</a></dd>
            <dt>{{ 'legal_host' | translate }}</dt><dd>{{ info.legal.host || ('legal_pending' | translate) }}</dd>
          </dl>

          <h2 id="ip" class="hx-display">{{ 'legal_ip_t' | translate }}</h2>
          <p>{{ 'legal_ip_1' | translate }}</p>
          <p>{{ 'legal_liability' | translate }}</p>

          <h2 id="privacy" class="hx-display">{{ 'legal_privacy_t' | translate }}</h2>
          <p>{{ 'legal_privacy_intro' | translate }}</p>
          @for (k of privacy; track k) {
            <h3>{{ 'legal_pv_' + k + '_t' | translate }}</h3>
            <p>{{ 'legal_pv_' + k | translate }}</p>
          }
          <p>{{ 'legal_pv_exercise' | translate }} <a [href]="mailto" dir="ltr">{{ info.email }}</a>.</p>

          <h2 id="cookies" class="hx-display">{{ 'legal_cookies_t' | translate }}</h2>
          <p>{{ 'legal_cookies' | translate }}</p>

          <p class="lg-upd">{{ 'legal_updated' | translate }} 23/11/2026 · <a routerLink="/contact">{{ 'nav_contact' | translate }}</a></p>
        </article>
      </div>
    </section>
  `
})
export class LegalComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  readonly info = COMPANY_INFO;
  readonly mailto = COMPANY_MAILTO;
  readonly privacy = ['who', 'data', 'why', 'keep', 'share', 'rights'];

  ngAfterViewInit(): void {
    const f = this.route.snapshot.fragment;
    if (f) setTimeout(() => document.getElementById(f)?.scrollIntoView({ block: 'start' }), 300);
  }

  go(e: Event, id: string): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
