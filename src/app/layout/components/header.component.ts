import { Component, output, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppTranslateService } from '../../core/services/translate.service';
import { NavigationService } from '../../core/navigation/navigation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  styles: [
    `
      @keyframes lang-dropdown-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .lang-dropdown {
        animation: lang-dropdown-in 0.16s ease-out;
      }
      .brand-zone {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 280px;
        min-width: 280px;
        padding-left: 0.5rem;
        /* Keep the full logo image inside the header's own height so the
           entire header (logo + navigation) hides together with
           translateY(-100%). The PNG has transparent top/bottom padding;
           this clips only that padding while the drawn logo stays visible
           and vertically centered. */
        height: 100%;
        align-self: stretch;
        overflow: hidden;
      }
      .brand-zone img {
        width: 235px;
        max-width: 235px;
        height: auto;
        display: block;
        object-fit: contain;
      }
      @media (max-width: 1023px) {
        .brand-zone {
          width: auto;
          min-width: 0;
          padding-left: 0;
        }
        .brand-zone img {
          width: 190px;
          max-width: 190px;
        }
      }
      @media (max-width: 767px) {
        .brand-zone img {
          width: 150px;
          max-width: 150px;
        }
      }
      .header-visible {
        transform: translateY(0);
      }
      .header-hidden {
        transform: translateY(-100%);
      }
    `
  ],
  template: `
    <header [class]="headerClasses()" [style.will-change.transform]="'transform'">
      <div class="container mx-auto px-4 h-full">
        <div class="grid grid-cols-[auto_1fr] items-center gap-2 h-full">
          <!-- BRAND ZONE -->
          <div class="brand-zone">
            <a routerLink="/home" [class]="logoClasses()" aria-label="SIGAT home">
              <img
                src="assets/media/logo/sigatlogo.png"
                alt="SIGAT"
                class="h-auto object-contain"
              />
            </a>
          </div>

          <!-- NAVIGATION ZONE -->
          <div class="flex items-center justify-end gap-1 min-w-0">
            <nav class="hidden md:flex items-center gap-1">
              @for (link of navLinks; track link.path) {
                @if (link.isCta) {
                  <a [routerLink]="link.path" routerLinkActive="ring-2 ring-current"
                    class="px-4 py-2 rounded-lg text-white font-bold transition-colors text-sm bg-amber-500 hover:bg-amber-600">
                    {{ link.label | translate }}
                  </a>
                } @else {
                  <a [routerLink]="link.path" routerLinkActive="text-blue-800"
                    class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-blue-950 hover:text-blue-800">
                    {{ link.label | translate }}
                  </a>
                }
              }
            </nav>
            <div class="hidden md:flex items-center gap-1">
              <div class="relative" #langSelector>
                <button
                  (click)="toggleLanguageDropdown()"
                  [attr.aria-haspopup]="'listbox'"
                  [attr.aria-expanded]="languageDropdownOpen()"
                  [attr.aria-label]="'Change language'"
                  class="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-transparent text-blue-950 transition-colors hover:text-blue-800"
                >
                  <span>{{ currentLanguageLabel }}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3 transition-transform duration-150"
                    [class.rotate-180]="languageDropdownOpen()"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                  </svg>
                </button>

                @if (languageDropdownOpen()) {
                  <ul
                    role="listbox"
                    aria-label="Language options"
                    class="lang-dropdown absolute end-0 top-full mt-1 min-w-[3.75rem] rounded-md bg-white/10 text-center text-blue-950 backdrop-blur-md ring-1 ring-white/20 shadow-lg py-1 z-50"
                  >
                    @for (lang of otherLanguages; track lang.code) {
                      <li role="presentation">
                        <button
                          role="option"
                          (click)="selectLanguage(lang.code)"
                          [attr.aria-selected]="'false'"
                          class="block w-full px-3 py-1.5 text-xs font-semibold text-blue-950 transition-colors hover:bg-black/5"
                        >
                          {{ lang.label }}
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
            <button [class]="mobileBtnClasses()"
              (click)="toggleMobileMenu()" aria-label="Toggle menu">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  /** Scroll distance (px) past which the header switches to the glass state. */
  private static readonly SCROLL_THRESHOLD = 120;

  readonly mobileMenuToggled = output<void>();
  readonly isVisible = signal(false);
  readonly isScrolled = signal(false);
  readonly isTouchDevice = signal(false);
  readonly navLinks: NavigationService['navLinks'];
  readonly languages: NavigationService['languages'];
  currentLang: string;

  readonly languageDropdownOpen = signal(false);

  @ViewChild('langSelector') langSelectorRef?: ElementRef<HTMLDivElement>;

  constructor(
    private readonly navigationService: NavigationService,
    private readonly translateService: AppTranslateService
  ) {
    this.navLinks = this.navigationService.navLinks;
    this.languages = this.navigationService.languages;
    this.currentLang = this.translateService.getCurrentLang();
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.isTouchDevice.set(!window.matchMedia('(hover: hover)').matches);
    }
    if (typeof window !== 'undefined') {
      this.isScrolled.set(window.scrollY > HeaderComponent.SCROLL_THRESHOLD);
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isTouchDevice()) {
      return;
    }
    if (event.clientY < 80) {
      this.isVisible.set(true);
    } else {
      this.isVisible.set(false);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const scrolled = window.scrollY > HeaderComponent.SCROLL_THRESHOLD;
    if (scrolled !== this.isScrolled()) {
      this.isScrolled.set(scrolled);
    }
  }

  switchLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.translateService.switchLanguage(lang);
    this.currentLang = lang;
  }

  toggleMobileMenu(): void {
    this.mobileMenuToggled.emit();
  }

  get currentLanguageLabel(): string {
    return this.languages.find((l) => l.code === this.currentLang)?.label ?? this.currentLang;
  }

  get otherLanguages(): { code: 'fr' | 'en' | 'ar'; label: string }[] {
    return this.languages.filter((l) => l.code !== this.currentLang);
  }

  toggleLanguageDropdown(): void {
    this.languageDropdownOpen.update((open) => !open);
  }

  selectLanguage(lang: 'fr' | 'en' | 'ar'): void {
    if (lang !== this.currentLang) {
      this.switchLanguage(lang);
    }
    this.languageDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (
      this.languageDropdownOpen() &&
      this.langSelectorRef &&
      !this.langSelectorRef.nativeElement.contains(event.target as Node)
    ) {
      this.languageDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.languageDropdownOpen.set(false);
  }

  headerClasses(): string {
    const visible = this.isScrolled() || this.isVisible() || this.isTouchDevice();
    const state = visible ? 'header-visible' : 'header-hidden';
    const surface = this.isScrolled()
      ? 'bg-white/85 backdrop-blur-md border-b border-blue-950/10 header-glass'
      : 'bg-white/70 backdrop-blur-[10px] border-b border-blue-950/10';
    return `fixed top-0 inset-x-0 z-50 ${state} transition-all duration-300 ${surface} text-blue-950 h-20 md:h-24`;
  }

  logoClasses(): string {
    return 'text-xl font-bold tracking-tight transition-colors duration-300 text-blue-950';
  }

  mobileBtnClasses(): string {
    return 'md:hidden p-2 rounded-lg transition-colors text-blue-950 hover:bg-blue-100';
  }
}
