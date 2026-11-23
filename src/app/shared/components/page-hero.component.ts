import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WavePipeComponent } from '../hydraulics/wave-pipe.component';

/**
 * Standard inner-page hero (same look as Expertise): a real SIGAT field photo,
 * breadcrumb, kicker, title, subtitle, optional actions (projected), and the
 * site's glass pipe as its lower edge — the page's only pipe joint.
 * `photo` = base path in assets/media/gallery without the "-768/-1280.webp" suffix.
 */
@Component({
  selector: 'app-page-hero',
  standalone: true,
  imports: [RouterLink, TranslatePipe, WavePipeComponent],
  template: `
    <section class="xp-hero ph-hero" [class.ph-hero--short]="short()">
      <img class="xp-hero__img" [src]="photo() + '-1280.webp'"
           [attr.srcset]="photo() + '-768.webp 768w, ' + photo() + '-1280.webp 1280w, ' + photo() + '.webp 1920w'"
           sizes="100vw" alt="" fetchpriority="high" />
      <div class="xp-hero__shade" aria-hidden="true"></div>
      <div class="hx-container xp-hero__copy">
        <nav class="xp-crumb" aria-label="breadcrumb">
          <a routerLink="/home">{{ 'nav_home' | translate }}</a> <span aria-hidden="true">/</span>
          <span aria-current="page">{{ crumb() | translate }}</span>
        </nav>
        <p class="hx-eyebrow hx-eyebrow--light">{{ kicker() | translate }}</p>
        <h1 class="hx-display">{{ title() | translate }}</h1>
        @if (sub()) { <p class="xp-hero__sub">{{ sub() | translate }}</p> }
        <div class="ph-hero__actions"><ng-content /></div>
      </div>
      <app-wave-pipe class="xp-hero__joint" [height]="110" [amplitude]="28" [phase]="phase()" [fillBelow]="fillBelow()" />
    </section>
  `
})
export class PageHeroComponent {
  readonly photo = input('assets/media/gallery/20231229-pipeline');
  readonly crumb = input.required<string>();
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly fillBelow = input('#ffffff');
  readonly phase = input(1.1);
  readonly short = input(false);
}
