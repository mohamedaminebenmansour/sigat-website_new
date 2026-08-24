import { SocialLink } from './social.model';

/**
 * Single source of truth for social media links.
 *
 * NOTE: These are PLACEHOLDER URLs for development.
 * Replace with the real SIGAT social accounts when available.
 *
 * Future API integration (Facebook/Instagram/LinkedIn feeds) must be
 * implemented on a backend service. API keys/tokens must NEVER live in
 * this Angular frontend source.
 */
export const SOCIAL_LINKS: SocialLink[] = [
  {
    platform: 'facebook',
    url: 'https://www.facebook.com/placeholder-sigat',
    labelKey: '',
    icon: 'fa-brands fa-facebook-f'
  },
  {
    platform: 'linkedin',
    url: 'https://www.linkedin.com/company/placeholder-sigat',
    labelKey: '',
    icon: 'fa-brands fa-linkedin-in'
  },
  {
    platform: 'instagram',
    url: 'https://www.instagram.com/placeholder-sigat',
    labelKey: '',
    icon: 'fa-brands fa-instagram'
  }
];
