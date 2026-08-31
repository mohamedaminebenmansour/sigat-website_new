import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-information',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section id="contact-info" class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_info_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_info_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_info_subtitle' | translate }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          <div class="bg-white rounded-xl p-6 text-center border border-gray-100">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_address' | translate }}</h3>
            <p class="text-sm text-gray-600 whitespace-pre-line">{{ 'contact_address_value' | translate }}</p>
          </div>

          <div class="bg-white rounded-xl p-6 text-center border border-gray-100">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_phone' | translate }}</h3>
            <a href="tel:+21323456789" class="text-sm text-blue-900 hover:text-orange-500 transition-colors font-medium">{{ 'contact_phone_value' | translate }}</a>
          </div>

          <div class="bg-white rounded-xl p-6 text-center border border-gray-100">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_email' | translate }}</h3>
            <a href="mailto:contact@sigat.com" class="text-sm text-blue-900 hover:text-orange-500 transition-colors font-medium">{{ 'contact_email_value' | translate }}</a>
          </div>

          <div class="bg-white rounded-xl p-6 text-center border border-gray-100">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_hours' | translate }}</h3>
            <p class="text-sm text-gray-600 whitespace-pre-line">{{ 'contact_hours_value' | translate }}</p>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ContactInformationComponent {}
