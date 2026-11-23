import { Component, ElementRef, HostListener, ViewChild, effect, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppTranslateService } from '../../core/services/translate.service';
import { NAV_LINKS, SUPPORTED_LANGUAGES } from '../../core/navigation/navigation.service';
import { COMPANY_INFO, COMPANY_MAILTO, COMPANY_TEL } from '../../core/company/company-info';

/**
 * Mobile menu — the site's language on a phone.
 * Opening it FILLS the panel with water from the bottom (a level rising, its surface still moving);
 * the links appear as the water reaches them. Closing drains it. Page scroll is locked while open,
 * Escape closes it, focus goes to the close button. Reduced motion: no fill, no stagger.
 */
@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="mm lg:hidden" [class.is-open]="isOpen()" [attr.aria-hidden]="!isOpen()" role="dialog" aria-modal="true" [attr.aria-label]="'nav_quick_links' | translate">
      <div class="mm__veil" (click)="close.emit()"></div>
      <div class="mm__water" aria-hidden="true">
        <svg class="mm__surface" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 22 C150 4 300 4 450 22 S750 40 900 22 S1050 4 1200 22 V40 H0Z" /></svg>
      </div>

      <div class="mm__panel">
        <div class="mm__top">
          <a routerLink="/home" (click)="close.emit()" class="mm__logo" aria-label="SIGAT">
            <img src="assets/media/logo/sigatlogo-white-trim.png" alt="SIGAT" />
          </a>
          <button #closeBtn type="button" class="mm__close" (click)="close.emit()" [attr.aria-label]="'mm_close' | translate" [tabindex]="isOpen() ? 0 : -1">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <nav class="mm__nav">
          @for (link of links; track link.path; let i = $index) {
            <a [routerLink]="link.path" routerLinkActive="is-active" (click)="close.emit()" class="mm__link" [style.--i]="i" [tabindex]="isOpen() ? 0 : -1">
              <span class="mm__num">{{ (i + 1).toString().padStart(2, '0') }}</span>
              <span class="mm__label hx-display">{{ link.label | translate }}</span>
              <i class="fa-solid fa-chevron-right mm__chev" aria-hidden="true"></i>
            </a>
          }
        </nav>

        <div class="mm__foot" [style.--i]="links.length">
          <a routerLink="/partnerships" (click)="close.emit()" class="hx-btn hx-btn--primary mm__cta" [tabindex]="isOpen() ? 0 : -1">
            {{ 'nav_partner_cta' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
          <div class="mm__quick">
            @if (tel) {
              <a [href]="tel" class="mm__q" [tabindex]="isOpen() ? 0 : -1"><i class="fa-solid fa-phone" aria-hidden="true"></i>{{ 'mm_call' | translate }}</a>
            }
            <a [href]="mailto" class="mm__q" [tabindex]="isOpen() ? 0 : -1"><i class="fa-solid fa-envelope" aria-hidden="true"></i>{{ 'mm_write' | translate }}</a>
            <a [href]="maps" target="_blank" rel="noopener noreferrer" class="mm__q" [tabindex]="isOpen() ? 0 : -1"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>{{ 'mm_route' | translate }}</a>
          </div>
          <div class="mm__lang" role="group" [attr.aria-label]="'nav_language' | translate">
            @for (lang of languages; track lang.code) {
              <button type="button" (click)="switchLanguage(lang.code)" [class.is-on]="currentLang === lang.code" [attr.aria-pressed]="currentLang === lang.code" [tabindex]="isOpen() ? 0 : -1">{{ lang.label }}</button>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class MobileMenuComponent {
  readonly isOpen = input(false);
  readonly close = output<void>();
  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  private readonly appTranslateService = inject(AppTranslateService);
  /** pages, the partnership CTA has its own button at the bottom */
  readonly links = NAV_LINKS.filter(l => !l.isCta);
  readonly languages = SUPPORTED_LANGUAGES;
  readonly tel = COMPANY_TEL;
  readonly mailto = COMPANY_MAILTO;
  readonly maps = COMPANY_INFO.mapsUrl;
  currentLang = this.appTranslateService.getCurrentLang();

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (typeof document === 'undefined') return;
      document.documentElement.style.overflow = open ? 'hidden' : '';     // the page behind stays still
      if (open) setTimeout(() => this.closeBtn?.nativeElement.focus(), 60);
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.isOpen()) this.close.emit(); }

  switchLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.appTranslateService.switchLanguage(lang);
    this.currentLang = lang;
  }
}
