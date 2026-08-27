import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Presentational editorial section: content first, supporting image second.
 * Pure HTML + Tailwind (logical utilities for RTL); no component logic.
 */
@Component({
  selector: 'app-company-story',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-12 sm:py-14 md:py-20 bg-slate-50">
      <div class="container mx-auto px-4">
        <div class="flex flex-col lg:flex-row items-center gap-10 lg:gap-14 max-w-6xl mx-auto">

          <!-- Content (leads the section on every breakpoint) -->
          <div class="w-full lg:w-[46%]">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800 mb-3">
              {{ 'about_page_title' | translate }}
            </p>

            <h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
              {{ 'about_story_title' | translate }}
            </h2>

            <div class="w-12 h-[3px] rounded-full bg-gradient-to-r from-blue-900 to-blue-500 my-5"></div>

            <p class="text-slate-600 leading-relaxed text-base md:text-lg max-w-xl">
              {{ 'about_story_text' | translate }}
            </p>

            <!-- Corporate statement panel -->
            <div class="mt-7 flex gap-4 bg-white p-5 rounded-xl shadow-sm ring-1 ring-slate-900/5">
              <span
                class="w-[3px] shrink-0 self-stretch rounded-full bg-gradient-to-b from-blue-900 to-blue-500"
                aria-hidden="true"
              ></span>
              <p class="text-slate-700 text-sm md:text-[0.95rem] font-medium leading-relaxed">
                {{ 'about_story_highlight' | translate }}
              </p>
            </div>
          </div>

          <!-- Supporting image (second) -->
          <div class="w-full lg:w-[54%] relative">
            <!-- Subtle SIGAT-blue depth frame behind the photo (decoration only) -->
            <div
              class="hidden md:block absolute top-3 end-[-12px] bottom-3 start-6 rounded-xl bg-blue-900/[0.06]"
              aria-hidden="true"
            ></div>
            <img
              src="assets/media/gallery/20240428-station-1280.webp"
              srcset="
                assets/media/gallery/20240428-station-768.webp   768w,
                assets/media/gallery/20240428-station-1280.webp 1280w
              "
              sizes="(min-width: 1024px) 54vw, 100vw"
              alt="SIGAT hydraulic infrastructure construction site"
              class="relative w-full aspect-[4/3] object-cover rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>

        </div>
      </div>
    </section>
  `
})
export class CompanyStoryComponent {}
