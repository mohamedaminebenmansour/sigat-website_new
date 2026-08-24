import { Component, input } from '@angular/core';

@Component({
  selector: 'app-section-header',
  standalone: true,
  template: `
    <div class="text-center max-w-3xl mx-auto mb-12">
      <h2
        class="text-3xl md:text-4xl font-bold mb-4"
        [class.text-white]="darkMode()"
        [class.text-gray-900]="!darkMode()"
      >
        {{ title() }}
      </h2>
      <div class="flex justify-center mb-4">
        <div class="h-1 w-16 bg-orange-500 rounded-full"></div>
      </div>
      @if (subtitle()) {
        <p
          class="text-lg max-w-2xl mx-auto"
          [class.text-gray-300]="darkMode()"
          [class.text-gray-600]="!darkMode()"
        >
          {{ subtitle() }}
        </p>
      }
    </div>
  `
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly darkMode = input(false);
}
