import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-trust',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_trust_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_trust_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_trust_subtitle' | translate }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          @for (item of trustItems; track item.title) {
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center mt-0.5">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900 mb-1">{{ item.title | translate }}</h3>
                <p class="text-sm text-gray-600 leading-relaxed">{{ item.description | translate }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class ContactTrustComponent {
  readonly trustItems = [
    { title: 'contact_trust_item_1_title', description: 'contact_trust_item_1_desc' },
    { title: 'contact_trust_item_2_title', description: 'contact_trust_item_2_desc' },
    { title: 'contact_trust_item_3_title', description: 'contact_trust_item_3_desc' },
    { title: 'contact_trust_item_4_title', description: 'contact_trust_item_4_desc' },
  ];
}
