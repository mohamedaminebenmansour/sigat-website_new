import { Component, input } from '@angular/core';
import { COMPANY_INFO, COMPANY_MAILTO, COMPANY_TEL } from '../../core/company/company-info';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NAV_LINKS } from '../../core/navigation/navigation.service';
import { FollowUsComponent } from '../../shared/components/follow-us.component';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe, FollowUsComponent, WavePipeComponent],
  styles: [`
    .water { background: linear-gradient(180deg, #c9eefc 0%, #a6e0f8 45%, #86d0f4 100%); }
    .water::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .55;
      background: radial-gradient(1200px 120px at 20% 22%, rgba(255,255,255,.7), transparent 70%),
                  radial-gradient(900px 160px at 80% 55%, rgba(255,255,255,.55), transparent 70%);
      animation: shimmer 9s ease-in-out infinite alternate; }
    @keyframes shimmer { from { transform: translateX(-3%); } to { transform: translateX(3%); } }
    @media (prefers-reduced-motion: reduce) { .water::before { animation: none; } }
  `],
  template: `
    <footer class="water relative overflow-hidden text-blue-950">
      <!-- fillAbove = colour of the page's last section, so the pipe sits on it -->
      @for (c of [above()]; track c) {
        <app-wave-pipe [height]="120" [amplitude]="36" [phase]="2.2" [speed]="-70" [fillAbove]="c" />
      }

      <div class="container relative mx-auto px-4">
        <!-- CTA band -->
        <div class="flex flex-col items-center justify-between gap-4 border-y-[3px] border-blue-950 px-1.5 py-5 text-center md:flex-row md:text-left">
          <div>
            <b class="block font-serif text-xl md:text-2xl">{{ 'footer_cta_title' | translate }}</b>
            <span class="text-sm text-blue-950/85">{{ 'footer_cta_text' | translate }}</span>
          </div>
          <a routerLink="/contact" class="shrink-0 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600">
            {{ 'footer_cta_btn' | translate }}
          </a>
        </div>

        <div class="grid gap-10 py-10 lg:grid-cols-[1.05fr_0.9fr_1.35fr]">
          <!-- brand + contact block -->
          <div>
            <a routerLink="/home" aria-label="SIGAT" class="inline-block">
              <img src="assets/media/logo/sigatlogo-trim.png" alt="SIGAT — Société Internationale des Grands Travaux" class="block h-16 w-auto" />
            </a>
            <p class="mt-4 max-w-sm text-sm leading-relaxed text-blue-950/85">{{ 'footer_company_desc' | translate }}</p>
            <ul class="mt-5 space-y-2.5 text-sm">
              <li class="flex gap-3"><i class="fa-solid fa-location-dot mt-0.5 w-4 text-blue-700"></i><a [href]="info.mapsUrl" target="_blank" rel="noopener noreferrer" class="hover:text-blue-700">{{ info.address }}</a></li>
              @if (tel) { <li class="flex gap-3"><i class="fa-solid fa-phone mt-0.5 w-4 text-blue-700"></i><a [href]="tel" class="hover:text-blue-700" dir="ltr">{{ info.phone }}</a></li> }
              <li class="flex gap-3"><i class="fa-regular fa-envelope mt-0.5 w-4 text-blue-700"></i><a [href]="mailto" class="hover:text-blue-700">{{ info.email }}</a></li>
            </ul>
          </div>

          <!-- link columns -->
          <div class="grid grid-cols-2 gap-6">
            <div>
              <h3 class="mb-3 font-serif text-lg font-bold">{{ 'footer_col_company' | translate }}</h3>
              <ul class="space-y-2 text-sm">
                @for (l of colA; track l.path) { <li><a [routerLink]="l.path" class="transition-colors hover:text-blue-700">{{ l.label | translate }}</a></li> }
              </ul>
            </div>
            <div>
              <h3 class="mb-3 font-serif text-lg font-bold">{{ 'footer_col_services' | translate }}</h3>
              <ul class="space-y-2 text-sm">
                @for (l of colB; track l.path) { <li><a [routerLink]="l.path" class="transition-colors hover:text-blue-700">{{ l.label | translate }}</a></li> }
              </ul>
            </div>
          </div>

          <!-- Follow us -->
          <app-follow-us [compact]="true" />
        </div>
      </div>

      <div class="relative border-t-[3px] border-blue-950 py-3 text-center text-xs text-blue-950/90">
        <span>© {{ year }} SIGAT – Société Internationale des Grands Travaux. {{ 'footer_rights' | translate }}</span>
        <span class="mx-2" aria-hidden="true">·</span><a routerLink="/legal" class="hover:text-blue-700 underline-offset-2 hover:underline">{{ 'footer_legal' | translate }}</a>
        <span class="mx-2" aria-hidden="true">·</span><a routerLink="/legal" fragment="privacy" class="hover:text-blue-700 underline-offset-2 hover:underline">{{ 'footer_privacy' | translate }}</a>
      </div>
    </footer>
  `
})
export class FooterComponent {
  /** Background of the section right above the footer. */
  readonly above = input('#ffffff');
  readonly info = COMPANY_INFO;
  readonly tel = COMPANY_TEL;
  readonly mailto = COMPANY_MAILTO;
  readonly colA = NAV_LINKS.filter(l => ['/home', '/about', '/projects', '/contact'].includes(l.path));
  readonly colB = NAV_LINKS.filter(l => !['/home', '/about', '/projects', '/contact'].includes(l.path));
  readonly year = new Date().getFullYear();
}
