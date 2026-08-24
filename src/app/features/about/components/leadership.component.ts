import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';

interface Leader {
  imageUrl: string;
  nameKey: string;
  titleKey: string;
  bioKey: string;
}

@Component({
  selector: 'app-leadership',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'about_leadership_title' | translate"
          [subtitle]="'about_leadership_subtitle' | translate"
        />

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          @for (leader of leaders; track leader.nameKey) {
            <div class="bg-white rounded-lg shadow-md overflow-hidden text-center">
              <img
                [src]="leader.imageUrl"
                [alt]="leader.nameKey | translate"
                class="w-full h-64 object-cover object-top"
                loading="lazy"
              />
              <div class="p-6">
                <h3 class="text-xl font-bold text-gray-900">{{ leader.nameKey | translate }}</h3>
                <p class="text-sm font-semibold text-blue-900 uppercase tracking-wide mt-1">{{ leader.titleKey | translate }}</p>
                <p class="text-gray-600 text-sm mt-4 leading-relaxed">{{ leader.bioKey | translate }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class LeadershipComponent {
  leaders: Leader[] = [
    {
      imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80',
      nameKey: 'about_leader_1_name',
      titleKey: 'about_leader_1_title',
      bioKey: 'about_leader_1_bio'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      nameKey: 'about_leader_2_name',
      titleKey: 'about_leader_2_title',
      bioKey: 'about_leader_2_bio'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
      nameKey: 'about_leader_3_name',
      titleKey: 'about_leader_3_title',
      bioKey: 'about_leader_3_bio'
    }
  ];
}
