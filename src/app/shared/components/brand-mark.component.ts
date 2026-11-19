import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** SIGAT mark (ring reservoir, gooseneck, legs, drop) + optional wordmark, as crisp SVG. */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex items-center gap-2.5" [style.color]="color()">
      <svg viewBox="60 20 1020 1410" [attr.width]="size() * 0.72" [attr.height]="size()" fill="none" stroke="currentColor"
           stroke-linecap="butt" aria-hidden="true">
        <ellipse cx="565" cy="360" rx="462" ry="305" stroke-width="48"/>
        <path d="M400 600C410 800 440 1000 463 1130" stroke-width="72"/>
        <path d="M575 700V1130" stroke-width="72"/>
        <path d="M505 1395C600 1325 700 1220 760 1050C790 960 775 780 745 600C725 470 700 300 640 250C600 222 535 236 500 270C480 290 466 320 462 350" stroke-width="72"/>
        <path d="M445 1170C430 1210 410 1240 410 1268a35 35 0 0 0 70 0C480 1240 460 1210 445 1170Z" fill="currentColor" stroke="none"/>
      </svg>
      @if (wordmark()) {
        <span class="leading-none">
          <b class="block font-serif text-[26px] tracking-[0.32em] md:text-[28px]">SIGAT</b>
          <small class="mt-1 block text-[8.5px] tracking-wide opacity-90">Société Internationale des Grands Travaux</small>
        </span>
      }
    </span>
  `,
})
export class BrandMarkComponent {
  readonly size = input(44);
  readonly color = input('#ffffff');
  readonly wordmark = input(true);
}
