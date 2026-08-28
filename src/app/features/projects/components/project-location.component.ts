import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ProjectGeo } from '../../../core/models/project.model';

const MAP_DELTA = 0.02;

@Component({
  selector: 'app-project-location',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section class="bg-gray-50 py-14 md:py-20">
      <div class="container mx-auto px-4">
        <div
          class="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[38%_62%] lg:items-stretch"
        >
          <div class="flex flex-col justify-center rounded-xl border border-gray-200 bg-white p-8">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">
              {{ 'project_location_title' | translate }}
            </p>
            <h3 class="mt-3 text-2xl font-bold text-gray-900">
              {{ geo().name }}
            </h3>
            @if (hasCoordinates()) {
              <p class="mt-2 text-sm text-gray-500">
                {{ geo().latitude?.toFixed(4) }}, {{ geo().longitude?.toFixed(4) }}
              </p>
            }
            @if (hasCoordinates()) {
              <a
                [href]="mapsUrl()"
                target="_blank"
                rel="noopener"
                class="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                {{ 'project_open_map' | translate }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            }
          </div>

          <div class="relative min-h-[16rem] overflow-hidden rounded-xl border border-gray-200">
            @if (hasCoordinates()) {
              <iframe
                [src]="embedUrl()"
                class="absolute inset-0 h-full w-full"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                [title]="geo().name"
              ></iframe>
            } @else {
              <div class="flex h-full min-h-[16rem] items-center justify-center bg-gray-100 text-sm text-gray-400">
                {{ geo().name }}
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ProjectLocationComponent {
  readonly geo = input.required<ProjectGeo>();

  protected readonly hasCoordinates = computed(
    () =>
      this.geo().latitude !== undefined &&
      this.geo().longitude !== undefined,
  );

  protected readonly embedUrl = computed(() => {
    const g = this.geo();
    const lat = g.latitude!;
    const lon = g.longitude!;
    const p = MAP_DELTA;
    const l = lon - p,
      r = lon + p,
      b = lat - p,
      t = lat + p;
    return (
      `https://www.openstreetmap.org/export/embed.html?` +
      `bbox=${encodeURIComponent(`${l},${b},${r},${t}`)}&layer=mapnik&marker=${lat},${lon}`
    );
  });

  protected readonly mapsUrl = computed(() => {
    const g = this.geo();
    return `https://www.google.com/maps?q=${g.latitude!},${g.longitude!}`;
  });
}