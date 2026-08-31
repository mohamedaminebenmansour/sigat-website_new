export interface Project {
  id: number;
  title: string;
  category: 'hydraulic' | 'construction' | 'pipeline' | 'infrastructure';
  location: string;
  year: string;
  description: string;
  client: string;
  scope: string;
  imageUrl: string;
  galleryUrls: string[];
  /**
   * Single source of truth for project media.
   *
   * When present, the project detail/media presentation uses `media.cover`
   * as its permanent background and `media.gallery` as the layered
   * field-documentation stack. `imageUrl`/`galleryUrls` remain as a legacy
   * fallback so existing cards and everything else keep working.
   */
  media?: ProjectMedia;

  // ------------------------------------------------------------------
  // Case-study extensions (optional / additive - every field below is
  // optional so legacy projects keep rendering without them).
  // ------------------------------------------------------------------

  /** Display period, e.g. '2021' and '2023'. Falls back to `year`. */
  startDate?: string;
  endDate?: string;

  /**
   * Structured case-study content. All sentences are translation keys (see the
   * fr/en/ar json files); the component never embeds copy directly.
   */
  content?: ProjectContent;

  /** Quantifiable results (variable length). */
  metrics?: ProjectMetric[];

  /** Geographic information for the location/map section. */
  locationGeo?: ProjectGeo;

  /** Marks this entry as the company office rather than a real construction project. */
  isOffice?: boolean;
}

export interface ProjectMedia {
  cover: string;
  gallery: string[];
}

export interface ProjectContent {
  /** Short overview always visible. */
  overviewKey: string;
  /** Challenge paragraph (always visible; concise). */
  challengeKey: string;
  /** Execution activities as translation keys (progressive disclosure list). */
  executionScopeKeys: string[];
  /** Equipment / technology / methods as translation keys. */
  equipmentKeys?: string[];
}

export interface ProjectMetric {
  /** Label translation key, e.g. 'project_1_metric_1_label'. */
  labelKey: string;
  /** Numeric or short value kept in the model (never in the component). */
  value: string;
  /** Optional unit rendered next to the value. */
  unit?: string;
}

export interface ProjectGeo {
  name: string;
  latitude?: number;
  longitude?: number;
  /** Optional short city label for map popups/legends (falls back to `name`). */
  city?: string;
  /** Optional region, e.g. 'Grand Tunis'. */
  region?: string;
}