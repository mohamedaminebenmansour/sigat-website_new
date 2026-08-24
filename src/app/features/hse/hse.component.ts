import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';

@Component({
  selector: 'app-hse',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'hse_title' | translate"
          [subtitle]="'hse_subtitle' | translate"
        />
      </div>
    </section>

    <!-- Health & Safety -->
    <section class="py-16 bg-gray-50">
      <div class="container mx-auto px-4">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center gap-4 mb-8">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-shield-halved text-white text-xl"></i>
            </div>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900">{{ 'hse_health_title' | translate }}</h2>
          </div>

          <div class="space-y-4 text-gray-600 leading-relaxed">
            <p [innerHTML]="'hse_health_para_1' | translate"></p>
            <p [innerHTML]="'hse_health_para_2' | translate"></p>
            <p [innerHTML]="'hse_health_para_3' | translate"></p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div class="text-3xl font-bold text-blue-900 mb-1">2,500+</div>
              <p class="text-sm text-gray-500">{{ 'hse_health_stat_1_label' | translate }}</p>
            </div>
            <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div class="text-3xl font-bold text-blue-900 mb-1">98%</div>
              <p class="text-sm text-gray-500">{{ 'hse_health_stat_2_label' | translate }}</p>
            </div>
            <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div class="text-3xl font-bold text-blue-900 mb-1">0</div>
              <p class="text-sm text-gray-500">{{ 'hse_health_stat_3_label' | translate }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Quality Management -->
    <section class="py-16 bg-white">
      <div class="container mx-auto px-4">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center gap-4 mb-8">
            <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-medal text-white text-xl"></i>
            </div>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900">{{ 'hse_quality_title' | translate }}</h2>
          </div>

          <div class="space-y-4 text-gray-600 leading-relaxed">
            <p [innerHTML]="'hse_quality_para_1' | translate"></p>
            <p [innerHTML]="'hse_quality_para_2' | translate"></p>
            <p [innerHTML]="'hse_quality_para_3' | translate"></p>
          </div>
        </div>
      </div>
    </section>

    <!-- Certifications -->
    <section class="py-16 bg-gray-50">
      <div class="container mx-auto px-4">
          <div class="max-w-4xl mx-auto">
            <div class="flex items-center gap-4 mb-8">
              <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-certificate text-white text-xl"></i>
              </div>
              <h2 class="text-2xl md:text-3xl font-bold text-gray-900">{{ 'hse_certifications_title' | translate }}</h2>
            </div>

            <p class="text-gray-600 leading-relaxed mb-10 max-w-3xl">
              {{ 'hse_certifications_text' | translate }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div class="bg-white rounded-lg shadow-md overflow-hidden text-center">
                <img
                  src="https://images.unsplash.com/photo-1589647363585-f4a7d3877b10?w=400&q=80"
                  alt="ISO 9001 Certification"
                  class="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div class="p-5">
                  <h3 class="text-lg font-bold text-gray-900">{{ 'hse_cert_1_title' | translate }}</h3>
                  <p class="text-sm text-gray-500 mt-1">{{ 'hse_cert_1_subtitle' | translate }}</p>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-md overflow-hidden text-center">
                <img
                  src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80"
                  alt="ISO 14001 Certification"
                  class="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div class="p-5">
                  <h3 class="text-lg font-bold text-gray-900">{{ 'hse_cert_2_title' | translate }}</h3>
                  <p class="text-sm text-gray-500 mt-1">{{ 'hse_cert_2_subtitle' | translate }}</p>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-md overflow-hidden text-center">
                <img
                  src="https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=400&q=80"
                  alt="ISO 45001 Certification"
                  class="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div class="p-5">
                  <h3 class="text-lg font-bold text-gray-900">{{ 'hse_cert_3_title' | translate }}</h3>
                  <p class="text-sm text-gray-500 mt-1">{{ 'hse_cert_3_subtitle' | translate }}</p>
                </div>
              </div>
            </div>
        </div>
      </div>
    </section>
  `
})
export class HseComponent {}
