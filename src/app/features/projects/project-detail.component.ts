import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (project(); as p) {
      <!-- Hero Image -->
      <section class="relative h-64 md:h-96 bg-cover bg-center" [style.background-image]="'url(' + p.imageUrl + ')'">
        <div class="absolute inset-0 bg-blue-900/60"></div>
        <div class="absolute inset-0 flex items-center">
          <div class="container mx-auto px-4">
            <!-- Back link -->
            <a
              routerLink="/projects"
              class="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ 'project_back' | translate }}
            </a>
            <h1 class="text-3xl md:text-5xl font-bold text-white">{{ p.title }}</h1>
            <span class="inline-block mt-3 bg-orange-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
              {{ p.category }}
            </span>
          </div>
        </div>
      </section>

      <!-- Content -->
      <section class="py-12 md:py-16 bg-white">
        <div class="container mx-auto px-4">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <!-- Main Content -->
            <div class="lg:col-span-2">
              <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ 'project_overview' | translate }}</h2>
              <p class="text-gray-600 leading-relaxed mb-8">{{ p.description }}</p>

              <h3 class="text-xl font-bold text-gray-900 mb-3">{{ 'project_scope' | translate }}</h3>
              <p class="text-gray-600 leading-relaxed mb-8">{{ p.scope }}</p>

              <!-- Image Gallery -->
              @if (galleryImages().length > 0) {
                <h3 class="text-xl font-bold text-gray-900 mb-4">{{ 'project_gallery' | translate }}</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  @for (img of galleryImages(); track img) {
                    <img
                      [src]="img"
                      [alt]="p.title"
                      class="w-full h-48 object-cover rounded-lg shadow-md"
                      loading="lazy"
                    />
                  }
                </div>
              }
            </div>

            <!-- Sidebar Facts -->
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
                  <p class="text-gray-900 font-medium mt-1">$5M – $10M</p>
                </div>

                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ 'project_duration' | translate }}</p>
                  <p class="text-gray-900 font-medium mt-1">18 months</p>
                </div>

                <!-- CTA -->
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
      <!-- Loading / Not found -->
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
  readonly galleryImages = signal<string[]>([]);

  private extraGalleryImages = [
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&q=80',
    'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=800&q=80',
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'
  ];

  constructor(
    private route: ActivatedRoute,
    private mockData: MockDataService
  ) {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const found = this.mockData.getProjectById(id);
    this.project.set(found);

    if (found) {
      // Combine project gallery URLs with extra images for a richer gallery
      const allImages = [...found.galleryUrls, ...this.extraGalleryImages];
      // Deduplicate
      this.galleryImages.set([...new Set(allImages)]);
    }
  }
}
