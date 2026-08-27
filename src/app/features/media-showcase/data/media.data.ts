import { MediaItem } from '../models/media-item.model';

/**
 * Home Media Showcase slides.
 *
 * Photographs are production-optimised WebP (multi-width variants live next to
 * each file, e.g. `-1280.webp` / `-768.webp`). The leading video item uses the
 * YouTube-hosted architecture: a poster is shown first and an <iframe> player
 * is only created when the video is actually reached/activated — no large
 * local MP4 is shipped with the site.
 */
export const SHOWCASE_MEDIA: MediaItem[] = [
  {
    id: 'showcase-video',
    type: 'video',
    provider: 'local',
    src: 'assets/media/hero/AEP-ouled-khalfallah-01.web.mp4',
    poster: 'assets/media/hero/AEP-ouled-khalfallah-poster.webp',
    category: 'videos',
    titleKey: 'home_hero_title',
    descriptionKey: 'home_hero_subtitle'
  },
  {
    id: 'showcase-image-1',
    type: 'image',
    src: 'assets/media/gallery/20240428-station.webp',
    category: 'projects',
    titleKey: 'home_stat_years',
    descriptionKey: 'home_stat_projects'
  },
  {
    id: 'showcase-image-2',
    type: 'image',
    src: 'assets/media/gallery/20231229-pipeline.webp',
    category: 'construction',
    titleKey: 'home_expertise_title',
    descriptionKey: 'home_expertise_subtitle'
  },
  {
    id: 'showcase-image-3',
    type: 'image',
    src: 'assets/media/gallery/20231222-pipeline.webp',
    category: 'hydraulic',
    titleKey: 'home_projects_title',
    descriptionKey: 'home_projects_subtitle'
  },
  {
    id: 'showcase-image-4',
    type: 'image',
    src: 'assets/media/gallery/20230618-riprap.webp',
    category: 'equipment',
    titleKey: 'home_cta_title',
    descriptionKey: 'home_cta_subtitle'
  }
];
