import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { MobileMenuComponent } from './components/mobile-menu.component';
import { WaterStatsBandComponent } from '../shared/components/water-stats-band/water-stats-band.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, MobileMenuComponent, WaterStatsBandComponent],
  template: `
    <div class="flex flex-col min-h-screen">
      <app-header (mobileMenuToggled)="toggleMobileMenu()" />
      <app-mobile-menu [isOpen]="mobileMenuOpen()" (close)="closeMobileMenu()" />
      <main class="flex-1">
        <router-outlet />
      </main>
      <!-- Organic water transition between the last content section and
           the footer (same reusable band, compact "footer" variant). -->
      <app-water-stats-band variant="footer" />
      <app-footer />
    </div>
  `
})
export class MainLayoutComponent {
  readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(value => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
