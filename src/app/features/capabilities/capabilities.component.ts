import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';

@Component({
  selector: 'app-capabilities',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'capabilities_title' | translate"
          [subtitle]="'capabilities_subtitle' | translate"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          @for (item of equipmentList; track item.id) {
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
              <img
                [src]="item.imageUrl"
                [alt]="item.name"
                class="w-full h-52 object-cover"
                loading="lazy"
              />
              <div class="p-5">
                <div class="flex items-start justify-between mb-2">
                  <h3 class="text-lg font-bold text-gray-900">{{ item.name }}</h3>
                  <span class="bg-blue-900 text-white text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ms-2">
                    ×{{ item.quantity }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 uppercase tracking-wide font-medium mb-1">{{ item.type }}</p>
                <p class="text-sm text-gray-600">{{ item.specs }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class CapabilitiesComponent {
  equipmentList;

  constructor(private mockData: MockDataService) {
    this.equipmentList = this.mockData.getEquipment();
  }
}
