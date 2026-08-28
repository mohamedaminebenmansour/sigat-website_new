import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section
      class="py-10 md:py-12"
      style="background-color: rgb(32 56 167 / 82%)"
    >
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">{{ title() }}</h2>
        @if (description()) {
          <p class="text-lg text-gray-300 max-w-2xl mx-auto mb-8">{{ description() }}</p>
        }
        @if (buttonText() && buttonRoute()) {
          <a
            [routerLink]="buttonRoute()"
            class="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base"
          >
            {{ buttonText() }}
          </a>
        }
      </div>
    </section>
  `
})
export class CtaBannerComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly buttonText = input<string>('');
  readonly buttonRoute = input<string>('');
}
