import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';
import { HxRevealDirective } from '../../shared/hydro/hx-reveal.directive';
import { ExpertiseHubComponent } from './components/expertise-hub.component';
import { ExpertiseFlowComponent } from './components/expertise-flow.component';

/**
 * EXPERTISE — one source, every trade.
 *  1. Hero: SIGAT field photo; its lower edge is the site's glass pipe.
 *  2. Hub: ring main + central drop; each trade is a node fed by a spoke.
 *  3. Flow: the trades in detail, threaded on a pipe that fills on scroll.
 * Hand-off colours: hero → #eef6fd (hub) → #ffffff (flow) → footer pipe.
 */
@Component({
  selector: 'app-expertise',
  standalone: true,
  imports: [RouterLink, TranslatePipe, WavePipeComponent, HxRevealDirective, ExpertiseHubComponent, ExpertiseFlowComponent],
  template: `
    <section class="xp-hero">
      <img class="xp-hero__img" src="assets/media/gallery/20231229-pipeline-1280.webp"
           srcset="assets/media/gallery/20231229-pipeline-768.webp 768w, assets/media/gallery/20231229-pipeline-1280.webp 1280w, assets/media/gallery/20231229-pipeline.webp 1920w"
           sizes="100vw" alt="" fetchpriority="high" />
      <div class="xp-hero__shade" aria-hidden="true"></div>
      <div class="hx-container xp-hero__copy">
        <nav class="xp-crumb" aria-label="breadcrumb">
          <a routerLink="/home">{{ 'nav_home' | translate }}</a> <span aria-hidden="true">/</span>
          <span aria-current="page">{{ 'nav_expertise' | translate }}</span>
        </nav>
        <p class="hx-eyebrow hx-eyebrow--light">{{ 'xp_hero_kicker' | translate }}</p>
        <h1 class="hx-display">{{ 'xp_hero_title' | translate }}</h1>
        <p class="xp-hero__sub">{{ 'xp_hero_sub' | translate }}</p>
      </div>
      <app-wave-pipe class="xp-hero__joint" [height]="110" [amplitude]="28" [phase]="1.1" fillBelow="#eef6fd" />
    </section>

    <section class="xp-hub">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'xp_hub_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'xp_hub_title' | translate }}</h2>
        </header>
        <app-expertise-hub [items]="items" />
      </div>
    </section>


    <section class="xp-flow">
      <div class="hx-container">
        <header class="hx-head hx-reveal" hxReveal>
          <p class="hx-eyebrow">{{ 'xp_flow_kicker' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'xp_flow_title' | translate }}</h2>
        </header>
        <app-expertise-flow [items]="items" />
      </div>
    </section>
  `
})
export class ExpertiseComponent {
  readonly items = inject(MockDataService).getExpertise();
}
