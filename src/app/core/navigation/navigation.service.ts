import { Injectable } from '@angular/core';
import { NavigationLink, LanguageOption, SupportedLang } from './navigation.model';

export const NAV_LINKS: NavigationLink[] = [
  { path: '/home', label: 'nav_home' },
  { path: '/expertise', label: 'nav_expertise' },
  { path: '/projects', label: 'nav_projects' },
  { path: '/capabilities', label: 'nav_capabilities' },
  { path: '/hse', label: 'nav_hse' },
  { path: '/partnerships', label: 'nav_partnerships', isCta: true },
  { path: '/contact', label: 'nav_contact' }
];

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'عر' }
];

@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly navLinks = NAV_LINKS;
  readonly languages = SUPPORTED_LANGUAGES;
}
