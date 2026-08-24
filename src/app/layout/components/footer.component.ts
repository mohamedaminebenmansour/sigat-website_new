import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="bg-blue-950 text-gray-300">
      <div class="container mx-auto px-4 py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Company Info -->
          <div>
            <h3 class="text-white text-lg font-bold mb-4">{{ 'footer_company_name' | translate }}</h3>
            <p class="text-sm leading-relaxed">
              {{ 'footer_company_desc' | translate }}
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="text-white text-lg font-bold mb-4">{{ 'nav_quick_links' | translate }}</h3>
            <ul class="space-y-2">
              <li>
                <a routerLink="/home" class="text-sm hover:text-blue-400 transition-colors">{{ 'nav_home' | translate }}</a>
              </li>
              <li>
                <a routerLink="/about" class="text-sm hover:text-blue-400 transition-colors">{{ 'nav_about' | translate }}</a>
              </li>
              <li>
                <a routerLink="/expertise" class="text-sm hover:text-blue-400 transition-colors">{{ 'nav_expertise' | translate }}</a>
              </li>
              <li>
                <a routerLink="/projects" class="text-sm hover:text-blue-400 transition-colors">{{ 'nav_projects' | translate }}</a>
              </li>
              <li>
                <a routerLink="/contact" class="text-sm hover:text-blue-400 transition-colors">{{ 'nav_contact' | translate }}</a>
              </li>
            </ul>
          </div>

          <!-- Contact Info -->
          <div>
            <h3 class="text-white text-lg font-bold mb-4">{{ 'nav_contact' | translate }}</h3>
            <ul class="space-y-3 text-sm">
              <li class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{{ 'footer_address' | translate }}</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{{ 'footer_email' | translate }}</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{{ 'footer_phone' | translate }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-blue-800">
        <div class="container mx-auto px-4 py-4">
          <p class="text-center text-xs text-gray-500">
            {{ 'footer_copyright' | translate }}
          </p>
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {}
