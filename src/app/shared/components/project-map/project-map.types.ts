import { divIcon, type DivIcon } from 'leaflet';
import type { LIcon } from '../../../core/config/map-config';
import type { Project } from '../../../core/models/project.model';

/** Convert a config icon descriptor into a Leaflet DivIcon. */
export function toDivIcon(icon: LIcon): DivIcon {
  return divIcon({
    className: icon.className,
    html: icon.html,
    iconSize: icon.iconSize,
    iconAnchor: icon.iconAnchor,
    popupAnchor: icon.popupAnchor,
  });
}

/**
 * Marker model the map type-safes against. Keep this decoupled from the full
 * `Project` object so the map stays reusable and clustering can slot in later
 * without touching the component's public API.
 */
export interface ProjectMapEntry {
  id: number;
  title: string;
  location: string;
  category?: Project['category'];
  latitude: number;
  longitude: number;
  /** Single preview image (cover preferred), never the whole gallery. */
  previewImage?: string;
}