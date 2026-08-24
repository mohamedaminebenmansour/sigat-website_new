import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-expertise-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="routerLink()"
      class="block bg-white rounded-lg shadow-md p-8 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      <!-- Icon -->
      @if (iconClass()) {
        <div class="mb-5">
          <i [class]="'text-4xl text-blue-900 ' + iconClass()"></i>
        </div>
      }

      <!-- Title -->
      <h3 class="text-xl font-bold text-gray-900 mb-3">{{ title() }}</h3>

      <!-- Description -->
      @if (description()) {
        <p class="text-gray-600 text-sm leading-relaxed">{{ description() }}</p>
      }
    </a>
  `
})
export class ExpertiseCardComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly iconClass = input<string>('');
  readonly routerLink = input<string>('');
}
