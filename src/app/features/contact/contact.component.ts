import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { ContactLayingComponent } from './components/contact-laying.component';
import { ProjectInquiryComponent } from './components/project-inquiry.component';
import { ContactOfficeComponent } from './components/contact-office.component';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';

/**
 * CONTACT — "we lay the pipe to your project".
 *   1. the pipe-laying site (sticky, scroll = the real installation sequence)
 *   2. the glass pipe leaves the ground (the page's only pipe joint)
 *   3. the inquiry form = the connection (its pipe fills as the form is completed)
 *   4. head office, 5. map of the sites
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  host: { class: 'contact-page' },
  imports: [TranslatePipe, ContactLayingComponent, ProjectInquiryComponent, ContactOfficeComponent, ProjectMapComponent, WavePipeComponent],
  template: `
    <app-contact-laying />
    <app-wave-pipe class="lay__joint" [height]="110" [amplitude]="28" [phase]="1.3" fillAbove="#8f6f4a" fillBelow="#eef7fd" />
    <app-project-inquiry />
    <app-contact-office />

    @if (mapEntries().length > 0) {
      <section class="cm pt-8 md:pt-10 pb-16 md:pb-20">
        <div class="container mx-auto px-4">
          <div class="text-center max-w-3xl mx-auto mb-10">
            <p class="hx-eyebrow" style="justify-content:center">{{ 'contact_map_eyebrow' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'contact_map_title' | translate }}</h2>
            <p class="text-gray-600 mt-3">{{ 'contact_map_subtitle' | translate }}</p>
          </div>
          <app-project-map [projects]="mapEntries()" />
        </div>
      </section>
    }
  `
})
export class ContactComponent {
  private readonly mockData = inject(MockDataService);
  readonly mapEntries = () => this.mockData.getProjectMapEntries();
}
