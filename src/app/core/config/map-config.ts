import { InjectionToken } from '@angular/core';

/**
 * Application-wide map configuration.
 *
 * Single source of truth for the interactive project map so the tile provider,
 * attribution, zoom bounds and marker styling can be changed in one place
 * without touching the map component.
 *
 * Defaults to public OpenStreetMap tile servers over HTTPS, per the OSM tile
 * usage policy: visible attribution, no prefetching of large areas, respect
 * browser caching. Swap `tileUrl`/`attribution` here to use a different
 * provider later.
 */
export interface MapConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
  /** Comfortable zoom used to focus a single (current) project. */
  focusZoom: number;
  /** Initial view of Tunisia when no current project can be focused. */
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  /** z-index for the current project marker (above the standard markers). */
  currentMarkerZIndex: number;
  /** Marker icon options, overridden per-state below. */
  normalMarkerIcon: LIcon;
  currentMarkerIcon: LIcon;
}

/** Re-export shape so consumers don't need a Leaflet import for typing. */
export interface LIcon {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor?: [number, number];
}

export const MAP_CONFIG = new InjectionToken<MapConfig>('map.config', {
  providedIn: 'root',
  factory: (): MapConfig => ({
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    minZoom: 5,
    focusZoom: 7,
    defaultCenter: { lat: 33.9, lng: 9.9 },
    defaultZoom: 6,
    currentMarkerZIndex: 1100,
    normalMarkerIcon: {
      className: 'pm-marker pm-marker--normal',
      html: '<span class="pm-pin"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    },
    currentMarkerIcon: {
      className: 'pm-marker pm-marker--current',
      html:
        '<span class="pm-current"><span class="pm-current-ring"></span><span class="pm-current-core"></span></span>',
      iconSize: [46, 46],
      iconAnchor: [23, 23],
      popupAnchor: [0, -22],
    },
  }),
});