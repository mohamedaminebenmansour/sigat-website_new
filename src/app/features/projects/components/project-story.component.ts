import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Project } from '../../../core/models/project.model';
import { ProjectGalleryComponent } from './project-gallery.component';

/** Story section identifiers (also used to build unique ARIA ids). */
type SectionKey = 'overview' | 'challenge' | 'execution' | 'equipment';

interface StorySection {
  key: SectionKey;
  labelKey: string;
  /** Translation keys for list-based sections; undefined for paragraphs. */
  itemKeys?: readonly string[];
}

const SECTION_LABEL_KEYS: Record<SectionKey, string> = {
  overview: 'project_overview',
  challenge: 'project_challenge',
  execution: 'project_execution',
  equipment: 'project_equipment',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Premium engineering case-study layout.
 *
 * Left column: accordion story sections (Overview, Challenge, Execution
 * Scope, Equipment). Only one section can be open at a time. The first
 * section is open by default. Disclosure state is a single signal holding
 * the currently open section key (or null when all are closed).
 *
 * Right column: the stacked editorial gallery (desktop only layout; it
 * stacks below the story on tablet/mobile).
 */

@Component({
  selector: 'app-project-story',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ProjectGalleryComponent],
  styles: [
    `
      @keyframes story-item-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: none; }
      }
      .story-item-in {
        animation: story-item-in 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @media (prefers-reduced-motion: reduce) {
        .story-item-in { animation: none; }
        .story-grid { transition: none; }
      }
    `,
  ],
  template: `
    <section class="bg-white py-12 md:py-20">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 gap-12 lg:grid-cols-[40%_60%] lg:gap-14">
          <!-- ==================== Story sections ==================== -->
          <div class="min-w-0">
            @for (s of sections(); track s.key; let i = $index) {
              <div
                class="border-t border-gray-200"
                [class.border-t-0]="i === 0"
              >
                <h2>
                  <button
                    type="button"
                    [id]="btnId(s.key)"
                    (click)="toggle(s.key)"
                    [attr.aria-expanded]="isOpen(s.key)"
                    [attr.aria-controls]="panelId(s.key)"
                    class="group flex w-full items-center gap-3 rounded-md py-5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/50 md:gap-4"
                  >
                    <span class="w-7 flex-shrink-0 text-xs font-semibold tabular-nums text-gray-400">
                      {{ pad2(i + 1) }}
                    </span>
                    <span class="flex-1 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-900 md:text-xl">
                      {{ s.labelKey | translate }}
                    </span>
                    <span
                      class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 text-blue-900 transition-transform duration-300 group-hover:border-blue-900/40"
                      [class.rotate-45]="isOpen(s.key)"
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                </h2>

                <div [id]="panelId(s.key)" role="region" [attr.aria-labelledby]="btnId(s.key)">
                  <div
                    class="story-grid grid overflow-hidden transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
                    [style.gridTemplateRows]="isOpen(s.key) ? '1fr' : '0fr'"
                  >
                    <div class="min-h-0">
                      <div class="pb-7 pl-11 pr-2">
                        @if (isListSection(s.key)) {
                            <ul class="space-y-3">
                              @for (key of itemsFor(s.key); track key; let j = $index) {
                                <li
                                  class="story-item-in flex items-start gap-3 text-gray-600"
                                  [style.animationDelay]="j * 55 + 'ms'"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg"
                                       class="mt-1 h-4 w-4 flex-shrink-0 text-orange-500"
                                       fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                    <path fill-rule="evenodd"
                                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                          clip-rule="evenodd" />
                                  </svg>
                                  <span>{{ key | translate }}</span>
                                </li>
                              }
                            </ul>
                        } @else {
                          <p class="text-base leading-relaxed text-gray-600">
                            {{ paragraphFor(s.key) | translate }}
                          </p>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- ==================== Stacked gallery ==================== -->
          <div class="min-w-0 self-start lg:sticky lg:top-24">
            @if (gallery().length > 0) {
              <app-project-gallery
                [images]="gallery()"
                [altText]="project().title"
                [cover]="project().media?.cover || ''"
              />
              <p class="relative z-20 mt-5 inline-block rounded-lg border border-slate-900/5 bg-white/70 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 backdrop-blur-[5px]">
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

  /**
   * Single source of truth for accordion state: the currently open section
   * key, or null when all sections are closed. The first section is open
   * by default.
   */
  private readonly expanded = signal<SectionKey | null>('overview');

  /** Sections derived from the project data; optional ones are omitted. */
  readonly sections = computed<StorySection[]>(() => {
    const c = this.project().content;
    const list: StorySection[] = [
      { key: 'overview', labelKey: SECTION_LABEL_KEYS.overview },
    ];
    if (c?.challengeKey) {
      list.push({ key: 'challenge', labelKey: SECTION_LABEL_KEYS.challenge });
    }
    if (c?.executionScopeKeys?.length) {
      list.push({
        key: 'execution',
        labelKey: SECTION_LABEL_KEYS.execution,
        itemKeys: c.executionScopeKeys,
      });
    }
    if (c?.equipmentKeys?.length) {
      list.push({
        key: 'equipment',
        labelKey: SECTION_LABEL_KEYS.equipment,
        itemKeys: c.equipmentKeys,
      });
    }
    return list;
  });

  readonly overview = computed(
    () => this.project().content?.overviewKey ?? this.project().description,
  );
  readonly challenge = computed(() => this.project().content?.challengeKey ?? '');
  readonly gallery = computed(
    () => this.project().media?.gallery ?? this.project().galleryUrls,
  );

  isOpen(key: SectionKey): boolean {
    return this.expanded() === key;
  }

  toggle(key: SectionKey): void {
    this.expanded.update(prev => (prev === key ? null : key));
  }

  paragraphFor(key: SectionKey): string {
    return key === 'challenge' ? this.challenge() : this.overview();
  }

  isListSection(key: SectionKey): boolean {
    return key === 'execution' || key === 'equipment';
  }

  itemsFor(key: SectionKey): readonly string[] {
    return this.sections().find(s => s.key === key)?.itemKeys ?? [];
  }

  protected readonly pad2 = pad2;
  protected readonly btnId = (key: SectionKey): string => `story-btn-${key}`;
  protected readonly panelId = (key: SectionKey): string => `story-panel-${key}`;
}
