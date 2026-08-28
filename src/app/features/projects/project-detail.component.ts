import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Project } from '../../core/models/project.model';
import { CtaBannerComponent } from '../../shared/components/cta-banner.component';
import { ProjectHeroComponent, ProjectHeroData } from './components/project-hero.component';
import { ProjectStoryComponent } from './components/project-story.component';
import { ProjectMetricsComponent } from './components/project-metrics.component';
import { ProjectLocationComponent } from './components/project-location.component';
import { ProjectNavigationComponent, ProjectNavItem } from './components/project-navigation.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    CtaBannerComponent,
    ProjectHeroComponent,
    ProjectStoryComponent,
    ProjectMetricsComponent,
    ProjectLocationComponent,
    ProjectNavigationComponent,
  ],
  template: `
    @if (project(); as p) {
      <app-project-hero [project]="heroData()" />

      <!-- Story + gallery -->
      <app-project-story [project]="p" />

      <!-- Measurable results -->
      @if (p.metrics?.length) {
        <app-project-metrics [metrics]="p.metrics ?? []" />
      }

      <!-- Location / map -->
      @if (p.locationGeo) {
        <app-project-location [geo]="p.locationGeo" />
      }

      <!-- Previous / next project -->
      <app-project-navigation
        [prev]="prevItem()"
        [next]="nextItem()"
        [index]="adjacent().index + 1"
        [total]="adjacent().total"
      />

      <!-- Existing CTA banner -->
      <app-cta-banner
        [title]="'project_cta_title' | translate"
        [description]="'project_cta_subtitle' | translate"
        [buttonText]="'project_cta_btn' | translate"
        buttonRoute="/contact"
      />
    } @else {
      <div class="flex min-h-[50vh] items-center justify-center py-20 text-center">
        <div>
          <p class="text-lg text-gray-500">{{ 'project_not_found' | translate }}</p>
          <a routerLink="/projects" class="mt-4 inline-block font-medium text-blue-900 hover:underline">
            &larr; {{ 'project_back_all' | translate }}
          </a>
        </div>
      </div>
    }
  `
})
export class ProjectDetailComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly project = signal<Project | undefined>(undefined);
  readonly adjacent = signal<{ prev?: Project; next?: Project; index: number; total: number }>({
    index: 0,
    total: 0
  });

  constructor(
    private route: ActivatedRoute,
    private mockData: MockDataService
  ) {
    // Re-resolve on every param change (supports prev/next navigation on the
    // same :id route) and clean up on destroy.
    const sub = this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.project.set(this.mockData.getProjectById(id));
      this.adjacent.set(this.mockData.getAdjacentProjects(id));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** Hero-ready shape (cover falls back to the legacy image). */
  readonly heroData = (): ProjectHeroData => {
    const p = this.project();
    return {
      title: p?.title ?? '',
      location: p?.location ?? '',
      category: p?.category ?? 'hydraulic',
      startDate: p?.startDate,
      endDate: p?.endDate,
      year: p?.year,
      cover: p?.media?.cover ?? p?.imageUrl ?? ''
    };
  };

  readonly prevItem = (): ProjectNavItem | null => {
    const prev = this.adjacent().prev;
    return prev ? { id: prev.id, title: prev.title } : null;
  };

  readonly nextItem = (): ProjectNavItem | null => {
    const next = this.adjacent().next;
    return next ? { id: next.id, title: next.title } : null;
  };
}