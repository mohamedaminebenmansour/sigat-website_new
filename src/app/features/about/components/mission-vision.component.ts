import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-mission-vision',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="py-16 bg-gray-50">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <!-- Mission Card -->
          <div class="bg-white rounded-lg shadow-md border-t-4 border-blue-900 p-8">
            <div class="text-4xl mb-4">🎯</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">{{ 'about_mission_title' | translate }}</h3>
            <p class="text-gray-600 leading-relaxed">{{ 'about_mission_text' | translate }}</p>
          </div>

          <!-- Vision Card -->
          <div class="bg-white rounded-lg shadow-md border-t-4 border-blue-900 p-8">
            <div class="text-4xl mb-4">🔭</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">{{ 'about_vision_title' | translate }}</h3>
            <p class="text-gray-600 leading-relaxed">{{ 'about_vision_text' | translate }}</p>
          </div>
        </div>
      </div>
    </section>
  `
})
export class MissionVisionComponent {}
