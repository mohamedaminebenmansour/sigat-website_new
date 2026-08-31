import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-process',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_process_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_process_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_process_subtitle' | translate }}</p>
        </div>

        <div class="max-w-5xl mx-auto">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <!-- Desktop connecting line -->
            <div class="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-blue-100"></div>

            @for (step of steps; track step.number) {
              <div class="relative flex flex-col items-center text-center">
                <div class="relative z-10 w-16 h-16 rounded-full bg-blue-900 text-white flex items-center justify-center text-xl font-bold mb-5">
                  {{ step.number }}
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ step.title | translate }}</h3>
                <p class="text-gray-600 text-sm leading-relaxed">{{ step.description | translate }}</p>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `
})
export class ContactProcessComponent {
  readonly steps = [
    { number: 1, title: 'contact_process_step_1_title', description: 'contact_process_step_1_desc' },
    { number: 2, title: 'contact_process_step_2_title', description: 'contact_process_step_2_desc' },
    { number: 3, title: 'contact_process_step_3_title', description: 'contact_process_step_3_desc' },
    { number: 4, title: 'contact_process_step_4_title', description: 'contact_process_step_4_desc' },
  ];
}
