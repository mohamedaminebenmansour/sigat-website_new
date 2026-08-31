import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-office',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_visit_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_visit_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_visit_subtitle' | translate }}</p>
        </div>

        <div class="max-w-5xl mx-auto">
          <div class="bg-gray-50 rounded-xl p-8 md:p-10 border border-gray-100">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div class="flex items-start gap-5">
                <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_visit_office_label' | translate }}</h3>
                  <p class="text-sm text-gray-600 whitespace-pre-line">{{ 'contact_address_value' | translate }}</p>
                  <div class="mt-3 space-y-1.5 text-sm text-gray-600">
                    <a href="tel:+21323456789" class="flex items-center gap-2 hover:text-blue-900 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {{ 'contact_phone_value' | translate }}
                    </a>
                    <a href="mailto:contact@sigat.com" class="flex items-center gap-2 hover:text-blue-900 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {{ 'contact_email_value' | translate }}
                    </a>
                  </div>
                </div>
              </div>

              <div class="md:text-right">
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=2000+Amira+Building+20+Mars,+Le+Bardo,+Tunisia"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-sm md:text-base w-full md:w-auto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
                  </svg>
                  {{ 'contact_visit_directions' | translate }}
                </a>
                <p class="text-xs text-gray-500 mt-2">{{ 'contact_visit_directions_hint' | translate }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ContactOfficeComponent {}
