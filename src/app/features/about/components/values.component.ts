import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';

@Component({
  selector: 'app-values',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'about_values_title' | translate"
          [subtitle]="'about_values_subtitle' | translate"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          @for (value of values; track value.titleKey) {
            <div class="bg-gray-50 rounded-lg p-8 text-center hover:shadow-lg transition-shadow">
              <div class="text-5xl mb-5">{{ value.emoji }}</div>
              <h3 class="text-xl font-bold text-gray-900 mb-3">{{ value.titleKey | translate }}</h3>
              <p class="text-gray-600 text-sm leading-relaxed">{{ value.textKey | translate }}</p>
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class ValuesComponent {
  values = [
    { emoji: '🛡️', titleKey: 'about_value_safety_title', textKey: 'about_value_safety_text' },
    { emoji: '⚙️', titleKey: 'about_value_excellence_title', textKey: 'about_value_excellence_text' },
    { emoji: '🤝', titleKey: 'about_value_partnership_title', textKey: 'about_value_partnership_text' },
    { emoji: '🌱', titleKey: 'about_value_sustainability_title', textKey: 'about_value_sustainability_text' }
  ];
}
