import { Injectable } from '@angular/core';
import { MediaItem } from './media-item.model';

/**
 * Mock media data source.
 *
 * IMPORTANT: All assets below are DEMO / PLACEHOLDER media used during
 * development. They do NOT represent real SIGAT projects. Replace them
 * with the company''s own photography and video (self-hosted CDN) when
 * available.
 *
 * Future evolution:
 *   MediaService  ->  HTTP API / CMS  ->  Media backend
 * The rest of the app only depends on MediaService, so the data source
 * can be swapped without touching the components that consume it.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly media: MediaItem[] = [
    {
      id: 'hero-video',
      type: 'video',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      poster: 'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=1600&q=80',
      category: 'videos',
      thumbnail: '',
      duration: '0:12',
      titleKey: 'media_item_dam_title',
      descriptionKey: 'media_item_dam_desc',
      projectId: 1,
      alt: '',
      date: '2024'
    },
    {
      id: 'dam-site-1',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=1200&q=80',
      category: 'hydraulic',
      tags: ['projects'],
      thumbnail: 'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=600&q=80',
      titleKey: 'media_item_dam_title',
      descriptionKey: 'media_item_dam_desc',
      projectId: 1,
      alt: '',
      date: '2023'
    },
    {
      id: 'pipeline-1',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1200&q=80',
      category: 'hydraulic',
      tags: ['projects'],
      thumbnail: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80',
      titleKey: 'media_item_pipeline_title',
      descriptionKey: 'media_item_pipeline_desc',
      projectId: 2,
      alt: '',
      date: '2022'
    },
    {
      id: 'water-plant',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',
      category: 'hydraulic',
      tags: ['projects'],
      thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80',
      titleKey: 'media_item_water_title',
      descriptionKey: 'media_item_water_desc',
      projectId: 3,
      alt: '',
      date: '2024'
    },
    {
      id: 'construction-site',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=1200&q=80',
      category: 'construction',
      tags: ['projects'],
      thumbnail: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=600&q=80',
      titleKey: 'media_item_site_title',
      descriptionKey: 'media_item_site_desc',
      projectId: 4,
      alt: '',
      date: '2023'
    },
    {
      id: 'equipment-fleet',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=1200&q=80',
      category: 'equipment',
      thumbnail: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=600&q=80',
      titleKey: 'media_item_equipment_title',
      descriptionKey: 'media_item_equipment_desc',
      alt: '',
      date: '2024'
    },
    {
      id: 'workers-site',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80',
      category: 'construction',
      tags: ['projects'],
      thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80',
      titleKey: 'media_item_workers_title',
      descriptionKey: 'media_item_workers_desc',
      projectId: 4,
      alt: '',
      date: '2024'
    },
    {
      id: 'dam-video',
      type: 'video',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1200&q=80',
      category: 'videos',
      tags: ['hydraulic', 'projects'],
      thumbnail: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=600&q=80',
      duration: '0:15',
      titleKey: 'media_item_video_dam_title',
      descriptionKey: 'media_item_video_dam_desc',
      projectId: 1,
      alt: '',
      date: '2024'
    },
    {
      id: 'machinery-video',
      type: 'video',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      poster: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=1200&q=80',
      category: 'videos',
      tags: ['equipment'],
      thumbnail: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=600&q=80',
      duration: '0:15',
      titleKey: 'media_item_video_equipment_title',
      descriptionKey: 'media_item_video_equipment_desc',
      alt: '',
      date: '2024'
    },
    {
      id: 'site-video',
      type: 'video',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      poster: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=1200&q=80',
      category: 'videos',
      tags: ['construction', 'projects'],
      thumbnail: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=600&q=80',
      duration: '0:30',
      titleKey: 'media_item_video_site_title',
      descriptionKey: 'media_item_video_site_desc',
      projectId: 4,
      alt: '',
      date: '2023'
    }
  ];

  /** Boolean flag so components know these are placeholder assets. */
  readonly isDemoData = true;

  getHeroMedia(): MediaItem {
    return { ...this.media[0] };
  }

  getAll(): MediaItem[] {
    return this.media.map((m) => ({ ...m }));
  }

  getById(id: string): MediaItem | undefined {
    return this.media.find((m) => m.id === id);
  }

  getByCategory(category: MediaItem['category']): MediaItem[] {
    return this.media.filter(
      (m) => m.category === category || (m.tags ?? []).includes(category)
    );
  }

  getByProjectId(projectId: number): MediaItem[] {
    return this.media.filter((m) => m.projectId === projectId);
  }

  getFeatured(limit = 6): MediaItem[] {
    return this.media.slice(0, limit).map((m) => ({ ...m }));
  }
}
