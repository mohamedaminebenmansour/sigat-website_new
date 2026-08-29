import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
  afterNextRender,
  type ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';
import { MAP_CONFIG, type MapConfig } from '../../../core/config/map-config';
import type { ProjectMapEntry } from './project-map.types';
import { toDivIcon } from './project-map.types';

@Component({
  selector: 'app-project-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="pm-wrap">
      <div #stage class="pm-stage"></div>

      @if (tileError()) {
        <div class="pm-error" role="alert">{{ 'map_tile_error' | translate }}</div>
      }

      <div class="pm-legend" aria-hidden="true">
        <div class="pm-legend-row">
          <span class="pm-legend-dot pm-legend-dot--normal"></span>
          <span>{{ 'map_legend_projects' | translate }}</span>
        </div>
        <div class="pm-legend-row">
          <span class="pm-legend-dot pm-legend-dot--current"></span>
          <span>{{ 'map_legend_current' | translate }}</span>
        </div>
      </div>

      <button type="button" class="pm-fit" (click)="fitAll()">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
        {{ 'map_all_projects' | translate }}
      </button>
    </div>
  `,
})
export class ProjectMapComponent {
  readonly projects = input<ProjectMapEntry[]>([]);
  readonly currentProjectId = input<number | undefined>(undefined);

  private readonly stage = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly cfg: MapConfig = inject(MAP_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tileError = signal(false);

  private map: L.Map | null = null;
  private markers = new Map<number, L.Marker>();
  private initialized = false;
  private observer: IntersectionObserver | null = null;

  constructor() {
    // React to the current project changing (prev/next navigation reuses this
    // component) by swapping the highlighted marker + re-focusing. Guarded so
    // it only runs once the map exists.
    effect(() => {
      const id = this.currentProjectId();
      if (this.initialized) this.applyCurrent(id);
    });

    afterNextRender(() => this.initWhenVisible());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  private entryFor(projectId: number): ProjectMapEntry | undefined {
    return this.projects().find((p) => p.id === projectId);
  }

  private initWhenVisible(): void {
    const stageEl = this.stage()?.nativeElement;
    if (!stageEl) return;

    if (typeof IntersectionObserver === 'undefined') {
      this.initMap(stageEl);
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          this.observer?.disconnect();
          this.observer = null;
          this.initMap(stageEl);
        }
      },
      { rootMargin: '200px 0px' },
    );
    this.observer.observe(stageEl);
  }

  private initMap(stageEl: HTMLDivElement): void {
    if (this.map) return;
    const entries = this.projects().filter((p) => this.isValid(p));
    if (!entries.length) return;

    const cfg = this.cfg;
    this.map = L.map(stageEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
      center: [cfg.defaultCenter.lat, cfg.defaultCenter.lng],
      zoom: cfg.defaultZoom,
      attributionControl: true,
    });

    L.tileLayer(cfg.tileUrl, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      minZoom: cfg.minZoom,
      crossOrigin: true,
    })
      .on('tileerror', () => this.tileError.set(true))
      .addTo(this.map);

    this.createMarkers(entries);
    this.initialized = true;
    this.applyCurrent(this.currentProjectId());
  }

  private createMarkers(entries: ProjectMapEntry[]): void {
    if (!this.map) return;
    this.markers.clear();

    const currentId = this.currentProjectId();

    for (const entry of entries) {
      const isCurrent = entry.id === currentId;
      const icon = toDivIcon(isCurrent ? this.cfg.currentMarkerIcon : this.cfg.normalMarkerIcon);

      const marker = L.marker([entry.latitude, entry.longitude], { icon }).addTo(this.map!);
      marker.setZIndexOffset(isCurrent ? this.cfg.currentMarkerZIndex : 0);

      const markerEl = marker.getElement();
      if (markerEl) {
        markerEl.setAttribute('role', 'button');
        markerEl.setAttribute(
          'aria-label',
          `${entry.title} — ${entry.location}${isCurrent ? ` (${this.translateService.instant('map_legend_current')})` : ''}`,
        );
      }

      // Every marker gets the same preview card (project-specific state differs
      // only by visual class, never by availability).
      marker.bindPopup(() => this.buildPopup(entry, isCurrent), {
        maxWidth: 280,
        autoPan: true,
        autoPanPadding: [12, 12],
        closeButton: false,
      });

      // Click: other projects navigate; the current project shows its preview.
      marker.on('click', (ev) => {
        ev.originalEvent.stopPropagation();
        if (entry.id !== this.currentProjectId()) {
          this.navigateTo(entry);
        } else {
          marker.openPopup();
        }
      });

      // Hover: open the same preview for every project (touch taps also fire
      // this on mobile); kept open when the pointer moves onto the popup.
      marker.on('mouseover', () => {
        marker.getElement()?.classList.add('pm-marker--hover');
        marker.openPopup();
      });
      marker.on('mouseout', (e) => this.handleMarkerMouseOut(marker, e));

      this.markers.set(entry.id, marker);
    }

    if (currentId === undefined) {
      this.fitAll();
    }
  }

  /** Close the hover preview when leaving the marker (unless entering the popup). */
  private handleMarkerMouseOut(marker: L.Marker, e: L.LeafletMouseEvent): void {
    marker.getElement()?.classList.remove('pm-marker--hover');
    const to = e.originalEvent.relatedTarget as Node | null;
    if (to && this.map?.getPane('popupPane')?.contains(to)) {
      return;
    }
    marker.closePopup();
  }

  private navigateTo(entry: ProjectMapEntry): void {
    this.map?.closePopup();
    this.router.navigate(['/projects', entry.id]);
  }

  /** Swap highlighted marker + focus when the current project changes. */
  private applyCurrent(id: number | undefined): void {
    if (!this.map || !this.markers.size) return;

    for (const [rid, marker] of this.markers) {
      const isCurrent = rid === id;
      const icon = toDivIcon(isCurrent ? this.cfg.currentMarkerIcon : this.cfg.normalMarkerIcon);
      marker.setIcon(icon);
      marker.setZIndexOffset(isCurrent ? this.cfg.currentMarkerZIndex : 0);
    }

    const target = id !== undefined ? this.entryFor(id) : undefined;
    if (target) {
      this.map.setView([target.latitude, target.longitude], this.cfg.focusZoom);
    }
  }
protected fitAll(): void {
    if (!this.map || !this.markers.size) return;
    const points: L.LatLngExpression[] = [];
    for (const m of this.markers.values()) {
      const ll = m.getLatLng();
      points.push([ll.lat, ll.lng]);
    }
    this.map.fitBounds(L.latLngBounds(points), {
      padding: [30, 30],
      maxZoom: this.cfg.focusZoom,
    });
  }

  /** Small accessible preview as a real DOM node (no innerHTML injection). */
  private buildPopup(entry: ProjectMapEntry, isCurrent: boolean): HTMLElement {
    const root = document.createElement('div');
    root.className = isCurrent ? 'pm-popup pm-popup--current' : 'pm-popup';

    const img = document.createElement('img');
    img.className = 'pm-popup-img';
    img.alt = entry.title;
    img.width = 280;
    img.height = 150;
    img.loading = 'lazy';
    img.src =
      entry.previewImage ??
      'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="150"><rect width="100%" height="100%" fill="#e2e8f0"/><circle cx="70" cy="75" r="12" fill="#1e3a8a"/><text x="90" y="80" font-family="Arial" font-size="14" fill="#334155">SIGAT</text></svg>',
        );
    img.onerror = () => {
      img.style.display = 'none';
    };

    const body = document.createElement('div');
    body.className = 'pm-popup-body';

    // Current-project state: reuse the same legend key for a small badge.
    if (isCurrent) {
      const badge = document.createElement('span');
      badge.className = 'pm-popup-badge';
      badge.textContent = this.translateService.instant('map_legend_current');
      body.append(badge);
    }

    // Category chip (translated, derived from the existing Project model).
    if (entry.category) {
      const cat = document.createElement('span');
      cat.className = 'pm-popup-cat';
      cat.textContent = this.translateService.instant(`project_category_${entry.category}`);
      body.append(cat);
    }

    const title = document.createElement('p');
    title.className = 'pm-popup-title';
    title.textContent = entry.title;

    const loc = document.createElement('p');
    loc.className = 'pm-popup-loc';
    loc.textContent = entry.location;

    const cta = document.createElement('a');
    cta.className = 'pm-popup-cta';
    cta.href = this.router.serializeUrl(this.router.createUrlTree(['/projects', entry.id]));
    cta.textContent = this.translateService.instant('map_view_project');
    cta.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.navigateTo(entry);
    });

    body.append(title, loc, cta);
    root.append(img, body);
    return root;
  }

  private isValid(p: ProjectMapEntry): boolean {
    if (p.latitude === undefined || p.longitude === undefined) {
      if (typeof console !== 'undefined') {
        console.warn(`[project-map] Project "${p.title}" has no coordinates; skipped.`);
      }
      return false;
    }
    return true;
  }

  private teardown(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.markers.clear();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}