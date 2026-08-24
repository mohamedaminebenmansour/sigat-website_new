export type MediaType = 'image' | 'video';

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
