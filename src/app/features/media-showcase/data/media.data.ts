import { MediaItem } from '../models/media-item.model';

export const SHOWCASE_MEDIA: MediaItem[] = [
  {
    id: 'showcase-video',
    type: 'video',
    src: '/assets/media/hero/AEP-ouled-khalfallah-01.mp4',
    poster: '/assets/media/hero/20240428_154504.jpg',
    category: 'videos',
    titleKey: 'home_hero_title',
    descriptionKey: 'home_hero_subtitle'
  },
  {
    id: 'showcase-image-1',
    type: 'image',
    src: '/assets/media/hero/20240428_154504.jpg',
    category: 'projects',
    titleKey: 'home_stat_years',
    descriptionKey: 'home_stat_projects'
  },
  {
    id: 'showcase-image-2',
    type: 'image',
    src: '/assets/media/hero/20231229_080306.jpg',
    category: 'construction',
    titleKey: 'home_expertise_title',
    descriptionKey: 'home_expertise_subtitle'
  },
  {
    id: 'showcase-image-3',
    type: 'image',
    src: '/assets/media/hero/20231222_154056.jpg',
    category: 'hydraulic',
    titleKey: 'home_projects_title',
    descriptionKey: 'home_projects_subtitle'
  },
  {
    id: 'showcase-image-4',
    type: 'image',
    src: '/assets/media/hero/20230618_115405.jpg',
    category: 'equipment',
    titleKey: 'home_cta_title',
    descriptionKey: 'home_cta_subtitle'
  }
];
