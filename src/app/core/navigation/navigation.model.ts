export type SupportedLang = 'fr' | 'en' | 'ar';

export interface NavigationLink {
  path: string;
  label: string;
  isCta?: boolean;
}

export interface LanguageOption {
  code: SupportedLang;
  label: string;
}
