import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Project, ProjectMedia } from '../../core/models/project.model';
import { ProjectMediaStackComponent } from '../../shared/components/project-media-stack.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ProjectMediaStackComponent],
  template: `
    @if (project(); as p) {
      <section class="relative h-[60vh] min-h-[24rem] md:h-[78vh] overflow-hidden bg-blue-950">
        <app-project-media-stack
          class="absolute inset-0 z-[1]"
          [media]="stackMedia()"
          [altLabel]="p.title"
        />
        <div class="absolute inset-x-0 top-0 z-[4]">
          <div class="container mx-auto px-4 pt-10 md:pt-16">
            <a
              routerLink="/projects"
              class="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ 'project_back' | translate }}
            </a>
          </div>
        </div>
        <div class="absolute inset-0 z-[3] flex items-end">
          <div class="container mx-auto px-4 pb-8 md:pb-14">
            <h1 class="text-3xl md:text-5xl font-bold text-white">{{ p.title }}</h1>
            <span class="inline-block mt-3 bg-orange-500 text-white text-sm font-semibold uppercase tracking-[0.06em] px-4 py-1.5 rounded-full">
              {{ p.category }}
            </span>
          </div>
        </div>
      </section>

      <section class="py-12 md:py-16 bg-white">
        <div class="container mx-auto px-4">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div class="lg:col-span-2">
              <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ 'project_overview' | translate }}</h2>
              <p class="text-gray-600 leading-relaxed mb-8">{{ p.description }}</p>

              <h3 class="text-xl font-bold text-gray-900 mb-3">{{ 'project_scope' | translate }}</h3>
              <p class="text-gray-600 leading-relaxed mb-8">{{ p.scope }}</p>
            </div>

            <div class="lg:col-span-1">
              <div class="bg-gray-50 rounded-lg p-6 space-y-6 sticky top-24">
                <h3 class="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">{{ 'project_facts' | translate }}</h3>

                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_client' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">{{ p.client }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_location' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">{{ p.location }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_year' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">{{ p.year }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_value' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">$2.2M - $8M</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_duration' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">18 months</p>
                </div>

                <a
                  routerLink="/contact"
                  class="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors mt-6"
                >
                  {{ 'project_cta' | translate }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    } @else {
      <div class="py-20 text-center">
        <p class="text-gray-500 text-lg">{{ 'project_not_found' | translate }}</p>
        <a routerLink="/projects" class="inline-block mt-4 text-blue-900 hover:underline font-medium">
          &larr; {{ 'project_back_all' | translate }}
        </a>
      </div>
    }
  `
})
export class ProjectDetailComponent {
  readonly project = signal<Project | undefined>(undefined);

  /**
   * Single source of truth for the media stack. Uses the project's own
   * `media` manifest when present, otherwise falls back to the legacy
   * imageUrl/galleryUrls so every project still gets a working stack.
   */
  readonly stackMedia = computed<ProjectMedia | undefined>(() => {
    const p = this.project();
    if (!p) {
      return undefined;
    }
    return p.media ?? { cover: p.imageUrl, gallery: p.galleryUrls };
  });

  constructor(
    private route: ActivatedRoute,
    private mockData: MockDataService
  ) {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const found = this.mockData.getProjectById(id);
    this.project.set(found);
  }
}