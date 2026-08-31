import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import type { ProjectMapEntry } from '../../shared/components/project-map/project-map.types';
import { ContactHeroComponent } from './components/contact-hero.component';
import { ProjectInquiryComponent } from './components/project-inquiry.component';
import { ContactInformationComponent } from './components/contact-information.component';
import { ContactOfficeComponent } from './components/contact-office.component';
import { ContactProcessComponent } from './components/contact-process.component';
import { ContactTrustComponent } from './components/contact-trust.component';
import { ContactFeaturedProjectComponent } from './components/contact-featured-project.component';
import { CtaBannerComponent } from '../../shared/components/cta-banner.component';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    ContactHeroComponent,
    ProjectInquiryComponent,
    ContactInformationComponent,
    ContactOfficeComponent,
    ContactProcessComponent,
    ContactTrustComponent,
    ContactFeaturedProjectComponent,
    CtaBannerComponent,
    ProjectMapComponent,
  ],
  template: `
    <app-contact-hero />

    <app-project-inquiry />

    <app-contact-information />

    <app-contact-office />

    <app-contact-process />

    <!-- Map section -->
    @if (mapEntries().length > 0) {
      <section class="py-16 md:py-20 bg-gray-50">
        <div class="container mx-auto px-4">
          <div class="text-center max-w-3xl mx-auto mb-10">
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_map_eyebrow' | translate }}</p>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{{ 'contact_map_title' | translate }}</h2>
            <p class="text-gray-600">{{ 'contact_map_subtitle' | translate }}</p>
          </div>
          <div class="max-w-5xl mx-auto">
            <app-project-map [projects]="mapEntries()" />
          </div>
        </div>
      </section>
    }

    <app-contact-trust />

    <app-contact-featured-project />

    <app-cta-banner
      [title]="'contact_cta_title' | translate"
      [description]="'contact_cta_subtitle' | translate"
      [buttonText]="'contact_cta_btn' | translate"
      buttonRoute="#project-inquiry"
    />
  `
})
export class ContactComponent {
  private readonly mockData = inject(MockDataService);
  readonly mapEntries = () => this.mockData.getProjectMapEntries();
}
