import { Component, input } from '@angular/core';

/**
 * Animated water edge used to hand one chapter over to the next.
 * Two parallax wave layers drift in opposite directions (pure CSS).
 * Place it absolutely at the bottom (or top, with [flip]) of a section;
 * `color` should be the background of the following section.
 */
@Component({
  selector: 'app-hx-wave-edge',
  standalone: true,
  host: { class: 'hx-edge', '[class.hx-edge--flip]': 'flip()', 'aria-hidden': 'true' },
  template: `
    <svg class="hx-edge__l hx-edge__l--back" viewBox="0 0 2400 120" preserveAspectRatio="none">
      <path [attr.fill]="color()" fill-opacity="0.45"
        d="M0 62 C200 30 400 30 600 62 S1000 94 1200 62 S1600 30 1800 62 S2200 94 2400 62 V120 H0Z" />
    </svg>
    <svg class="hx-edge__l hx-edge__l--front" viewBox="0 0 2400 120" preserveAspectRatio="none">
      <path [attr.fill]="color()"
        d="M0 76 C200 46 400 46 600 76 S1000 106 1200 76 S1600 46 1800 76 S2200 106 2400 76 V120 H0Z" />
      <path fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"
        d="M0 76 C200 46 400 46 600 76 S1000 106 1200 76 S1600 46 1800 76 S2200 106 2400 76" />
    </svg>
  `
})
export class HxWaveEdgeComponent {
  readonly color = input('#ffffff');
  readonly flip = input(false);
}
