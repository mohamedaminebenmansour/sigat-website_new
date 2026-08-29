import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ProjectCardComponent } from '../../shared/components/project-card.component';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';
import type { ProjectMapEntry } from '../../shared/components/project-map/project-map.types';

type Filter = 'all' | 'hydraulic' | 'construction';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, TranslatePipe, SectionHeaderComponent, ProjectCardComponent, ProjectMapComponent],
  template: `
    <section class="py-16 md:py-20 bg-gray-50">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'projects_title' | translate"
          [subtitle]="'projects_subtitle' | translate"
        />

        <!-- Filter Bar -->
        <div class="flex flex-wrap justify-center gap-3 mb-12">
          @for (filter of filters; track filter.key) {
            <button
              (click)="activeFilter.set(filter.key)"
              class="px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
              [class.bg-blue-900]="activeFilter() === filter.key"
              [class.text-white]="activeFilter() === filter.key"
              [class.bg-gray-200]="activeFilter() !== filter.key"
              [class.text-gray-700]="activeFilter() !== filter.key"
              [class.hover:bg-gray-300]="activeFilter() !== filter.key"
            >
              {{ filter.label | translate }}
            </button>
          }
        </div>

        <!-- Projects Grid -->
        @if (filteredProjects.length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            @for (project of filteredProjects; track project.id) {
              <app-project-card
                [title]="project.title"
                [description]="project.description"
                [location]="project.location"
                [year]="project.year"
                [category]="project.category"
                [imageUrl]="project.media?.cover ?? project.imageUrl"
                [routerLink]="'/projects/' + project.id"
              />
            }
          </div>
        } @else {
          <p class="text-center text-gray-500 py-12">{{ 'projects_empty' | translate }}</p>
        }
      </div>
    </section>

    <!-- Project map (Mode B: no current project, every marker navigates) -->
    @if (mapEntries.length > 0) {
      <section class="py-16 md:py-20 bg-white" aria-labelledby="projects-map-title">
        <div class="container mx-auto px-4">
          <p class="text-sm font-semibold uppercase tracking-widest text-orange-500 mb-2 text-center">
            {{ 'project_map_title' | translate }}
          </p>
          <h2
            id="projects-map-title"
            class="text-2xl md:text-3xl font-bold text-blue-900 text-center mb-8 md:mb-10"
          >
            {{ 'project_map_subtitle' | translate }}
          </h2>
          <app-project-map [projects]="mapEntries" />
        </div>
      </section>
    }
  `
})
export class ProjectsComponent {
  readonly activeFilter = signal<Filter>('all');
  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'projects_filter_all' },
    { key: 'hydraulic', label: 'projects_filter_hydraulic' },
    { key: 'construction', label: 'projects_filter_construction' }
  ];

  private allProjects;

  /** Map entries derived from the same data source (no duplicated data). */
  readonly mapEntries: ProjectMapEntry[];

  constructor(private mockData: MockDataService) {
    this.allProjects = this.mockData.getProjects();
    this.mapEntries = this.mockData.getProjectMapEntries();
  }

  get filteredProjects() {
    const currentFilter = this.activeFilter();
    if (currentFilter === 'all') {
      return this.allProjects;
    }
    return this.allProjects.filter(p => p.category === currentFilter);
  }
}
