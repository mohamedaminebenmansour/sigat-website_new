import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';

@Component({
  selector: 'app-geographic-presence',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'about_geo_title' | translate"
          [subtitle]="'about_geo_subtitle' | translate"
        />

        <div class="max-w-4xl mx-auto">
          <!-- Headquarters -->
          <div class="bg-blue-900 text-white rounded-lg p-8 mb-8 text-center">
            <div class="text-4xl mb-4">📍</div>
            <p class="text-lg font-bold">{{ 'about_geo_headquarters' | translate }}</p>
            <p class="text-base mt-2">{{ 'about_geo_headquarters_address' | translate }}</p>
          </div>

          <!-- Active Operations -->
          <div class="bg-gray-50 rounded-lg p-8">
            <h3 class="text-xl font-bold text-gray-900 mb-6 text-center">{{ 'about_geo_regions_title' | translate }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              @for (region of regions; track region.key) {
                <div class="flex items-center gap-3 bg-white rounded-lg p-4 shadow-sm">
                  <span class="text-2xl">{{ region.icon }}</span>
                  <span class="text-gray-700 text-sm">{{ region.key | translate }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Map placeholder -->
          <div class="mt-8 bg-gray-200 rounded-lg h-48 flex items-center justify-center text-gray-400 text-sm">
            <span>🌍 {{ 'about_geo_title' | translate }}</span>
          </div>
        </div>
      </div>
    </section>
  `
})
export class GeographicPresenceComponent {
  regions = [
    { icon: '🌍', key: 'about_geo_region_1' },
    { icon: '🌊', key: 'about_geo_region_2' },
    { icon: '🏜️', key: 'about_geo_region_3' }
  ];
}
