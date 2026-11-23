import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_INFO, COMPANY_MAILTO } from '../../core/company/company-info';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { HydroTicker } from '../../shared/hydro/hydro-ticker.service';

/**
 * LEGAL — mentions légales + privacy policy (#privacy).
 * Company identity comes from COMPANY_INFO.legal; empty values read "being updated".
 * Personal data: Tunisian organic law n° 2004-63 of 27 July 2004 (INPDP).
 * Design: a reading gauge (sight glass filling as you read, a flange per section) beside the document;
 * the company identity is an equipment nameplate; the privacy points are cards.
 * Colours: hero → foam → white → light water #eaf5fd → footer.
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeroComponent],
  template: `
    <app-page-hero photo="assets/media/gallery/20231222-pipeline" crumb="legal_crumb" kicker="legal_kicker" title="legal_title" [short]="true" fillBelow="#eef6fd" />

    <section class="lg">
      <div class="hx-container lg__grid">
        <!-- reading gauge = table of contents -->
        <nav class="lg__gauge" [attr.aria-label]="'legal_toc' | translate">
          <span class="lg__tube" aria-hidden="true"><i [style.height.%]="progress() * 100"></i></span>
          <ol>
            @for (s of sections; track s.id; let i = $index) {
              <li [class.is-on]="reached() > i">
                <a [href]="'#' + s.id" (click)="go($event, s.id)"><span class="lg__flange" aria-hidden="true"></span><span>{{ s.t | translate }}</span></a>
              </li>
            }
          </ol>
        </nav>

        <article #doc class="lg__doc">
          <section id="editor" class="lg__card">
            <p class="lg__num">01</p>
            <h2 class="hx-display">{{ 'legal_editor_t' | translate }}</h2>
            <!-- company identity as an equipment nameplate -->
            <div class="lg-plate">
              <span class="lg-plate__rivet" aria-hidden="true"></span><span class="lg-plate__rivet" aria-hidden="true"></span>
              <span class="lg-plate__rivet" aria-hidden="true"></span><span class="lg-plate__rivet" aria-hidden="true"></span>
              <div class="lg-plate__head"><img src="assets/media/logo/sigatlogo-trim.png" alt="SIGAT" /><span>{{ info.legalName }}</span></div>
              <dl>
                @for (r of plate(); track r.k) {
                  <div><dt>{{ r.k | translate }}</dt><dd [class.is-pending]="!r.v">
                    @if (r.mail) { <a [href]="mailto" dir="ltr">{{ r.v }}</a> } @else { {{ r.v || ('legal_pending' | translate) }} }
                  </dd></div>
                }
              </dl>
            </div>
          </section>

          <section id="ip" class="lg__card">
            <p class="lg__num">02</p>
            <h2 class="hx-display">{{ 'legal_ip_t' | translate }}</h2>
            <p>{{ 'legal_ip_1' | translate }}</p>
            <p>{{ 'legal_liability' | translate }}</p>
          </section>

          <section id="privacy" class="lg__card">
            <p class="lg__num">03</p>
            <h2 class="hx-display">{{ 'legal_privacy_t' | translate }}</h2>
            <p class="lg__lead">{{ 'legal_privacy_intro' | translate }}</p>
            <div class="lg-pv">
              @for (k of privacy; track k.k) {
                <div class="lg-pv__item">
                  <i class="fa-solid {{ k.icon }}" aria-hidden="true"></i>
                  <h3>{{ 'legal_pv_' + k.k + '_t' | translate }}</h3>
                  <p>{{ 'legal_pv_' + k.k | translate }}</p>
                </div>
              }
            </div>
            <p class="lg__exercise">{{ 'legal_pv_exercise' | translate }}
              <a [href]="mailto" class="hx-btn hx-btn--primary lg__mail" dir="ltr"><i class="fa-solid fa-envelope" aria-hidden="true"></i> {{ info.email }}</a>
            </p>
          </section>

          <section id="cookies" class="lg__card">
            <p class="lg__num">04</p>
            <h2 class="hx-display">{{ 'legal_cookies_t' | translate }}</h2>
            <p>{{ 'legal_cookies' | translate }}</p>
          </section>

          <p class="lg__upd">{{ 'legal_updated' | translate }} 23/11/2026 · <a routerLink="/contact">{{ 'nav_contact' | translate }}</a></p>
        </article>
      </div>
    </section>
  `
})
export class LegalComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  @ViewChild('doc', { static: true }) doc!: ElementRef<HTMLElement>;
  readonly info = COMPANY_INFO;
  readonly mailto = COMPANY_MAILTO;
  readonly progress = signal(0);
  readonly reached = signal(0);
  private off?: () => void;

  readonly sections = [
    { id: 'editor', t: 'legal_editor_t' }, { id: 'ip', t: 'legal_ip_t' },
    { id: 'privacy', t: 'legal_privacy_t' }, { id: 'cookies', t: 'legal_cookies_t' },
  ];
  readonly privacy = [
    { k: 'who', icon: 'fa-building' }, { k: 'data', icon: 'fa-database' }, { k: 'why', icon: 'fa-bullseye' },
    { k: 'keep', icon: 'fa-hourglass-half' }, { k: 'share', icon: 'fa-share-nodes' }, { k: 'rights', icon: 'fa-scale-balanced' },
  ];
  /** nameplate rows (empty value = "being updated") */
  plate() {
    const L = this.info.legal;
    return [
      { k: 'legal_name', v: `${this.info.legalName} (${this.info.name})` },
      { k: 'legal_form', v: L.form }, { k: 'legal_seat', v: this.info.address },
      { k: 'legal_rne', v: L.rne }, { k: 'legal_tax', v: L.taxId }, { k: 'legal_capital', v: L.capital },
      { k: 'legal_director', v: L.director }, { k: 'legal_contact', v: this.info.email, mail: true }, { k: 'legal_host', v: L.host },
    ];
  }

  ngAfterViewInit(): void {
    const f = this.route.snapshot.fragment;
    if (f) setTimeout(() => document.getElementById(f)?.scrollIntoView({ block: 'start' }), 300);
    const doc = this.doc.nativeElement;
    this.off = this.ticker.register(doc, () => {
      const r = doc.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.4 - r.top) / Math.max(1, r.height - vh * 0.5)));
      let n = 0;
      for (const s of this.sections) { const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top < vh * 0.45) n++; }
      if (Math.abs(p - this.progress()) > 0.004 || n !== this.reached()) this.zone.run(() => { this.progress.set(p); this.reached.set(n); });
    });
  }

  ngOnDestroy(): void { this.off?.(); }

  go(e: Event, id: string): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: this.ticker.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
}
