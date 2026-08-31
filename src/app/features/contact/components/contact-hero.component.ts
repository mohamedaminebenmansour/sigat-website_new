import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-hero',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="relative min-h-[50vh] md:min-h-[60vh] flex items-center bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80');">
      <div class="absolute inset-0 bg-gradient-to-b from-blue-950/85 via-blue-900/70 to-blue-900/60"></div>
      <div class="relative z-10 container mx-auto px-4">
        <div class="max-w-3xl">
          <h1 class="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {{ 'contact_hero_title' | translate }}
          </h1>
          <p class="text-lg md:text-xl text-gray-200 mb-8 leading-relaxed max-w-2xl">
            {{ 'contact_hero_subtitle' | translate }}
          </p>
          <div class="flex flex-col sm:flex-row gap-4">
            <a routerLink="#project-inquiry" class="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-base">
              {{ 'contact_hero_btn_primary' | translate }}
            </a>
            <a routerLink="#contact-info" class="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-base border border-white/20">
              {{ 'contact_hero_btn_secondary' | translate }}
            </a>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ContactHeroComponent {}
