export type MediaType = 'image' | 'video';

export type MediaProvider = 'local' | 'youtube';

export type MediaCategory =
  | 'projects'
  | 'construction'
  | 'hydraulic'
  | 'equipment'
  | 'videos';

export interface MediaItem {
  id: string;
  type: MediaType;
  src: string;
  category: MediaCategory;
  /** Video host. When 'youtube', `videoId` is used and `src` may be empty. */
  provider?: MediaProvider;
  /** YouTube video id (used when provider === 'youtube'). */
  videoId?: string;
  tags?: MediaCategory[];
  thumbnail?: string;
  poster?: string;
  duration?: string;
  titleKey?: string;
  descriptionKey?: string;
  projectId?: number;
  alt?: string;
  date?: string;
}
