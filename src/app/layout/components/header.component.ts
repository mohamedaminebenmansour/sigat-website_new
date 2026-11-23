import { Component, ElementRef, HostListener, ViewChild, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppTranslateService } from '../../core/services/translate.service';
import { NAV_LINKS, SUPPORTED_LANGUAGES } from '../../core/navigation/navigation.service';
import { SearchHit, SearchKind, SiteSearchService, norm } from '../../core/search/site-search.service';

/** Primary links shown in the bar; the rest live under "Plus" and in the mobile menu. */
const PRIMARY = ['/home', '/about', '/expertise', '/projects', '/contact'];
const MORE_ICON: Record<string, string> = { '/hse': 'fa-helmet-safety', '/partnerships': 'fa-handshake', '/careers': 'fa-user-plus', '/capabilities': 'fa-truck-monster', '/media': 'fa-photo-film' };

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  styles: [`
    .sky { background: linear-gradient(180deg, #1565d8 0%, #2f8de8 55%, #6cc0f5 100%); }
    .nl { position: relative; }
    .nl::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 4px; height: 2px; background: #fff;
                 transform: scaleX(0); transition: transform .25s; }
    .nl:hover::after, .nl.active::after, .nl[aria-expanded="true"]::after { transform: scaleX(1); }
  `],
  template: `
    <header class="sky fixed inset-x-0 top-0 z-50 overflow-visible shadow-lg shadow-blue-950/25 transition-[height] duration-300"
            [style.height.px]="isScrolled() ? 64 : 74">
      <div class="container relative mx-auto flex h-full items-center gap-6 px-4">
        <a routerLink="/home" aria-label="SIGAT" class="shrink-0 drop-shadow">
          <img src="assets/media/logo/sigatlogo-white-trim.png" alt="SIGAT — Société Internationale des Grands Travaux"
               class="block w-auto transition-[height] duration-300" [style.height.px]="isScrolled() ? 46 : 56" />
        </a>

        <nav class="ml-auto hidden items-center gap-1 lg:flex">
          @for (link of primary; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="active"
               class="nl rounded-lg px-3 py-2 font-serif text-[16px] text-white">{{ link.label | translate }}</a>
          }
          <div class="hd-more-wrap">
            <button type="button" (click)="moreOpen.set(!moreOpen())" [attr.aria-expanded]="moreOpen()" aria-haspopup="true"
                    class="nl rounded-lg px-3 py-2 font-serif text-[16px] text-white">
              {{ 'nav_more' | translate }} <i class="fa-solid fa-chevron-down hd-more__chev" [class.is-up]="moreOpen()" aria-hidden="true"></i>
            </button>
            <div class="hd-panel hd-more" [class.is-open]="moreOpen()" role="menu">
              @for (link of secondary; track link.path) {
                <a [routerLink]="link.path" routerLinkActive="is-active" (click)="moreOpen.set(false)" class="hd-more__link" role="menuitem" [tabindex]="moreOpen() ? 0 : -1">
                  <span class="hd-ico"><i class="fa-solid {{ moreIcon(link.path) }}" aria-hidden="true"></i></span>
                  <span class="hd-more__label">{{ link.label | translate }}</span>
                  <span class="hd-drop" aria-hidden="true"></span>
                </a>
              }
            </div>
          </div>
        </nav>

        <!-- site search + language -->
        <div class="hd-search hidden lg:flex" [class.is-focus]="focused()">
          <i class="fa-solid fa-magnifying-glass hd-search__ico" aria-hidden="true"></i>
          <input #box type="search" [placeholder]="'nav_search' | translate" [attr.aria-label]="'nav_search' | translate"
                 role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" aria-controls="hd-results"
                 [attr.aria-activedescendant]="open() && active() >= 0 ? 'hd-r-' + active() : null"
                 [value]="query()" (input)="onSearch($event)" (keydown)="onKey($event)" (focus)="focused.set(true)" (blur)="onBlur()">
          @if (!query()) { <kbd class="hd-kbd" aria-hidden="true">/</kbd> }
          <select class="hd-lang" [attr.aria-label]="'nav_language' | translate" (change)="onLang($event)">
            @for (lang of languages; track lang.code) { <option [value]="lang.code" [selected]="lang.code === currentLang">{{ lang.label }}</option> }
          </select>

          @if (open()) {
            <div id="hd-results" class="hd-panel hd-results is-open" role="listbox">
              @if (hits().length) {
                @for (g of groups(); track g.kind) {
                  <p class="hd-group">{{ 'search_' + g.kind | translate }}</p>
                  @for (h of g.items; track h.hit.path + h.hit.title) {
                    <a [id]="'hd-r-' + h.i" role="option" [attr.aria-selected]="h.i === active()" class="hd-hit" [class.is-active]="h.i === active()"
                       [routerLink]="h.hit.path" [queryParams]="h.hit.query ?? null" (mousedown)="$event.preventDefault()" (click)="pick(h.hit)" (mouseenter)="active.set(h.i)">
                      <span class="hd-ico"><i class="fa-solid {{ h.hit.icon }}" aria-hidden="true"></i></span>
                      <span class="hd-hit__txt">
                        <span class="hd-hit__t">@for (part of mark(h.hit.title); track $index) { @if (part.m) { <mark>{{ part.t }}</mark> } @else { {{ part.t }} } }</span>
                        @if (h.hit.sub) { <span class="hd-hit__s">{{ h.hit.sub }}</span> }
                      </span>
                      <i class="fa-solid fa-arrow-right hd-hit__go" aria-hidden="true"></i>
                    </a>
                  }
                }
                <p class="hd-hint" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> {{ 'search_hint_nav' | translate }} · <kbd>↵</kbd> {{ 'search_hint_open' | translate }} · <kbd>Esc</kbd></p>
              } @else {
                <div class="hd-none">
                  <p>{{ 'search_none' | translate }} « {{ query() }} »</p>
                  <a routerLink="/contact" (mousedown)="$event.preventDefault()" (click)="pick(null)" class="hd-none__cta">{{ 'search_none_cta' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                </div>
              }
            </div>
          }
        </div>

        <button class="ml-auto rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" (click)="toggleMobileMenu()" aria-label="Toggle menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  `
})
export class HeaderComponent {
  readonly mobileMenuToggled = output<void>();
  readonly isScrolled = signal(false);
  readonly moreOpen = signal(false);
  readonly query = signal('');
  readonly focused = signal(false);
  readonly hits = signal<SearchHit[]>([]);
  readonly active = signal(-1);
  readonly open = computed(() => this.focused() && this.query().trim().length > 1);
  /** hits grouped by kind, each keeping its flat index for keyboard navigation */
  readonly groups = computed(() => {
    const out: { kind: SearchKind; items: { hit: SearchHit; i: number }[] }[] = [];
    this.hits().forEach((hit, i) => {
      let g = out.find(x => x.kind === hit.kind);
      if (!g) out.push(g = { kind: hit.kind, items: [] });
      g.items.push({ hit, i });
    });
    return out;
  });
  readonly primary = NAV_LINKS.filter(l => PRIMARY.includes(l.path));
  readonly secondary = NAV_LINKS.filter(l => !PRIMARY.includes(l.path));
  readonly languages = SUPPORTED_LANGUAGES;
  currentLang: string;
  @ViewChild('box') box?: ElementRef<HTMLInputElement>;

  private readonly router = inject(Router);
  private readonly search = inject(SiteSearchService);
  private readonly translateService = inject(AppTranslateService);

  constructor() { this.currentLang = this.translateService.getCurrentLang(); }

  moreIcon(path: string): string { return MORE_ICON[path] ?? 'fa-circle'; }

  @HostListener('window:scroll', [])
  onWindowScroll(): void { this.isScrolled.set(window.scrollY > 24); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!(e.target as HTMLElement).closest('.hd-more-wrap')) this.moreOpen.set(false);
  }

  /** "/" focuses the search (unless typing in a field); Esc closes the "Plus" menu */
  @HostListener('document:keydown', ['$event'])
  onDocKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !(e.target as HTMLElement).isContentEditable) {
      e.preventDefault(); this.box?.nativeElement.focus();
    }
    if (e.key === 'Escape') this.moreOpen.set(false);
  }

  onSearch(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    this.query.set(q);
    const hits = q.trim().length > 1 ? this.search.search(q) : [];
    this.hits.set(hits);
    this.active.set(hits.length ? 0 : -1);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.hits().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.active.set((this.active() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.active.set((this.active() - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = this.hits()[this.active()]; if (h) this.pick(h); }
    else if (e.key === 'Escape') { this.clear(); this.box?.nativeElement.blur(); }
  }

  pick(h: SearchHit | null): void {
    if (h) this.router.navigate([h.path], { queryParams: h.query ?? {} });
    this.clear();
    this.box?.nativeElement.blur();
  }

  onBlur(): void { setTimeout(() => this.focused.set(false), 120); }

  private clear(): void { this.query.set(''); this.hits.set([]); this.active.set(-1); if (this.box) this.box.nativeElement.value = ''; }

  /** split a title around the first query word it contains (accent-insensitive), for highlighting */
  mark(title: string): { t: string; m: boolean }[] {
    const n = norm(title);
    for (const w of norm(this.query()).split(/\s+/).filter(Boolean)) {
      const i = n.indexOf(w);
      if (i >= 0) return [{ t: title.slice(0, i), m: false }, { t: title.slice(i, i + w.length), m: true }, { t: title.slice(i + w.length), m: false }].filter(p => p.t);
    }
    return [{ t: title, m: false }];
  }

  onLang(e: Event): void {
    const lang = (e.target as HTMLSelectElement).value as 'fr' | 'en' | 'ar';
    this.translateService.switchLanguage(lang);
    this.currentLang = lang;
  }

  toggleMobileMenu(): void { this.mobileMenuToggled.emit(); }
}
