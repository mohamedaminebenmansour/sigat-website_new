import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-company-story',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <div class="flex flex-col md:flex-row items-center gap-10 max-w-5xl mx-auto">
          <!-- Image -->
          <div class="w-full md:w-1/2">
            <img
              src="https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&q=80"
              alt="SIGAT construction site"
              class="w-full h-72 md:h-96 object-cover rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>

          <!-- Text -->
          <div class="w-full md:w-1/2">
            <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {{ 'about_story_title' | translate }}
            </h2>
            <div class="w-16 h-1 bg-orange-500 rounded-full mb-6"></div>
            <p class="text-gray-600 leading-relaxed text-base md:text-lg">
              {{ 'about_story_text' | translate }}
            </p>

            <!-- Highlight Box -->
            <div class="mt-6 bg-blue-50 border-l-4 border-blue-900 p-4 rounded-r-lg">
              <p class="text-gray-700 text-sm leading-relaxed italic">
                {{ 'about_story_highlight' | translate }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class CompanyStoryComponent {}
