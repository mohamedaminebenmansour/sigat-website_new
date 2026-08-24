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
}
