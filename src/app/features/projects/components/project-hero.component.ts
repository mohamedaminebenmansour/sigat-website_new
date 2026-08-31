import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  IMAGE_LOADER,
  ImageLoader,
  ImageLoaderConfig,
  NgOptimizedImage,
} from '@angular/common';

const SRCSET = '768w, 1280w';
const SIZES = '(min-width: 1280px) 1600px, 100vw';

/** XX.webp -> XX-768.webp / -1280.webp (matches existing project assets). */
const responsiveWebpLoader: ImageLoader = (config: ImageLoaderConfig): string =>
  config.isPlaceholder || !config.width
    ? config.src
    : config.src.replace(/\.webp$/i, `-${config.width}.webp`);

/** Minimal shape the hero needs from a project. */
export interface ProjectHeroData {
  title: string;
  location: string;
  category: string;
  startDate?: string;
  endDate?: string;
  year?: string;
  cover: string;
}

@Component({
  selector: 'app-project-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, NgOptimizedImage],
  providers: [{ provide: IMAGE_LOADER, useValue: responsiveWebpLoader }],
  template: `
    <section class="relative min-h-[30rem] md:min-h-[38rem] lg:h-[68vh] overflow-hidden bg-blue-950">
      <!-- Static, engineering-focused cover (not an animated stack). -->
      <img
        class="absolute inset-0 h-full w-full object-cover"
        [ngSrc]="project().cover"
        [ngSrcset]="srcset"
        [sizes]="sizes"
        fill
        priority
        [alt]="project().title"
      />
      <!-- Controlled gradient: readable text while keeping the photo strong. -->
      <div class="absolute inset-0 bg-gradient-to-t from-blue-950/95 via-blue-950/55 to-blue-950/20"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-blue-950/50 to-transparent"></div>

      <div class="absolute inset-x-0 top-0 z-10">
        <div class="container mx-auto px-4 pt-24 md:pt-28">
          <a
            routerLink="/projects"
            class="inline-flex items-center gap-2 rounded-md text-sm font-medium text-white/85 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rtl:-scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ 'project_back' | translate }}
          </a>
        </div>
      </div>

      <div class="absolute inset-x-0 bottom-0 z-10">
        <div class="container mx-auto px-4 pb-10 md:pb-14">
          <div class="max-w-3xl">
            <span class="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white">
              {{ categoryKey() | translate }}
            </span>
            <h1 class="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              {{ project().title }}
            </h1>
            <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
              <span class="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ project().location }}
              </span>
              <span class="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ period() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ProjectHeroComponent {
  readonly project = input.required<ProjectHeroData>();

  readonly srcset = SRCSET;
  readonly sizes = SIZES;

  /** Category -> localized label key (project_category_<slug>). */
  readonly categoryKey = computed(() => `project_category_${this.project().category}`);

  /** '2021 – 2023' (start–end). Falls back to year only. */
  readonly period = computed(() => {
    const p = this.project();
    const start = p.startDate ?? p.year ?? '';
    const end = p.endDate ?? '';
    return end && end !== start ? `${start} – ${end}` : start;
  });
}