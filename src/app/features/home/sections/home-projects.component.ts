import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HxRevealDirective } from '../../../shared/hydro/hx-reveal.directive';

/**
 * CHAPTER 05 — LES RÉALISATIONS
 * Where the water arrives. Field photos only (local assets); hovering a card
 * floods it from below and the project details float up on the water.
 */
@Component({
  selector: 'app-home-projects',
  standalone: true,
  imports: [RouterLink, TranslatePipe, HxRevealDirective],
  template: `
    <section class="hx-ch hx-ch--white hx-ch--arrive" id="ch-projects" data-chapter="05">
      <div class="hx-container">
        <header class="hx-head hx-head--split hx-reveal" hxReveal>
          <div>
            <p class="hx-eyebrow">{{ 'hx_proj_kicker' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'hx_proj_title' | translate }}</h2>
          </div>
          <a routerLink="/projects" class="hx-link">
            {{ 'hx_proj_all' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
        </header>

        <div class="hx-proj">
          @for (p of projects; track p.key; let i = $index) {
            <a class="hx-proj__card hx-reveal" hxReveal [routerLink]="p.route" [style.--d]="i * 110 + 'ms'">
              <img [src]="p.img + '-1280.webp'" [attr.srcset]="p.img + '-768.webp 768w, ' + p.img + '-1280.webp 1280w'"
                   sizes="(min-width: 1024px) 50vw, 100vw" [alt]="'hx_proj_' + p.key + '_title' | translate"
                   loading="lazy" decoding="async" />
              <span class="hx-proj__water" aria-hidden="true">
                <svg viewBox="0 0 1200 40" preserveAspectRatio="none">
                  <path d="M0 20 C150 0 300 0 450 20 S750 40 900 20 S1050 0 1200 20 V40 H0Z" />
                </svg>
              </span>
              <span class="hx-proj__meta">
                <span class="hx-proj__tag">{{ 'hx_proj_' + p.key + '_tag' | translate }} · {{ p.year }}</span>
                <h3>{{ 'hx_proj_' + p.key + '_title' | translate }}</h3>
                <span class="hx-proj__desc">{{ 'hx_proj_' + p.key + '_desc' | translate }}</span>
              </span>
            </a>
          }
        </div>
      </div>
    </section>
  `
})
export class HomeProjectsComponent {
  readonly projects = [
    { key: '1', img: 'assets/media/projects/aep-ouled-khalfallah/cover', year: '2023', route: '/projects/1' },
    { key: '2', img: 'assets/media/gallery/20231222-pipeline', year: '2023', route: '/projects/2' },
    { key: '3', img: 'assets/media/gallery/20240428-station', year: '2024', route: '/projects/3' },
    { key: '4', img: 'assets/media/gallery/20230618-riprap', year: '2023', route: '/projects/6' }
  ];
}
