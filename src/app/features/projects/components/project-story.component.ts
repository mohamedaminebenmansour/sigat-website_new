import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Project } from '../../../core/models/project.model';
import { ProjectGalleryComponent } from './project-gallery.component';

const COLLAPSED_ITEMS = 3;

@Component({
  selector: 'app-project-story',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ProjectGalleryComponent],
  template: `
    <section class="bg-white py-12 md:py-20">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 gap-10 lg:grid-cols-[55%_45%] lg:gap-12">
          <!-- ============ Content ============ -->
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">
              {{ 'project_overview' | translate }}
            </p>
            <p class="mt-3 text-lg leading-relaxed text-gray-600">
              {{ overview() | translate }}
            </p>

            @if (challenge()) {
              <div class="mt-12">
                <h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
                  {{ 'project_challenge' | translate }}
                </h2>
                <span class="mt-3 block h-1 w-16 rounded-full bg-orange-500"></span>
                <p class="mt-4 text-base leading-relaxed text-gray-600">
                  {{ challenge() | translate }}
                </p>
              </div>
            }

            @if (executionScope().length > 0) {
              <div class="mt-12">
                <h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
                  {{ 'project_execution' | translate }}
                </h2>
                <span class="mt-3 block h-1 w-16 rounded-full bg-orange-500"></span>
                <ul class="mt-5 space-y-3">
                  @for (key of visibleExecution(); track $index) {
                    <li class="flex items-start gap-3 text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg"
                           class="mt-1 h-4 w-4 flex-shrink-0 text-orange-500"
                           fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clip-rule="evenodd" />
                      </svg>
                      <span>{{ key | translate }}</span>
                    </li>
                  }
                </ul>
                @if (executionScope().length > collapsedCount) {
                  <button
                    type="button"
                    (click)="toggleExecution()"
                    [attr.aria-expanded]="executionExpanded()"
                    class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:text-blue-700"
                  >
                    {{ (executionExpanded() ? 'project_show_less' : 'project_read_more') | translate }}
                  </button>
                }
              </div>
            }

            @if (equipmentKeys().length > 0) {
              <div class="mt-12">
                <h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
                  {{ 'project_equipment' | translate }}
                </h2>
                <span class="mt-3 block h-1 w-16 rounded-full bg-orange-500"></span>
                <ul class="mt-5 space-y-3">
                  @for (key of visibleEquipment(); track $index) {
                    <li class="flex items-start gap-3 text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg"
                           class="mt-1 h-4 w-4 flex-shrink-0 text-blue-900"
                           fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clip-rule="evenodd" />
                      </svg>
                      <span>{{ key | translate }}</span>
                    </li>
                  }
                </ul>
                @if (equipmentKeys().length > collapsedCount) {
                  <button
                    type="button"
                    (click)="toggleEquipment()"
                    [attr.aria-expanded]="equipmentExpanded()"
                    class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:text-blue-700"
                  >
                    {{ (equipmentExpanded() ? 'project_show_less' : 'project_read_more') | translate }}
                  </button>
                }
              </div>
            }
          </div>

          <!-- ============ Gallery ============ -->
          <div class="min-w-0 self-start lg:sticky lg:top-24">
            @if (gallery().length > 0) {
              <app-project-gallery
                [images]="gallery()"
                [altText]="project().title"
              />
              <p class="mt-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                {{ 'project_gallery' | translate }}
              </p>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ProjectStoryComponent {
  readonly project = input.required<Project>();

  protected readonly collapsedCount = COLLAPSED_ITEMS;

  readonly overview = computed(
    () => this.project().content?.overviewKey ?? this.project().description,
  );
  readonly challenge = computed(
    () => this.project().content?.challengeKey ?? '',
  );
  readonly executionScope = computed(
    () => this.project().content?.executionScopeKeys ?? [],
  );
  readonly equipmentKeys = computed(
    () => this.project().content?.equipmentKeys ?? [],
  );
  readonly gallery = computed(
    () => this.project().media?.gallery ?? this.project().galleryUrls,
  );

  protected readonly executionExpanded = signal(false);
  protected readonly equipmentExpanded = signal(false);

  protected readonly visibleExecution = computed(() => {
    const all = this.executionScope();
    return this.executionExpanded() ? all : all.slice(0, COLLAPSED_ITEMS);
  });

  protected readonly visibleEquipment = computed(() => {
    const all = this.equipmentKeys();
    return this.equipmentExpanded() ? all : all.slice(0, COLLAPSED_ITEMS);
  });

  protected toggleExecution(): void {
    this.executionExpanded.update(v => !v);
  }

  protected toggleEquipment(): void {
    this.equipmentExpanded.update(v => !v);
  }
}

