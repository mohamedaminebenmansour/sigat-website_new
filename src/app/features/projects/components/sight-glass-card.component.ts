import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A project seen through a sight glass ("voyant de circulation").
 * Bolted flange ring, glass with glare, water band at the bottom and a
 * flow rotor that spins with the flow. Hover = more flow: the level rises
 * behind the glass and the rotor speeds up. Pipe stubs on both sides join
 * the cards into one line.
 */
@Component({
  selector: 'app-sight-glass-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <a class="sg" [routerLink]="link()">
      <span class="sg__line" aria-hidden="true"></span>
      <span class="sg__flange" aria-hidden="true">
        @for (b of bolts; track b) { <i class="sg__bolt" [style.--a]="b + 'deg'"></i> }
        <span class="sg__glass">
          <img [src]="image()" alt="" loading="lazy" decoding="async" />
          <span class="sg__water"><svg viewBox="0 0 120 10" preserveAspectRatio="none"><path d="M0 5 C20 0 40 0 60 5 S100 10 120 5 V10 H0Z" /></svg></span>
          <svg class="sg__rotor" viewBox="-12 -12 24 24"><path d="M0 0 L0 -10 A10 10 0 0 1 8.7 -5 Z M0 0 L8.7 5 A10 10 0 0 1 -8.7 5 Z M0 0 L-8.7 -5 A10 10 0 0 1 0 -10 Z" /></svg>
          <span class="sg__glare"></span>
        </span>
      </span>
      <span class="sg__meta">
        <span class="sg__tag">{{ categoryKey() | translate }} · {{ year() }}</span>
        <span class="sg__title hx-display">{{ title() }}</span>
        <span class="sg__loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> {{ location() }}</span>
        <span class="sg__more">{{ 'pj_open' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
      </span>
    </a>
  `
})
export class SightGlassCardComponent {
  readonly title = input.required<string>();
  readonly location = input('');
  readonly year = input('');
  readonly categoryKey = input('');
  readonly image = input.required<string>();
  readonly link = input.required<string>();
  /** 8 flange bolts, like a PN16 DN150 flange */
  readonly bolts = [0, 45, 90, 135, 180, 225, 270, 315];
}
