import { COMPANY_INFO, COMPANY_MAILTO, COMPANY_TEL } from '../../../core/company/company-info';
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HxWaveEdgeComponent } from '../../../shared/hydro/hx-wave-edge.component';

/** Head office: the source of every site — address, phone, e-mail, directions. */
@Component({
  selector: 'app-contact-office',
  standalone: true,
  imports: [TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section id="contact-office" class="co relative pt-16 md:pt-20 pb-28 md:pb-36">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-10">
          <p class="hx-eyebrow" style="justify-content:center">{{ 'contact_visit_eyebrow' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'contact_visit_title' | translate }}</h2>
          <p class="text-lg text-gray-600 mt-3">{{ 'contact_visit_subtitle' | translate }}</p>
        </div>

        <div class="co__card p-7 md:p-10">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div class="flex items-start gap-5">
              <div class="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-location-dot text-xl text-orange-400" aria-hidden="true"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold mb-1">{{ 'contact_visit_office_label' | translate }}</h3>
                <p class="text-sm text-blue-100 whitespace-pre-line">{{ info.address }}</p>
                <div class="mt-3 space-y-1.5 text-sm">
                  @if (tel) {
                    <a [attr.href]="tel" dir="ltr" class="flex items-center gap-2 text-blue-50 hover:text-orange-300 transition-colors">
                      <i class="fa-solid fa-phone w-4 text-orange-400" aria-hidden="true"></i>{{ info.phone }}
                    </a>
                  }
                  <a [href]="mailto" class="flex items-center gap-2 text-blue-50 hover:text-orange-300 transition-colors">
                    <i class="fa-solid fa-envelope w-4 text-orange-400" aria-hidden="true"></i>{{ info.email }}
                  </a>
                </div>
              </div>
            </div>
            <div class="md:text-right">
              <a [href]="info.mapsUrl" target="_blank" rel="noopener noreferrer" class="hx-btn hx-btn--primary w-full md:w-auto justify-center">
                <i class="fa-solid fa-route" aria-hidden="true"></i> {{ 'contact_visit_directions' | translate }}
              </a>
              <p class="text-xs text-blue-100 mt-2">{{ 'contact_visit_directions_hint' | translate }}</p>
            </div>
          </div>
        </div>
      </div>
      <!-- soft hand-off: the office's white water flows into the map's light blue -->
      <app-hx-wave-edge color="#eaf5fd" back="#d6ebfa" />
    </section>
  `
})
export class ContactOfficeComponent {
  readonly info = COMPANY_INFO;
  readonly tel = COMPANY_TEL;
  readonly mailto = COMPANY_MAILTO;
}
