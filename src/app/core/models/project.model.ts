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
}

export interface ProjectMedia {
  cover: string;
  gallery: string[];
}