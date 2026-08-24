import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';

interface Benefit {
  title: string;
  description: string;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

@Component({
  selector: 'app-partnerships',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <!-- Hero -->
    <section class="relative h-80 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80');">
      <div class="absolute inset-0 bg-blue-900/70"></div>
      <div class="absolute inset-0 flex items-center">
        <div class="container mx-auto px-4 text-center">
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">{{ 'partnerships_hero_title' | translate }}</h1>
          <p class="text-xl text-gray-200 max-w-2xl mx-auto">
            {{ 'partnerships_hero_subtitle' | translate }}
          </p>
        </div>
      </div>
    </section>

    <!-- Why Partner With SIGAT -->
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'partnerships_benefits_title' | translate"
          [subtitle]="'partnerships_benefits_subtitle' | translate"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          @for (benefit of benefits; track benefit.title) {
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center mt-1">
                <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900 mb-1">{{ benefit.title }}</h3>
                <p class="text-gray-600 text-sm leading-relaxed">{{ benefit.description }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- Partnership Process -->
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'partnerships_process_title' | translate"
          [subtitle]="'partnerships_process_subtitle' | translate"
        />

        <div class="max-w-5xl mx-auto">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <!-- Desktop connecting line -->
            <div class="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-blue-200"></div>

            @for (step of steps; track step.number) {
              <div class="relative flex flex-col items-center text-center">
                <div class="relative z-10 w-16 h-16 rounded-full bg-blue-900 text-white flex items-center justify-center text-xl font-bold mb-5">
                  {{ step.number }}
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ step.title }}</h3>
                <p class="text-gray-600 text-sm">{{ step.description }}</p>
              </div>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- Download CTA -->
    <section class="py-16 bg-blue-900">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">{{ 'partnerships_cta_title' | translate }}</h2>
        <p class="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
          {{ 'partnerships_cta_subtitle' | translate }}
        </p>
        <button
          (click)="downloadProfile()"
          class="inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ 'partnerships_cta_btn' | translate }}
        </button>
      </div>
    </section>
  `
})
export class PartnershipsComponent {
  benefits: Benefit[] = [
    {
      title: 'Hydraulic & Civil Expertise',
      description: 'Deep technical knowledge in dams, pipelines, water treatment, and infrastructure projects backed by decades of hands-on experience.'
    },
    {
      title: 'Modern Equipment Fleet',
      description: 'Company-owned fleet of excavators, bulldozers, cranes, pipe layers, and concrete plants ensuring project readiness and quality control.'
    },
    {
      title: 'Proven Safety Record',
      description: 'ISO 45001 certified with zero lost-time incidents this year. Our Behavior-Based Safety program ensures every team member goes home safe.'
    },
    {
      title: 'Full ISO Certification',
      description: 'ISO 9001, ISO 14001, and ISO 45001 certified. Our integrated management system guarantees quality, environmental, and safety excellence.'
    },
    {
      title: '15+ Years of Experience',
      description: 'Since 2009, we have successfully delivered over 120 projects across Algeria and North Africa for government and private clients.'
    },
    {
      title: 'Dedicated Project Teams',
      description: 'Each partnership is assigned a dedicated account manager and project team to ensure seamless communication and execution.'
    }
  ];

  steps: Step[] = [
    {
      number: 1,
      title: 'Contact',
      description: 'Reach out through our form or call us directly. We will respond within 24 hours.'
    },
    {
      number: 2,
      title: 'Qualification',
      description: 'We assess your project requirements, timeline, and scope to ensure alignment with our capabilities.'
    },
    {
      number: 3,
      title: 'First Project',
      description: 'We execute your first project with full transparency, regular reporting, and our proven quality processes.'
    },
    {
      number: 4,
      title: 'Long Term',
      description: 'Successful delivery leads to preferred partnership status, priority scheduling, and tailored commercial terms.'
    }
  ];

  downloadProfile(): void {
    alert('PDF Download triggered');
  }
}
