import {
  AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChild, ViewChildren, inject, input, signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Expertise } from '../../../core/models/expertise.model';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';

interface Sample { x: number; y: number; s: number; }

/**
 * EXPERTISE FLOW — the trades as a pipeline.
 *
 * Cards are staggered (zig-zag on tablet/desktop, straight on phones). A glass
 * pipe is routed through them with smooth S-bends measured from the real card
 * positions. Scrolling advances the water front along the pipe; when the front
 * passes a card, its valve tile fills with water and the card comes alive.
 */
@Component({
  selector: 'app-expertise-flow',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div #box class="xf">
      <svg class="xf__svg" [attr.viewBox]="viewBox()" aria-hidden="true">
        <path class="xf__glass" [attr.d]="fullPath()" />
        <path #wet class="xf__wet" />
        <path #flow class="xf__flowline" />
        <g #head class="xf__head"><circle r="9" /><circle r="3.5" cx="-2.5" cy="-2.5" class="xf__head-hl" /></g>
      </svg>

      <ol class="xf__list">
        @for (e of items(); track e.id; let i = $index) {
          <li #card class="xf__card">
            <span class="xf__tile" aria-hidden="true">
              <span class="xf__tile-water"><svg viewBox="0 0 120 12" preserveAspectRatio="none"><path d="M0 6 C20 0 40 0 60 6 S100 12 120 6 V12 H0Z" /></svg></span>
              <i [class]="e.iconClass"></i>
            </span>
            <div class="xf__body">
              <h3 class="hx-display">{{ e.titleKey! | translate }}</h3>
              <p>{{ e.descriptionKey! | translate }}</p>
              <ul>
                @for (k of e.detailKeys ?? []; track k) { <li>{{ k | translate }}</li> }
              </ul>
              <a class="hx-link" [routerLink]="['/expertise', e.slug]">
                {{ 'xp_more' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </a>
            </div>
          </li>
        }
      </ol>
    </div>
  `
})
export class ExpertiseFlowComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  readonly items = input.required<Expertise[]>();
  @ViewChild('box', { static: true }) box!: ElementRef<HTMLElement>;
  @ViewChild('wet', { static: true }) wet!: ElementRef<SVGPathElement>;
  @ViewChild('flow', { static: true }) flow!: ElementRef<SVGPathElement>;
  @ViewChild('head', { static: true }) head!: ElementRef<SVGGElement>;
  @ViewChildren('card') cards!: QueryList<ElementRef<HTMLElement>>;

  // signals: updated from the animation loop (outside the Angular zone)
  readonly viewBox = signal('0 0 100 100');
  readonly fullPath = signal('');
  private samples: Sample[] = [];
  private anchorsY: number[] = [];
  private key = '';
  private front = 0;     // smoothed water-front arclength
  private off?: () => void;

  ngAfterViewInit(): void {
    this.off = this.ticker.register(this.box.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  /** Route the pipe through every card (S-bends with vertical tangents). */
  private layout(): void {
    const box = this.box.nativeElement.getBoundingClientRect();
    const rects = this.cards.map(c => c.nativeElement.getBoundingClientRect());
    const key = rects.map(r => `${Math.round(r.left - box.left)},${Math.round(r.top - box.top)},${Math.round(r.height)}`).join('|') + box.width;
    if (key === this.key || !rects.length) return;
    this.key = key;
    const rtl = document.documentElement.dir === 'rtl';
    const gut = 26;
    const pts = rects.map(r => ({
      x: rtl ? r.right - box.left + gut : r.left - box.left - gut,
      y: r.top - box.top + Math.min(64, r.height / 2)
    }));
    this.anchorsY = pts.map(p => p.y);
    const start = { x: pts[0].x, y: 0 };
    const end = { x: pts[pts.length - 1].x, y: box.height };
    const all = [start, ...pts, end];

    // Cubic S-bends; sample them for arclength lookups.
    let d = `M${start.x} ${start.y}`;
    const samples: Sample[] = [{ x: start.x, y: start.y, s: 0 }];
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1], b = all[i];
      const my = (b.y - a.y) / 2;
      const c1 = { x: a.x, y: a.y + my }, c2 = { x: b.x, y: b.y - my };
      d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, u = 1 - t;
        const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x;
        const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
        const p = samples[samples.length - 1];
        samples.push({ x, y, s: p.s + Math.hypot(x - p.x, y - p.y) });
      }
    }
    this.samples = samples;
    this.fullPath.set(d);
    this.viewBox.set(`0 0 ${box.width.toFixed(0)} ${box.height.toFixed(0)}`);
  }

  private tick(dt: number): void {
    this.layout();
    if (!this.samples.length) return;
    const box = this.box.nativeElement.getBoundingClientRect();
    // Water front sits at 62 % of the viewport height (where the eye reads).
    const frontY = window.innerHeight * 0.62 - box.top;
    // First sample below the front line (the path only ever moves downward).
    let i = this.samples.findIndex(p => p.y > frontY);
    if (i < 0) i = this.samples.length - 1;
    const target = frontY <= 0 ? 0 : this.samples[Math.max(0, i - 1)].s;
    // The front advances like a filling pipe: fast, but never instantly.
    this.front += (target - this.front) * (dt > 0 ? Math.min(1, dt * 5) : 1);

    let wet = '', last = this.samples[0];
    for (const p of this.samples) {
      if (p.s > this.front) break;
      wet += (wet ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ';
      last = p;
    }
    this.wet.nativeElement.setAttribute('d', wet);
    this.flow.nativeElement.setAttribute('d', wet);
    const h = this.head.nativeElement;
    h.setAttribute('transform', `translate(${last.x.toFixed(1)} ${last.y.toFixed(1)})`);
    h.style.opacity = this.front > 4 && this.front < this.samples[this.samples.length - 1].s - 4 ? '1' : '0';

    this.cards.forEach((c, k) => c.nativeElement.classList.toggle('is-wet', last.y >= this.anchorsY[k] - 2));
  }
}
