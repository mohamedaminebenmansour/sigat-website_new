import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ExpertiseCardComponent } from '../../shared/components/expertise-card.component';

@Component({
  selector: 'app-expertise',
  standalone: true,
  imports: [TranslatePipe, SectionHeaderComponent, ExpertiseCardComponent],
  template: `
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'expertise_title' | translate"
          [subtitle]="'expertise_subtitle' | translate"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          @for (item of expertiseList; track item.id) {
            <app-expertise-card
              [title]="item.title"
              [description]="item.description"
              [iconClass]="item.iconClass"
              [routerLink]="'/' + slugMap[item.id]"
            />
          }
        </div>
      </div>
    </section>
  `
})
export class ExpertiseComponent {
  readonly slugMap: Record<number, string> = {
    1: 'expertise/hydraulic',
    2: 'expertise/pipeline',
    3: 'expertise/civil',
    4: 'expertise/general-construction'
  };

  expertiseList;

  constructor(private mockData: MockDataService) {
    this.expertiseList = this.mockData.getExpertise();
  }
}
