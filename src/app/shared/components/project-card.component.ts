import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <a
      [routerLink]="routerLink()"
      class="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
    >
      <!-- Image -->
      <div class="relative h-48 overflow-hidden">
        <img
          [src]="imageUrl()"
          [alt]="title()"
          class="w-full h-full object-cover"
          loading="lazy"
        />
        @if (category()) {
          <span class="absolute top-3 right-3 bg-blue-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {{ category() }}
          </span>
        }
      </div>

      <!-- Content -->
      <div class="p-5">
        <h3 class="text-xl font-bold text-gray-900 mb-2">{{ title() }}</h3>
        <div class="flex items-center gap-4 text-sm text-gray-500 mb-4">
          @if (location()) {
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ location() }}
            </span>
          }
          @if (year()) {
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ year() }}
            </span>
          }
        </div>
        <span
          class="inline-block w-full text-center bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          {{ 'project_view' | translate }}
        </span>
      </div>
    </a>
  `
})
export class ProjectCardComponent {
  readonly title = input.required<string>();
  readonly location = input<string>('');
  readonly year = input<string>('');
  readonly category = input<string>('');
  readonly imageUrl = input<string>(DEFAULT_IMAGE);
  readonly routerLink = input<string>('');
}
