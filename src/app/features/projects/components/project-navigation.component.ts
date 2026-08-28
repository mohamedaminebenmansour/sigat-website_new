import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

export interface ProjectNavItem {
  id: number;
  title: string;
}

@Component({
  selector: 'app-project-navigation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="bg-white py-12 md:py-16">
      <div class="container mx-auto px-4">
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-4">
          @if (prev(); as prev) {
            <a
              [routerLink]="['/projects', prev.id]"
              class="group flex min-w-[10rem] max-w-[38%] flex-col rounded-lg p-2 transition-colors hover:bg-gray-50"
            >
              <span class="flex items-center gap-2 text-xs font-medium text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rtl:-scale-x-100 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                {{ 'project_prev' | translate }}
              </span>
              <span class="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">
                {{ prev.title }}
              </span>
            </a>
          } @else {
            <span></span>
          }

          <p class="whitespace-nowrap text-sm font-semibold text-gray-500">
            {{ projectLabel }}
          </p>

          @if (next(); as next) {
            <a
              [routerLink]="['/projects', next.id]"
              class="group flex min-w-[10rem] max-w-[38rem] flex-col items-end rounded-lg p-2 text-end transition-colors hover:bg-gray-50"
            >
              <span class="flex items-center gap-2 text-xs font-medium text-gray-500">
                {{ 'project_next' | translate }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rtl:-scale-x-100 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <span class="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">
                {{ next.title }}
              </span>
            </a>
          } @else {
            <span></span>
          }
        </div>
      </div>
    </section>
  `,
})
export class ProjectNavigationComponent {
  readonly prev = input<ProjectNavItem | null>(null);
  readonly next = input<ProjectNavItem | null>(null);
  readonly index = input<number>(0); // 1-based position
  readonly total = input<number>(0);

  protected get projectLabel(): string {
    return `${this.index()} / ${this.total()}`;
  }
}