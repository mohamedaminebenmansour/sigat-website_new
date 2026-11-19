import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Project } from '../../../core/models/project.model';

/**
 * PROJECT HERO — the project seen inside the pipe.
 *
 * A PE100 main in perspective (blue stripes = drinking water) opens toward
 * the visitor; its bore frames the project's own site photo. Water runs
 * along the invert, drops fall from the lip, and the pipe wall carries a
 * real-style factory marking (material · SDR · PN · year), as printed on
 * every pipe SIGAT lays. Continues the sky + pipe of the Projects page.
 */
@Component({
  selector: 'app-project-pipe-hero',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="pd-hero">
      <div class="hx-container pd-hero__grid">
        <div class="pd-hero__copy">
          <a routerLink="/projects" class="pd-back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> {{ 'project_back_all' | translate }}</a>
          <p class="pd-chip">{{ 'project_category_' + p().category | translate }} · {{ period() }}</p>
          <h1 class="hx-display">{{ p().title }}</h1>
          <p class="pd-hero__loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> {{ p().location }}</p>
        </div>

        <div class="pd-pipe" aria-hidden="true">
          <svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="pdBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#11161c" /><stop offset=".26" stop-color="#4c5a68" /><stop offset=".4" stop-color="#252e37" />
                <stop offset=".86" stop-color="#0b0f13" /><stop offset="1" stop-color="#1b232b" />
              </linearGradient>
              <clipPath id="pdBore"><ellipse cx="190" cy="210" rx="100" ry="172" /></clipPath>
              <linearGradient id="pdWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#8fd8ff" stop-opacity=".9" /><stop offset="1" stop-color="#1565c0" stop-opacity=".95" />
              </linearGradient>
            </defs>
            <!-- body running away to the right -->
            <rect x="190" y="20" width="470" height="380" fill="url(#pdBody)" />
            <path d="M190 72 H660 M190 348 H660" stroke="#2f8fe0" stroke-width="7" />
            <text x="330" y="122" class="pd-mark">SIGAT · PE100 · SDR17 · PN10 · {{ p().year }} · EAU POTABLE</text>
            <!-- electrofusion coupler -->
            <rect x="470" y="14" width="58" height="392" fill="rgba(255,255,255,.07)" />
            <rect x="490" y="14" width="10" height="26" fill="#ff7a1a" />
            <!-- wall + bore -->
            <ellipse cx="190" cy="210" rx="118" ry="192" fill="#2c3641" />
            <ellipse cx="190" cy="210" rx="100" ry="172" fill="#05080b" />
            <g clip-path="url(#pdBore)">
              <image class="pd-pipe__img" [attr.href]="cover()" x="70" y="30" width="240" height="360" preserveAspectRatio="xMidYMid slice" />
              <!-- water along the invert, flowing toward us -->
              <path class="pd-pipe__water" d="M60 338 C110 330 150 346 200 338 S270 330 330 338 V400 H60Z" fill="url(#pdWater)" />
              <path class="pd-pipe__streak" d="M90 352 H300 M110 366 H290" />
              <ellipse cx="190" cy="210" rx="100" ry="172" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="18" />
            </g>
            <path d="M100 120 A100 172 0 0 1 150 52" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round" />
            <!-- drops leaving the lip -->
            <g class="pd-pipe__drops">
              <path d="M178 404 c3 4 5 7 5 9 a5 5 0 0 1 -10 0 c0 -2 2 -5 5 -9z" />
              <path d="M205 402 c3 4 5 7 5 9 a5 5 0 0 1 -10 0 c0 -2 2 -5 5 -9z" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  `
})
export class ProjectPipeHeroComponent {
  readonly p = input.required<Project>();
  readonly cover = computed(() => this.p().media?.cover ?? this.p().imageUrl);
  readonly period = computed(() => {
    const p = this.p();
    return p.startDate && p.endDate && p.startDate !== p.endDate ? `${p.startDate} – ${p.endDate}` : p.year;
  });
}
