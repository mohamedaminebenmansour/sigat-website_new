import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppTranslateService } from '../../core/services/translate.service';
import { NAV_LINKS, SUPPORTED_LANGUAGES } from '../../core/navigation/navigation.service';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[100] bg-blue-900 md:hidden">
        <!-- Close button -->
        <div class="flex justify-end p-4">
          <button
            (click)="close.emit()"
            class="p-2 rounded hover:bg-blue-800 transition-colors text-white"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="flex flex-col items-center gap-6 mt-8 px-4">
          @for (link of navLinks; track link.path) {
            @if (link.path === '/partnerships') {
              <a
                [routerLink]="link.path"
                routerLinkActive="ring-2 ring-white"
                (click)="close.emit()"
                class="w-full text-center px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors text-lg"
              >
                {{ 'nav_partner_cta' | translate }}
              </a>
            } @else {
              <a
                [routerLink]="link.path"
                routerLinkActive="text-blue-300"
                (click)="close.emit()"
                class="w-full text-center text-white hover:text-blue-300 transition-colors text-lg font-medium py-2"
              >
                {{ link.label | translate }}
              </a>
            }
          }
        </nav>

        <!-- Language Switcher -->
        <div class="flex justify-center gap-3 mt-12">
          @for (lang of languages; track lang.code) {
            <button
              (click)="switchLanguage(lang.code)"
              class="px-5 py-2 rounded text-sm font-medium transition-colors text-white"
              [class.bg-blue-700]="currentLang === lang.code"
              [class.hover:bg-blue-700]="currentLang !== lang.code"
            >
              {{ lang.label }}
            </button>
          }
        </div>
      </div>
    }
  `
})
export class MobileMenuComponent {
  readonly isOpen = input(false);
  readonly close = output<void>();

  readonly navLinks = NAV_LINKS;
  readonly languages = SUPPORTED_LANGUAGES;
  currentLang: string;

  constructor(private appTranslateService: AppTranslateService) {
    this.currentLang = this.appTranslateService.getCurrentLang();
  }

  switchLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.appTranslateService.switchLanguage(lang);
    this.currentLang = lang;
  }
}
