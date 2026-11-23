import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class AppTranslateService {
  constructor(private translate: TranslateService) {
    // The default language ('fr') is set via provideTranslateService config.
    // Switch to it explicitly and set HTML attributes.
    // ?lang=ar in the URL wins (shareable), then the visitor's last choice, then French
    const lang = AppTranslateService.initialLang();
    this.translate.use(lang);
    this.setHtmlAttributes(lang);
  }

  private static initialLang(): 'fr' | 'en' | 'ar' {
    const ok = (v: string | null): v is 'fr' | 'en' | 'ar' => v === 'fr' || v === 'en' || v === 'ar';
    if (typeof window === 'undefined') return 'fr';
    const q = new URLSearchParams(window.location.search).get('lang');
    if (ok(q)) return q;
    try { const saved = localStorage.getItem('sigat-lang'); if (ok(saved)) return saved; } catch { /* storage blocked */ }
    return 'fr';
  }

  /**
   * Switch the active language and update HTML attributes for RTL/LTR support.
   * @param lang Language code: 'fr', 'en', or 'ar'
   */
  switchLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.translate.use(lang);
    this.setHtmlAttributes(lang);
    try { localStorage.setItem('sigat-lang', lang); } catch { /* storage blocked: the choice lasts for this visit */ }
  }

  /**
   * Get the current active language as a plain string.
   */
  getCurrentLang(): string {
    return this.translate.getCurrentLang() ?? 'fr';
  }

  /**
   * Set dir and lang attributes on the <html> element.
   * Arabic uses RTL; French and English use LTR.
   */
  private setHtmlAttributes(lang: string): void {
    const htmlElement = document.documentElement;

    if (lang === 'ar') {
      htmlElement.dir = 'rtl';
      htmlElement.lang = 'ar';
    } else {
      htmlElement.dir = 'ltr';
      htmlElement.lang = lang; // 'fr' or 'en'
    }
  }
}
