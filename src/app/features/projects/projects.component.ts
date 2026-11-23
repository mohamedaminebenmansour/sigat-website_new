import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';
import type { ProjectMapEntry } from '../../shared/components/project-map/project-map.types';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { ProjectsTapHeroComponent } from './components/projects-tap-hero.component';
import { ManifoldBranch, ProjectsManifoldComponent } from './components/projects-manifold.component';
import { ProjectsNetworkComponent } from './components/projects-network.component';
import { HxWaveEdgeComponent } from '../../shared/hydro/hx-wave-edge.component';
import { ProjectsReferencesComponent } from './components/projects-references.component';

type Filter = 'all' | 'hydraulic' | 'construction';

/**
 * PROJECTS — "where the water arrives".
 * Hero: the valve installation (gate valve, gauge, elbow, outlet) pouring into
 * the pool; the water is distributed by a valve manifold (the filter) to
 * the projects, each seen through a sight glass. The map closes the story.
 * Hand-off colours: pool #0b4c91 → network section (#0a3d73 → #04294f)
 * → glass-pipe joint → map (#fff) → footer.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [TranslatePipe, ProjectMapComponent, HxRevealDirective, ProjectsTapHeroComponent, ProjectsManifoldComponent, ProjectsNetworkComponent, HxWaveEdgeComponent, ProjectsReferencesComponent],
  template: `
    <app-projects-tap-hero [count]="projects.length" [regions]="regions" />

    <section class="pj-net">
      <div class="hx-container">
        <header class="hx-head pj-net__head hx-reveal" hxReveal>
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'pj_net_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pj_net_title' | translate }}</h2>
          <p class="hx-lead">{{ 'pj_net_sub' | translate }}</p>
        </header>

        <app-projects-manifold [branches]="branches()" [active]="active()" (pick)="active.set($any($event))" />

        @if (visible().length) {
          <app-projects-network [projects]="visible()" />
        } @else {
          <p class="pj-empty">{{ 'projects_empty' | translate }}</p>
        }
      </div>
      <!-- soft hand-off: the network's water gives way to the light water of the map -->
      <app-hx-wave-edge color="#eaf5fd" back="#2f8fe0" />
    </section>

    <!-- the references table (what tender evaluators look for), same light water as the map -->
    <app-projects-references [projects]="projects" />

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
