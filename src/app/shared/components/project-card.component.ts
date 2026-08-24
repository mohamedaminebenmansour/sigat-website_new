import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  styles: [
    `
      :host {
        display: block;
      }

      /* Editorial "Voir le projet" link — the whole card is the RouterLink,
         so this stays a non-anchor span. The arrow mirrors automatically in RTL. */
      .project-card-link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .project-card-arrow {
        transition: transform 0.3s ease-out;
      }

      .group:hover .project-card-arrow {
        transform: translateX(3px);
      }

      :host-context([dir='rtl']) .project-card-arrow {
        transform: scaleX(-1);
      }

      :host-context([dir='rtl']) .group:hover .project-card-arrow {
        transform: scaleX(-1) translateX(3px);
      }

      @media (prefers-reduced-motion: reduce) {
        .project-card img,
        .project-card-overlay,
        .project-card-arrow {
          transition: none !important;
        }
        .group:hover .project-card img {
          transform: none !important;
        }
        .group:hover .project-card-arrow {
          transform: none;
        }
      }
    `
  ],
  template: `
    <a
      [routerLink]="routerLink()"
      class="group project-card relative block aspect-[4/3] overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer"
    >
      <!-- Project photograph fills the entire card -->
      <img
        [src]="imageUrl()"
        [alt]="title()"
        loading="lazy"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />

      <!-- Subtle editorial gradient: transparent top -> darker blue bottom -->
      <div
        class="project-card-overlay absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/35 to-transparent transition-opacity duration-300 group-hover:opacity-95"
        aria-hidden="true"
      ></div>

      @if (category()) {
        <span
          class="absolute top-4 right-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/90 border border-white/40 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm"
        >
          {{ category() }}
        </span>
      }

      <!-- Content anchored to the bottom of the image -->
      <div class="absolute inset-x-0 bottom-0 p-5 md:p-6 text-white">
        <h3 class="text-lg md:text-xl font-bold leading-snug line-clamp-2">
          {{ title() }}
        </h3>

        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/80">
          @if (location()) {
            <span class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ location() }}
            </span>
          }
          @if (year()) {
            <span class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {{ year() }}
            </span>
          }
        </div>

        @if (description()) {
          <p class="mt-2 text-sm leading-relaxed text-white/85 line-clamp-2">
            {{ description() }}
          </p>
        }

        <span class="project-card-link mt-3 text-sm text-white/95">
          {{ 'project_view' | translate }}
          <svg xmlns="http://www.w3.org/2000/svg" class="project-card-arrow h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </a>
  `
})
export class ProjectCardComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly location = input<string>('');
  readonly year = input<string>('');
  readonly category = input<string>('');
  readonly imageUrl = input<string>(DEFAULT_IMAGE);
  readonly routerLink = input<string>('');
}
