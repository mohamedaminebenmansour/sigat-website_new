import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';

const PAGES = ['home', 'about', 'expertise', 'projects', 'hse', 'partnerships', 'careers', 'legal', 'contact', 'capabilities', 'media'];

/**
 * Per-page <title>, meta description and Open Graph tags, in the active language.
 * Keys: seo_<page>_t / seo_<page>_d (fr/en/ar.json). Unknown pages fall back to home.
 * Call `init()` once (main layout).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslateService);
  private started = false;

  init(destroyRef: DestroyRef): void {
    if (this.started) return;
    this.started = true;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(destroyRef)).subscribe(() => this.apply());
    this.i18n.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.apply());
    this.apply();
  }

  private apply(): void {
    const seg = this.router.url.split(/[?#]/)[0].split('/')[1] || 'home';
    const page = PAGES.includes(seg) ? seg : 'home';
    this.i18n.get([`seo_${page}_t`, `seo_${page}_d`]).subscribe(tr => {
      const t = tr[`seo_${page}_t`], d = tr[`seo_${page}_d`];
      const full = page === 'home' ? t : `${t} | SIGAT`;
      this.title.setTitle(full);
      this.meta.updateTag({ name: 'description', content: d });
      this.meta.updateTag({ property: 'og:title', content: full });
      this.meta.updateTag({ property: 'og:description', content: d });
      const lang = this.i18n.getCurrentLang() ?? 'fr';
      this.meta.updateTag({ property: 'og:locale', content: lang === 'ar' ? 'ar_TN' : lang === 'en' ? 'en_US' : 'fr_TN' });
    });
  }
}
