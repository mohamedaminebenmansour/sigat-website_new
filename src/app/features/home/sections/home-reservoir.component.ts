import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroReservoirComponent } from '../../../shared/hydro/hydro-reservoir.component';
import { HxRevealDirective } from '../../../shared/hydro/hx-reveal.directive';
import { HxCountDirective } from '../../../shared/hydro/hx-count.directive';
import { HxWaveEdgeComponent } from '../../../shared/hydro/hx-wave-edge.component';
import { COMPANY_STATS } from '../../media-showcase/data/company-stats.data';

/**
 * CHAPTER 02 — LE RÉSERVOIR
 * Who SIGAT is. The live tank fills as the chapter enters the viewport and
 * the company figures rise in their own gauge tubes at the same time.
 */
@Component({
  selector: 'app-home-reservoir',
  standalone: true,
  imports: [RouterLink, TranslatePipe, HydroReservoirComponent, HxRevealDirective, HxCountDirective, HxWaveEdgeComponent],
  template: `
    <section class="hx-ch hx-ch--deep" id="ch-reservoir" data-chapter="02">
      <div class="hx-container hx-res-grid">
        <div class="hx-reveal" hxReveal>
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'hx_res_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'hx_res_title' | translate }}</h2>
          <p class="hx-lead">{{ 'about_story_text' | translate }}</p>
          <blockquote class="hx-quote">{{ 'about_story_highlight' | translate }}</blockquote>
          <a routerLink="/about" class="hx-link hx-link--light">
            {{ 'hx_res_link' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
        <div class="hx-reveal" hxReveal style="--d: 150ms">
          <app-hydro-reservoir [fill]="0.8" [capacity]="5000" [label]="'hx_res_tank_label' | translate" />
          <p class="hx-res-tip">{{ 'hx_res_tank_tip' | translate }}</p>
        </div>
      </div>

      <ul class="hx-container hx-gauges hx-live" [hxReveal]="0.3">
        @for (s of stats; track s.labelKey; let i = $index) {
          <li class="hx-gauge" [style.--fill]="fills[i]" [style.--d]="i * 140 + 'ms'">
            <span class="hx-gauge__tube" aria-hidden="true"><span class="hx-gauge__water"></span></span>
            <span class="hx-gauge__body">
              <i [class]="s.icon" aria-hidden="true"></i>
              <strong><span [hxCount]="s.value"></span>{{ s.suffix }}</strong>
              <span>{{ s.labelKey | translate }}</span>
            </span>
          </li>
        }
      </ul>

      <app-hx-wave-edge color="#eef6fd" />
    </section>
  `
})
export class HomeReservoirComponent {
  readonly stats = COMPANY_STATS;
  /** Visual fill of each gauge tube (relative, not to scale). */
  readonly fills = [0.62, 0.78, 0.92, 0.7];
}
