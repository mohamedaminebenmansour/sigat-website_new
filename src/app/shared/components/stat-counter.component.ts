import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-counter',
  standalone: true,
  template: `
    <div class="text-center p-6">
      <div class="text-4xl md:text-5xl font-bold text-blue-900 mb-2">
        {{ value() }}<span class="text-orange-500">{{ suffix() }}</span>
      </div>
      <p class="text-gray-600 text-sm md:text-base font-medium uppercase tracking-wide">
        {{ label() }}
      </p>
    </div>
  `
})
export class StatCounterComponent {
  readonly value = input.required<number>();
  readonly suffix = input<string>('');
  readonly label = input.required<string>();
}
