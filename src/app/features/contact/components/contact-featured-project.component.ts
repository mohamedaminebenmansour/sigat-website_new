import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Project } from '../../../core/models/project.model';

@Component({
  selector: 'app-contact-featured-project',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_featured_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_featured_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_featured_subtitle' | translate }}</p>
        </div>

        @if (featuredProject(); as project) {
          <div class="max-w-5xl mx-auto bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <div class="grid grid-cols-1 md:grid-cols-2">
              <div class="aspect-[16/10] md:aspect-auto md:h-full">
                <img
                  [src]="project.media?.cover ?? project.imageUrl"
                  [alt]="project.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div class="p-8 md:p-10 flex flex-col justify-center">
                <span class="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-900 mb-4">
                  {{ 'project_category_' + project.category | translate }}
                </span>
                <h3 class="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{{ project.title }}</h3>
                <div class="flex items-center gap-4 text-sm text-gray-500 mb-6">
                  <span class="inline-flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {{ project.location }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ project.year }}
                  </span>
                </div>
                <p class="text-gray-600 mb-8 leading-relaxed line-clamp-3">{{ project.description }}</p>
                <a [routerLink]="'/projects/' + project.id" class="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm w-fit">
                  {{ 'contact_featured_cta' | translate }}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rtl:-scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class ContactFeaturedProjectComponent {
  private readonly mockData = inject(MockDataService);
  readonly featuredProject = () => this.mockData.getProjects()[0];
}
