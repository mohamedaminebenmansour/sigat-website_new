import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';
import type { ProjectMapEntry } from '../../shared/components/project-map/project-map.types';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { ProjectsHeroComponent } from './components/projects-hero.component';
import { ManifoldBranch, ProjectsManifoldComponent } from './components/projects-manifold.component';
import { SightGlassCardComponent } from './components/sight-glass-card.component';

type Filter = 'all' | 'hydraulic' | 'construction';

/**
 * PROJECTS — "where the water arrives".
 * The pipe that runs through the site ends here (outfall hero), fills the
 * pool, and the water is distributed by a valve manifold (the filter) to
 * the projects, each seen through a sight glass. The map closes the story.
 * Hand-off colours: pool #0a3d73 → network section (#0a3d73 → #04294f)
 * → glass-pipe joint → map (#fff) → footer.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [TranslatePipe, ProjectMapComponent, HxRevealDirective, ProjectsHeroComponent, ProjectsManifoldComponent, SightGlassCardComponent],
  template: `
    <app-projects-hero [count]="projects.length" [regions]="regions" />

    <section class="pj-net">
      <div class="hx-container">
        <header class="hx-head pj-net__head hx-reveal" hxReveal>
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'pj_net_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pj_net_title' | translate }}</h2>
          <p class="hx-lead">{{ 'pj_net_sub' | translate }}</p>
        </header>

        <app-projects-manifold [branches]="branches()" [active]="active()" (pick)="active.set($any($event))" />

        @if (visible().length) {
          <div class="pj-grid">
            @for (p of visible(); track p.id; let i = $index) {
              <app-sight-glass-card [style.--i]="i"
                [title]="p.title" [location]="p.location" [year]="p.year"
                [categoryKey]="'projects_filter_' + p.category"
                [image]="p.media?.cover ?? p.imageUrl" [link]="'/projects/' + p.id" />
            }
          </div>
        } @else {
          <p class="pj-empty">{{ 'projects_empty' | translate }}</p>
        }
      </div>
    </section>

    @if (mapEntries.length) {
      <section class="pj-map" aria-labelledby="projects-map-title">
        <div class="hx-container">
          <header class="hx-head hx-reveal" hxReveal>
            <p class="hx-eyebrow">{{ 'project_map_title' | translate }}</p>
            <h2 id="projects-map-title" class="hx-h2 hx-display">{{ 'project_map_subtitle' | translate }}</h2>
          </header>
          <app-project-map [projects]="mapEntries" />
        </div>
      </section>
    }
  `
})
export class ProjectsComponent {
  private readonly data = inject(MockDataService);
  /** Real worksites only (the head office is on the map, not in the list). */
  readonly projects = this.data.getProjects().filter(p => !p.isOffice);
  readonly mapEntries: ProjectMapEntry[] = this.data.getProjectMapEntries();
  readonly regions = new Set(this.projects.map(p => p.location.split(',')[0].trim())).size;

  readonly active = signal<Filter>('all');
  readonly branches = computed<ManifoldBranch[]>(() => [
    { key: 'all', labelKey: 'projects_filter_all', count: this.projects.length },
    { key: 'hydraulic', labelKey: 'projects_filter_hydraulic', count: this.projects.filter(p => p.category === 'hydraulic').length },
    { key: 'construction', labelKey: 'projects_filter_construction', count: this.projects.filter(p => p.category === 'construction').length }
  ]);
  readonly visible = computed(() => {
    const f = this.active();
    return f === 'all' ? this.projects : this.projects.filter(p => p.category === f);
  });
}
