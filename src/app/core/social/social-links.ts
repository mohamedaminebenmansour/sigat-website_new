import { SocialLink } from './social.model';
import { COMPANY_INFO } from '../company/company-info';

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
    url: COMPANY_INFO.social.facebook,
    labelKey: '',
    icon: 'fa-brands fa-facebook-f'
  },
  {
    platform: 'linkedin',
    url: COMPANY_INFO.social.linkedin,
    labelKey: '',
    icon: 'fa-brands fa-linkedin-in'
  }
];
