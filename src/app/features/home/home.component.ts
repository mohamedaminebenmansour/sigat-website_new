import { Component, signal } from '@angular/core';
import { HomeHeroComponent } from './sections/home-hero.component';
import { HomeWaterSceneComponent } from './sections/home-water-scene.component';
import { WavePipeComponent } from '../../shared/hydraulics/wave-pipe.component';
import { ValuesPumpComponent } from '../about/components/values-pump.component';
import { HomeProjectsComponent } from './sections/home-projects.component';
import { HomeTapComponent } from './sections/home-tap.component';

/**
 * HOME — where SIGAT's water comes from, as a real installation:
 *
 *   hero          — the water rises over the site video
 *   water scene   — the official logo is a living reservoir (variable level,
 *                   pump refill); its drops deliver the figures (buoys);
 *                   the 3D crystal SIGAT letters rise from the waves; the
 *                   story is written on the water
 *   valeurs       — wet well -> centrifugal pump (values in its free vortex)
 *                   -> rising main straight up into the logo's J
 *   realisations, robinet (call to action)
 *
 * The riser x is reported by the water scene (tailX), so the pump section
 * always lines up with the logo's J whatever the screen size.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HomeHeroComponent, HomeWaterSceneComponent, WavePipeComponent, ValuesPumpComponent, HomeProjectsComponent, HomeTapComponent],
  template: `
    <app-home-hero />
    <app-wave-pipe class="hx-joint" [height]="110" [amplitude]="30" [phase]="0.6" fillAbove="#04294f" fillBelow="#86d0f7" />
    <app-home-water-scene (tailX)="riserX.set($event)" />
    <app-values-pump [riserX]="riserX()" [source]="true" sectionId="values-home" />
    <app-home-projects />
    <app-home-tap />
  `
})
export class HomeComponent {
  readonly riserX = signal(0.3);
}
