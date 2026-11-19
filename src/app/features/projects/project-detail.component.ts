import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Project } from '../../core/models/project.model';
import { ProjectStoryComponent } from './components/project-story.component';
import { ProjectMapComponent } from '../../shared/components/project-map/project-map.component';
import type { ProjectMapEntry } from '../../shared/components/project-map/project-map.types';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';
import { HxCountDirective } from '../../shared/hydro/hx-count.directive';
import { ProjectPipeHeroComponent } from './components/project-pipe-hero.component';
import { ProjectDropGalleryComponent } from './components/project-drop-gallery.component';

interface Tile { area: string; i: number; }
interface Fact { key: string; value?: string; valueKey?: string; c: string; s: string; }

/**
 * PROJECT DETAIL — reading ONE project (no project-to-project navigation).
 *  1. Hero: the project seen inside the pipe (+ the page's only pipe joint).
 *  2. Reading: story accordion (owner's component) | the project's general
 *     picture in a large ring, key facts marked along its edge.
 *  3. Gallery: "the drop reveals".
 *  4. Dossier: photo mosaic + key figures | the map (tall panel).
 *     Clicking a mosaic photo opens it in the gallery.
 *  5. Call to action.
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, TranslatePipe, ProjectStoryComponent, ProjectMapComponent, WavePipeComponent, HxCountDirective,
    ProjectPipeHeroComponent, ProjectDropGalleryComponent
  ],
  template: `
    @if (project(); as p) {
      <app-project-pipe-hero [p]="p" />
      <app-wave-pipe class="hx-joint" [height]="90" [amplitude]="22" [phase]="0.8" fillAbove="#eaf7fe" fillBelow="#ffffff" />

      <!-- 2 · reading -->
      <div class="pd-story">
        <app-project-story [project]="p" [showGallery]="false">
          <aside storyAside class="pc" [attr.aria-label]="'project_facts' | translate">
            <figure class="pc__disc"><img [src]="cover()" [alt]="p.title" decoding="async" /></figure>
            <dl class="pc__facts">
              @for (f of facts(); track f.key) {
                <div class="pc__fact" [style.--c]="f.c" [style.--s]="f.s">
                  <span class="pc__mark" aria-hidden="true"></span>
                  <dt>{{ f.key | translate }}</dt>
                  <dd>{{ f.valueKey ? (f.valueKey | translate) : f.value }}</dd>
                </div>
              }
            </dl>
          </aside>
        </app-project-story>
      </div>

      <!-- 3 · gallery -->
      @if (gallery().length) {
        <app-project-drop-gallery [sources]="gallery()" [title]="p.title" />
      }

      <!-- 4 · dossier: mosaic + figures | map -->
      <section class="ds">
        <div class="hx-container">
          <header class="hx-head">
            <p class="hx-eyebrow">{{ 'pd_dossier_kicker' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'pd_dossier_title' | translate }}</h2>
          </header>
          <div class="ds__grid" [class.ds__grid--nomap]="!mapEntries.length">
            <div class="ds__mosaic">
              @for (t of tiles(); track t.area) {
                @if (t.area === 'm') {
                  <ul class="ds__metrics">
                    @for (m of p.metrics ?? []; track $index) {
                      <li>
                        <span class="ds__metric-label">{{ m.labelKey | translate }}</span>
                        <span class="ds__metric-value">
                          @if (isNumber(m.value)) { <b [hxCount]="toNumber(m.value)"></b> } @else { <b>{{ m.value }}</b> }
                          @if (m.unit) { <small>{{ m.unit }}</small> }
                        </span>
                      </li>
                    }
                  </ul>
                } @else {
                  <button type="button" class="ds__ph" [class]="'ds__ph ds__ph--' + t.area" (click)="openPhoto(t.i)"
                          [attr.aria-label]="('pd_open_photo' | translate) + ' ' + (t.i + 1)">
                    <img [src]="thumb(gallery()[t.i])" alt="" loading="lazy" decoding="async" />
                    <span class="ds__ph-cue" aria-hidden="true"><i class="fa-solid fa-droplet"></i> {{ 'pd_open_photo' | translate }}</span>
                  </button>
                }
              }
            </div>
            @if (mapEntries.length) {
              <div class="ds__map">
                <app-project-map [projects]="mapEntries" [currentProjectId]="p.id" />
              </div>
            }
          </div>
        </div>
      </section>

      <!-- 5 · call to action -->
      <section class="pd-cta">
        <picture>
          <source media="(max-width: 767px)" srcset="assets/media/projects/cta-dam-768.webp" />
          <img src="assets/media/projects/cta-dam.webp" alt="" loading="lazy" decoding="async" />
        </picture>
        <div class="hx-container pd-cta__copy">
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'pd_cta_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pd_cta_title' | translate }}</h2>
          <div class="hx-hero__ctas">
            <a routerLink="/contact" class="hx-btn hx-btn--primary">{{ 'project_cta_btn' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
            <a routerLink="/projects" class="hx-btn hx-btn--ghost">{{ 'project_back_all' | translate }}</a>
          </div>
        </div>
      </section>
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
  private readonly data = inject(MockDataService);
  private readonly route = inject(ActivatedRoute);
  @ViewChild(ProjectDropGalleryComponent) private galleryCmp?: ProjectDropGalleryComponent;

  readonly project = signal<Project | undefined>(undefined);
  readonly mapEntries: ProjectMapEntry[] = this.data.getProjectMapEntries();

  /** Cover first, then the field gallery (legacy URLs as fallback), no duplicates.
   *  A computed signal: the array identity only changes when the project does. */
  readonly gallery = computed(() => {
    const p = this.project();
    if (!p) return [];
    const list = p.media ? [p.media.cover, ...p.media.gallery] : [p.imageUrl, ...(p.galleryUrls ?? [])];
    return [...new Set(list.filter(Boolean))];
  });

  /** The project's general picture (inside the ring beside the story). */
  readonly cover = computed(() => {
    const p = this.project();
    return p ? this.thumb(p.media?.cover ?? p.imageUrl) : '';
  });

  /** Key facts, marked along the left edge of the ring (145° … 215°). */
  readonly facts = computed<Fact[]>(() => {
    const p = this.project();
    if (!p) return [];
    const period = p.startDate && p.endDate && p.startDate !== p.endDate ? `${p.startDate} – ${p.endDate}` : p.year;
    const rows: Omit<Fact, 'c' | 's'>[] = [
      { key: 'project_location', value: p.location },
      { key: 'project_duration', value: period },
      ...(p.client ? [{ key: 'project_client', value: p.client }] : []),
      { key: 'pd_fact_category', valueKey: 'project_category_' + p.category },
      ...(p.scope ? [{ key: 'project_scope', value: p.scope }] : []),
    ];
    const n = rows.length;
    return rows.map((r, i) => {
      const a = ((215 - (70 * i) / Math.max(1, n - 1)) * Math.PI) / 180; // first fact at the top
      return { ...r, c: Math.cos(a).toFixed(4), s: Math.sin(a).toFixed(4) };
    });
  });

  /** Mosaic slots, laid out like the field dossier: big photo, figures, photos. */
  readonly tiles = computed<Tile[]>(() => {
    const p = this.project();
    const n = this.gallery().length;
    if (!p || !n) return [];
    let k = n > 5 ? 1 : 0;              // skip the cover when there are enough photos
    const tiles: Tile[] = [];
    const push = (area: string) => { if (k < n) tiles.push({ area, i: k++ }); };
    push('a');
    if (p.metrics?.length) tiles.push({ area: 'm', i: -1 }); else push('m');
    push('b'); push('c'); push('d'); push('e');
    return tiles;
  });

  constructor() {
    const sub = this.route.paramMap.subscribe(params => {
      this.project.set(this.data.getProjectById(Number(params.get('id'))));
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Local SIGAT photos have a 1280 px variant — lighter for tiles and the ring. */
  thumb(src: string): string {
    return /^assets\/.*\.webp$/i.test(src) && !/-\d+\.webp$/i.test(src) ? src.replace(/\.webp$/i, '-1280.webp') : src;
  }

  isNumber(v: string): boolean { return /^[\d\s]+$/.test(v.trim()); }
  toNumber(v: string): number { return Number(v.replace(/\s/g, '')); }

  /** Open a photo in the gallery (drop + ripple) and bring it into view. */
  openPhoto(i: number): void {
    const g = this.galleryCmp;
    if (!g) return;
    g.playing.set(false);
    g.go(i);
    g.frame.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
