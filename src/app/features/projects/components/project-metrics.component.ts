import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ProjectMetric } from '../../../core/models/project.model';

@Component({
  selector: 'app-project-metrics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section class="bg-white py-14 md:py-20">
      <div class="container mx-auto px-4">
        <p class="mb-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">
          {{ 'project_metrics_title' | translate }}
        </p>

        @if (metrics().length > 0) {
          <dl
            class="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4"
          >
            @for (m of metrics(); track $index) {
              <div class="text-center">
                <dt
                  class="order-2 mt-2 block text-sm leading-snug text-gray-500"
                >
                  {{ m.labelKey | translate }}
                </dt>
                <dd class="order-1 flex items-baseline justify-center gap-1">
                  <span class="text-3xl font-bold text-blue-900 md:text-4xl">
                    {{ m.value }}
                  </span>
                  @if (m.unit) {
                    <span class="text-sm font-semibold text-gray-400">
                      {{ m.unit }}
                    </span>
                  }
                </dd>
                <div class="mx-auto mt-3 h-0.5 w-8 rounded-full bg-orange-500"></div>
              </div>
            }
          </dl>
        }
      </div>
    </section>
  `,
})
export class ProjectMetricsComponent {
  readonly metrics = input<ProjectMetric[]>([]);
}