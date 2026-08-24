export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  labelKey: string;
  icon: string;
}
