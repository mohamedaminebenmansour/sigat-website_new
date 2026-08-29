import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
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
      <div
        #card
        class="pm-card"
        [class.pm-card--open]="cardOpen()"
        aria-live="polite"
      ></div>

      @if (tileError()) {
        <div class="pm-error" role="alert">{{ 'map_tile_error' | translate }}</div>
      }

      <div class="pm-legend" aria-hidden="true">
        <div class="pm-legend-row">
          <span class="pm-legend-dot pm-legend-dot--normal"></span>
          <span>{{ 'map_legend_projects' | translate }}</span>
        </div>
        @if (hasCurrent()) {
          <div class="pm-legend-row">
            <span class="pm-legend-dot pm-legend-dot--current"></span>
            <span>{{ 'map_legend_current' | translate }}</span>
          </div>
        }
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
  readonly currentProjectId = input<number | undefined | null>(undefined);

  private readonly stage = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly cardEl = viewChild<ElementRef<HTMLDivElement>>('card');
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly cfg: MapConfig = inject(MAP_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tileError = signal(false);

  /** True in Mode A (Project Details); false in Mode B (Projects listing). */
  protected readonly hasCurrent = computed(() => this.currentProjectId() != null);

  /** Whether the smart-positioned project card is currently visible. */
  protected readonly cardOpen = signal(false);

  private map: L.Map | null = null;
  private markers = new Map<number, L.Marker>();
  private initialized = false;
  private observer: IntersectionObserver | null = null;

  /**
   * Deterministic hover state. We avoid relying on Leaflet's popupPane DOM
   * (popups are created/moved dynamically) and instead track which marker is
   * hovered plus a tiny close delay that lets the pointer travel from a marker
   * onto its popup without the preview closing.
   */
  private hoveredId: number | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  /** The marker whose card is currently shown (for positioning + hover class). */
  private activeCardMarker: L.Marker | null = null;
  /** Cached card size so repositioning on pan/zoom never forces a reflow. */
  private cardSizes: { w: number; h: number } | null = null;
  /** One-time check: on touch-only devices there is no real hover, so we keep
   *  popups open (tap to show, CTA to navigate) rather than closing on the
   *  synthetic mouseout that browsers emit after a tap. */
  private readonly isTouchOnly =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(hover: none)').matches;

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

    // Keep the (open) project card glued to its marker while the map pans,
    // zooms, or its container resizes. Leaflet emits 'move'/'zoom' during real
    // interaction and 'resize' when the container (incl. window/orientation)
    // changes - so no polling and no extra window listeners are needed. All of
    // these are removed with map.remove() in teardown().
    this.map.on('move zoom', () => this.positionCard(false));
    this.map.on('resize', () => this.positionCard(true));

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
      // only by visual class, never by availability). The card is rendered into
      // a smart-positioned layer (see showCard/positionCard) instead of a native
      // Leaflet popup, so it stays fully inside the map at every edge.

      // Click: other projects navigate immediately; the current project opens
      // its preview. On touch-only devices the first tap opens the preview and
      // the card CTA (or a second tap on the marker) is what navigates.
      marker.on('click', (ev) => {
        ev.originalEvent.stopPropagation();
        if (entry.id !== this.currentProjectId() && !this.isTouchOnly) {
          this.navigateToProject(entry);
        } else {
          this.showCard(entry, marker);
        }
      });

      // Hover: identical for ALL markers - set hover state + open the card.
      marker.on('mouseover', () => {
        if (this.isTouchOnly) return;
        this.showCard(entry, marker);
      });
      // mouseout fires when leaving the marker. We only schedule a close; the
      // tiny delay (and the timer cancel in mouseover / card mouseenter) lets
      // the pointer travel onto the card or to another marker cleanly.
      marker.on('mouseout', (e) => {
        if (this.isTouchOnly) return;
        this.mouseOutOfMarker(marker, entry.id);
      });

      this.markers.set(entry.id, marker);
    }

    if (currentId === undefined) {
      this.fitAll();
    }
  }

  /** Open (or switch) the project card for a marker + glue it to the marker. */
  private showCard(entry: ProjectMapEntry, marker: L.Marker): void {
    const card = this.cardEl()?.nativeElement;
    if (!card) return;

    this.clearCloseTimer();
    this.hoveredId = entry.id;

    // ACTIVE/SELECTED state: the marker whose card is open gets a distinct
    // emphasis (in addition to transient hover). Clear it from the previous one.
    const prev = this.activeCardMarker;
    this.activeCardMarker = marker;
    prev?.getElement()?.classList.remove('pm-marker--active');
    marker.getElement()?.classList.add('pm-marker--hover', 'pm-marker--active');

    // Rebuild content (fresh node per open - its listeners die with it).
    card.replaceChildren(this.buildPopup(entry, entry.id === this.currentProjectId()));
    this.positionCard(true);
    this.cardOpen.set(true);
  }

  /** Close the project card for good. */
  private hideCard(): void {
    this.clearCloseTimer();
    this.hoveredId = null;
    const marker = this.activeCardMarker;
    this.activeCardMarker = null;
    this.cardSizes = null;
    marker?.getElement()?.classList.remove('pm-marker--hover', 'pm-marker--active');
    this.cardOpen.set(false);
    const card = this.cardEl()?.nativeElement;
    if (card) card.replaceChildren();
  }

  /**
   * Position the card so it is ALWAYS fully inside the visible map area.
   *
   * - Uses real stage/card measurements (no hard-coded pixel sizes).
   * - Horizontal: center on the marker, then clamp - a marker near the right
   *   edge shifts the card left, near the left edge shifts it right.
   * - Vertical: prefer above the marker; if there is not enough room above,
   *   flip below. Both are clamped to the stage with a 12px safety margin.
   * - `rescale` re-measures the card (on open/resize); otherwise we reuse the
   *   cached size so panning is cheap.
   */
  private positionCard(rescale: boolean): void {
    const card = this.cardEl()?.nativeElement;
    const stageEl = this.stage()?.nativeElement;
    if (!card || !stageEl || !this.map || !this.activeCardMarker) return;

    if (rescale || !this.cardSizes) {
      this.cardSizes = { w: card.offsetWidth, h: card.offsetHeight };
    }
    const { w, h } = this.cardSizes;
    const stageW = stageEl.clientWidth;
    const stageH = stageEl.clientHeight;
    const margin = 12;

    const pt = this.map.latLngToContainerPoint(this.activeCardMarker.getLatLng());

    // Horizontal: center on marker, clamp into the stage.
    const maxX = stageW - w - margin;
    let x = pt.x - w / 2;
    x = Math.max(margin, Math.min(x, maxX));

    // Vertical: prefer above the marker; flip below when there is no room.
    let y = pt.y - h - margin;
    if (y < margin) {
      y = Math.min(pt.y + margin, stageH - h - margin);
    } else if (y + h > stageH - margin) {
      y = stageH - h - margin;
    }
    y = Math.max(margin, y);

    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  /**
   * Leave a marker. We do NOT close immediately: a short timer allows the
   * pointer to move onto the marker's own card. If it moves to another marker
   * first (mouseover) or onto the card (mouseenter), the timer is cancelled.
   */
  private mouseOutOfMarker(marker: L.Marker, id: number): void {
    marker.getElement()?.classList.remove('pm-marker--hover');
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      // Only close if we're still on THIS marker - a subsequent mouseover on
      // another marker / card cancels the timer.
      if (this.hoveredId === id) {
        this.hideCard();
      }
    }, 120);
  }

  /** Single deterministic navigation entry point for the SPA. */
  private async navigateToProject(entry: ProjectMapEntry): Promise<void> {
    if (!entry || !Number.isFinite(entry.id)) return;

    this.hideCard();

    try {
      await this.router.navigate(['/projects', entry.id]);
    } catch (err) {
      // Keep the map usable even if navigation is interrupted.
      console.warn('[project-map] Navigation to project failed:', err);
    }
  }

  /** Swap highlighted marker + focus when the current project changes. */
  private applyCurrent(id: number | null | undefined): void {
    if (!this.map || !this.markers.size) return;

    for (const [rid, marker] of this.markers) {
      const isCurrent = rid === id;
      const icon = toDivIcon(isCurrent ? this.cfg.currentMarkerIcon : this.cfg.normalMarkerIcon);
      marker.setIcon(icon);
      marker.setZIndexOffset(isCurrent ? this.cfg.currentMarkerZIndex : 0);
    }

    const target = id != null ? this.entryFor(id) : undefined;
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
      this.navigateToProject(entry);
    });

    body.append(title, loc, cta);
    root.append(img, body);

    // Hover keep-open: entering the card (from the marker) cancels the close
    // timer; leaving the card entirely closes the preview immediately. Fresh
    // node per open, so these listeners die with the node - no leaks.
    root.addEventListener('mouseenter', () => this.clearCloseTimer());
    root.addEventListener('mouseleave', () => this.hideCard());

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
    this.clearCloseTimer();
    this.hoveredId = null;
    this.activeCardMarker = null;
    this.cardSizes = null;
    this.cardOpen.set(false);
    this.markers.clear();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}