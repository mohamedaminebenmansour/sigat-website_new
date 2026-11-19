import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { MobileMenuComponent } from './components/mobile-menu.component';
import { HxFlowTransitionComponent } from '../shared/hydro/hx-flow-transition.component';

/**
 * Colour of each page's last section. The footer's glass pipe is drawn on
 * top of it, so the page flows straight into the footer water.
 */
const LAST_SECTION_COLOR: Record<string, string> = {
  '/home': '#0b4c91' // home ends in the tap's pool
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, MobileMenuComponent, HxFlowTransitionComponent],
  template: `
    <div class="flex flex-col min-h-screen">
      <app-header (mobileMenuToggled)="toggleMobileMenu()" />
      <app-mobile-menu [isOpen]="mobileMenuOpen()" (close)="closeMobileMenu()" />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-footer [above]="footerAbove()" />
    </div>
    <!-- Water curtain played between pages (see hx-flow-transition). -->
    <app-hx-flow-transition />
  `
})
export class MainLayoutComponent {
  readonly mobileMenuOpen = signal(false);
  readonly footerAbove = signal('#ffffff');

  constructor() {
    const router = inject(Router);
    const update = () => {
      const path = router.url.split(/[?#]/)[0];
      // project detail pages end on the dark call-to-action band
      const color = LAST_SECTION_COLOR[path] ?? (/^\/projects\/\d+$/.test(path) ? '#04294f' : '#ffffff');
      this.footerAbove.set(color);
    };
    update();
    router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(update);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(value => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
