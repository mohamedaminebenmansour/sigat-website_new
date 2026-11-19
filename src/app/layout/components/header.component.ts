import { Component, output, signal, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppTranslateService } from '../../core/services/translate.service';
import { NAV_LINKS, SUPPORTED_LANGUAGES } from '../../core/navigation/navigation.service';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';

/** Primary links shown in the bar (mockup); the rest live under "Plus" and in the mobile menu. */
const PRIMARY = ['/home', '/about', '/expertise', '/projects', '/contact'];

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, WavePipeComponent],
  styles: [`
    .sky { background: linear-gradient(180deg, #1565d8 0%, #2f8de8 55%, #6cc0f5 100%); }
    .nl { position: relative; }
    .nl::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 4px; height: 2px; background: #fff;
                 transform: scaleX(0); transition: transform .25s; }
    .nl:hover::after, .nl.active::after { transform: scaleX(1); }
  `],
  template: `
    <header class="sky fixed inset-x-0 top-0 z-50 overflow-visible shadow-lg shadow-blue-950/25 transition-[height] duration-300"
            [style.height.px]="isScrolled() ? 64 : 74">
      <div class="container relative mx-auto flex h-full items-center gap-6 px-4">
        <a routerLink="/home" aria-label="SIGAT" class="shrink-0 drop-shadow">
          <!-- official SIGAT logo (white version on the blue bar) -->
          <img src="assets/media/logo/sigatlogo-white-trim.png" alt="SIGAT — Société Internationale des Grands Travaux"
               class="block w-auto transition-[height] duration-300" [style.height.px]="isScrolled() ? 46 : 56" />
        </a>

        <nav class="ml-auto hidden items-center gap-1 lg:flex">
          @for (link of primary; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="active"
               class="nl rounded-lg px-3 py-2 font-serif text-[16px] text-white">{{ link.label | translate }}</a>
          }
          <div class="relative">
            <button type="button" (click)="moreOpen.set(!moreOpen())" [attr.aria-expanded]="moreOpen()"
                    class="nl rounded-lg px-3 py-2 font-serif text-[16px] text-white">
              {{ 'nav_more' | translate }} <i class="fa-solid fa-chevron-down text-[10px]"></i>
            </button>
            @if (moreOpen()) {
              <div class="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-blue-900/10">
                @for (link of secondary; track link.path) {
                  <a [routerLink]="link.path" (click)="moreOpen.set(false)"
                     class="block px-4 py-2.5 text-sm font-medium text-blue-950 hover:bg-blue-50">{{ link.label | translate }}</a>
                }
              </div>
            }
          </div>
        </nav>

        <!-- search + language (mockup) -->
        <div class="relative hidden items-center gap-1.5 rounded-xl bg-white py-1 pl-3 pr-1 shadow-inner lg:flex">
          <i class="fa-solid fa-magnifying-glass text-sm text-slate-500" aria-hidden="true"></i>
          <input type="search" [placeholder]="'nav_search' | translate" [attr.aria-label]="'nav_search' | translate"
                 class="w-36 border-0 bg-transparent text-sm text-blue-950 outline-none focus:ring-0"
                 [value]="query()" (input)="onSearch($event)" (keydown.enter)="goFirst()" (blur)="closeSearchSoon()">
          <select class="rounded-md border-0 bg-blue-50 px-2 py-1.5 text-xs font-bold text-blue-950 focus:ring-2 focus:ring-blue-400"
                  [attr.aria-label]="'nav_language' | translate" (change)="onLang($event)">
            @for (lang of languages; track lang.code) { <option [value]="lang.code" [selected]="lang.code === currentLang">{{ lang.label }}</option> }
          </select>
          @if (results().length) {
            <ul class="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-blue-900/10">
              @for (r of results(); track r.path) {
                <li><a [routerLink]="r.path" (mousedown)="go(r.path)" class="block px-4 py-2 text-sm text-blue-950 hover:bg-blue-50">{{ r.label | translate }}</a></li>
              }
            </ul>
          }
        </div>

        <button class="ml-auto rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" (click)="toggleMobileMenu()" aria-label="Toggle menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <!-- The header's lower edge is a live glass pipe: water flows along it
           and the glowing couplings mark each joint (same pipe as the footer). -->
      <app-wave-pipe class="absolute inset-x-0 -bottom-[13px]" [height]="26" [amplitude]="3" [radius]="7" [phase]="0.4" [speed]="90" />
    </header>
  `
})
export class HeaderComponent {
  readonly mobileMenuToggled = output<void>();
  readonly isScrolled = signal(false);
  readonly moreOpen = signal(false);
  readonly query = signal('');
  readonly results = signal<{ path: string; label: string }[]>([]);
  readonly primary = NAV_LINKS.filter(l => PRIMARY.includes(l.path));
  readonly secondary = NAV_LINKS.filter(l => !PRIMARY.includes(l.path));
  readonly languages = SUPPORTED_LANGUAGES;
  currentLang: string;

  private readonly router = inject(Router);
  private readonly ngxTranslate = inject(TranslateService);

  constructor(private translateService: AppTranslateService) {
    this.currentLang = this.translateService.getCurrentLang();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void { this.isScrolled.set(window.scrollY > 24); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!(e.target as HTMLElement).closest('nav')) this.moreOpen.set(false);
  }

  /** client-side page search over the site's navigation (translated labels) */
  onSearch(e: Event): void {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    this.query.set(q);
    if (!q) { this.results.set([]); return; }
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    this.results.set(NAV_LINKS.filter(l => norm(this.ngxTranslate.instant(l.label)).includes(norm(q)) || l.path.includes(q)).slice(0, 6));
  }
  goFirst(): void { const r = this.results()[0]; if (r) this.go(r.path); }
  go(path: string): void { this.router.navigateByUrl(path); this.query.set(''); this.results.set([]); }
  closeSearchSoon(): void { setTimeout(() => this.results.set([]), 150); }

  onLang(e: Event): void {
    const lang = (e.target as HTMLSelectElement).value as 'fr' | 'en' | 'ar';
    this.translateService.switchLanguage(lang);
    this.currentLang = lang;
  }

  toggleMobileMenu(): void { this.mobileMenuToggled.emit(); }
}
