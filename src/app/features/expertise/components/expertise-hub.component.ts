import {
  AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, input, signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Expertise } from '../../../core/models/expertise.model';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';

/** SVG scene units (viewBox 0 0 600 600). */
const C = 300;          // centre
const RING = 228;       // ring-main radius
const NODE = 50;        // node radius
const DROP_R = 74;      // radius of the drop's round body

/**
 * EXPERTISE HUB — "one source, every trade".
 *
 * A ring main (circular glass pipe, water circulating) links every trade.
 * At the centre a glass drop holds the source water. Selecting a trade
 * sends a droplet down that spoke; the drop's free surface recoils and
 * sloshes as a damped oscillator (natural frequency ω, damping ζ), and the
 * node rings with a splash when the droplet arrives.
 *
 * Nodes are real buttons (keyboard + screen readers); the selected trade's
 * content is shown in the side panel. Auto-cycles until the user interacts.
 */
@Component({
  selector: 'app-expertise-hub',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="xh">
      <div #scene class="xh__scene" (pointerenter)="userActive = true">
        <svg class="xh__svg" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <clipPath id="xhDropClip"><path [attr.d]="dropPath" /></clipPath>
            <radialGradient id="xhDropGlass" cx="0.38" cy="0.55" r="0.7">
              <stop offset="0" stop-color="#ffffff" stop-opacity=".85" />
              <stop offset=".6" stop-color="#d6efff" stop-opacity=".55" />
              <stop offset="1" stop-color="#7cc4f4" stop-opacity=".7" />
            </radialGradient>
            <linearGradient id="xhWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#5cc0ff" /><stop offset="1" stop-color="#0d5fb8" />
            </linearGradient>
          </defs>

          <!-- ring main: glass wall, water, circulating flow -->
          <circle class="xh__pipe" [attr.cx]="C" [attr.cy]="C" [attr.r]="RING" />
          <circle class="xh__water" [attr.cx]="C" [attr.cy]="C" [attr.r]="RING" />
          <circle class="xh__flow" [attr.cx]="C" [attr.cy]="C" [attr.r]="RING" />

          <!-- spokes: source → each trade -->
          @for (n of nodes(); track n.slug; let i = $index) {
            <line class="xh__pipe xh__pipe--spoke" [attr.x1]="n.sx" [attr.y1]="n.sy" [attr.x2]="n.ex" [attr.y2]="n.ey" />
            <line class="xh__water xh__water--spoke" [attr.x1]="n.sx" [attr.y1]="n.sy" [attr.x2]="n.ex" [attr.y2]="n.ey" />
            <line class="xh__flow xh__flow--spoke" [class.is-on]="active() === i"
                  [attr.x1]="n.sx" [attr.y1]="n.sy" [attr.x2]="n.ex" [attr.y2]="n.ey" />
          }

          <!-- the source drop -->
          <path [attr.d]="dropPath" fill="url(#xhDropGlass)" />
          <g clip-path="url(#xhDropClip)">
            <path #waterPath fill="url(#xhWater)" opacity=".92" />
            <path #crestPath fill="none" stroke="#e8f7ff" stroke-width="2.5" />
            @for (b of bubbles; track $index) {
              <circle class="xh__bubble" [attr.r]="b.r" [attr.cx]="b.x" [attr.cy]="b.y" />
            }
          </g>
          <path [attr.d]="dropPath" fill="none" stroke="#1565c0" stroke-opacity=".55" stroke-width="2.5" />
          <path d="M268 262 C 258 290 252 318 258 342" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".75" />

          <!-- travelling droplet -->
          <path #traveller class="xh__traveller" d="M0 -11 C 6 -4 8 0 8 4 A 8 8 0 0 1 -8 4 C -8 0 -6 -4 0 -11 Z" />
        </svg>

        @for (n of nodes(); track n.slug; let i = $index) {
          <button type="button" class="xh__node" [class.is-on]="active() === i" [class.is-hit]="hit() === i"
                  [style.left.%]="n.x / 6" [style.top.%]="n.y / 6" (click)="select(i)"
                  [attr.aria-pressed]="active() === i" [attr.aria-label]="n.titleKey | translate">
            <span class="xh__node-ring" aria-hidden="true"></span>
            <i [class]="n.iconClass" aria-hidden="true"></i>
            <span class="xh__node-label">{{ n.titleKey | translate }}</span>
          </button>
        }
      </div>

      @if (current(); as e) {
        <article class="xh__panel" aria-live="polite">
          <p class="hx-eyebrow">{{ '0' + (active() + 1) }} / {{ '0' + items().length }}</p>
          <h3 class="hx-display">{{ e.titleKey! | translate }}</h3>
          <p class="xh__desc">{{ e.descriptionKey! | translate }}</p>
          <ul>
            @for (k of e.detailKeys ?? []; track k) { <li>{{ k | translate }}</li> }
          </ul>
          <a class="hx-link" [routerLink]="['/expertise', e.slug]">
            {{ 'xp_more' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
          <p class="xh__hint">{{ 'xp_hub_hint' | translate }}</p>
        </article>
      }
    </div>
  `
})
export class ExpertiseHubComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  readonly items = input.required<Expertise[]>();
  @ViewChild('scene', { static: true }) scene!: ElementRef<HTMLElement>;
  @ViewChild('waterPath', { static: true }) waterPath!: ElementRef<SVGPathElement>;
  @ViewChild('crestPath', { static: true }) crestPath!: ElementRef<SVGPathElement>;
  @ViewChild('traveller', { static: true }) traveller!: ElementRef<SVGPathElement>;

  readonly C = C;
  readonly RING = RING;
  readonly active = signal(0);
  readonly hit = signal(-1);
  readonly current = computed(() => this.items()[this.active()]);
  userActive = false;

  /** Teardrop: tip at the top, round body of radius DROP_R. */
  readonly dropPath =
    `M${C} ${C - 128} C ${C} ${C - 128} ${C - DROP_R} ${C - 40} ${C - DROP_R} ${C + 6} ` +
    `A ${DROP_R} ${DROP_R} 0 0 0 ${C + DROP_R} ${C + 6} C ${C + DROP_R} ${C - 40} ${C} ${C - 128} ${C} ${C - 128} Z`;

  /** Node geometry: evenly spaced on the ring, first one at the top-left. */
  readonly nodes = computed(() => {
    const n = this.items().length;
    return this.items().map((e, i) => {
      const a = -Math.PI / 2 - Math.PI / n + (i * 2 * Math.PI) / n;
      const ux = Math.cos(a), uy = Math.sin(a);
      return {
        ...e, a, ux, uy,
        x: C + ux * RING, y: C + uy * RING,
        sx: C + ux * (DROP_R + 6), sy: C + 6 + uy * (DROP_R + 6),
        ex: C + ux * (RING - NODE), ey: C + uy * (RING - NODE)
      };
    });
  });

  bubbles = Array.from({ length: 9 }, (_, i) => ({ x: C - 50 + (i * 97) % 100, y: C + 40 + (i * 37) % 40, r: 1.5 + (i % 3), v: 14 + (i % 4) * 6 }));

  private off?: () => void;
  private t = 0;
  private cycle = 0;
  // free-surface tilt (rad): damped oscillator θ'' = −ω²θ − 2ζωθ'
  private theta = 0;
  private omega = 0;
  private readonly W0 = 5.2;   // natural frequency (rad/s)
  private readonly ZETA = 0.09;
  // droplet in flight
  private flight: { i: number; t: number } | null = null;

  ngAfterViewInit(): void {
    this.off = this.ticker.register(this.scene.nativeElement, dt => this.tick(dt));
    this.launch(0);
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  select(i: number): void {
    this.userActive = true;
    if (i === this.active() && this.flight) return;
    this.active.set(i);
    this.launch(i);
  }

  /** Send a droplet down spoke i; the ejection kicks the free surface (recoil). */
  private launch(i: number): void {
    const n = this.nodes()[i];
    if (!n) return;
    this.flight = { i, t: 0 };
    this.omega += -n.ux * 1.6;
    this.hit.set(-1);
  }

  private tick(dt: number): void {
    this.t += dt;

    // Auto-cycle through trades until the visitor takes over.
    if (!this.userActive && dt > 0) {
      this.cycle += dt;
      if (this.cycle > 4.2) {
        this.cycle = 0;
        const next = (this.active() + 1) % this.items().length;
        this.active.set(next);
        this.launch(next);
      }
    }

    // Sloshing (semi-implicit Euler).
    if (dt > 0) {
      this.omega += (-this.W0 * this.W0 * this.theta - 2 * this.ZETA * this.W0 * this.omega) * dt;
      this.theta += this.omega * dt;
    }
    this.drawWater(dt);

    // Droplet: accelerates down the spoke (pressure-driven), then splashes.
    const tr = this.traveller.nativeElement;
    if (this.flight) {
      const n = this.nodes()[this.flight.i];
      this.flight.t += dt > 0 ? dt / 0.85 : 1;
      const k = Math.min(1, this.flight.t);
      const e = k * k * (1.6 - 0.6 * k); // ease-in with a little momentum
      const x = n.sx + (n.ex - n.sx) * e, y = n.sy + (n.ey - n.sy) * e;
      const ang = (Math.atan2(n.uy, n.ux) * 180) / Math.PI + 90;
      tr.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${(1 + 0.25 * e).toFixed(2)},${(1 + 0.4 * e).toFixed(2)})`);
      tr.style.opacity = '1';
      if (k >= 1) {
        this.hit.set(this.flight.i);
        this.flight = null;
        tr.style.opacity = '0';
      }
    }
  }

  private drawWater(dt: number): void {
    const level = C - 8;                       // rest level inside the drop
    const x0 = C - DROP_R - 4, x1 = C + DROP_R + 4;
    const slope = Math.tan(Math.max(-0.35, Math.min(0.35, this.theta)));
    let d = '';
    let crest = '';
    for (let x = x0; x <= x1; x += 6) {
      const y = level + (x - C) * slope + Math.sin(x * 0.09 - this.t * 3.1) * 1.6 + Math.sin(x * 0.045 + this.t * 1.7) * 1.2;
      d += (x === x0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      crest += (x === x0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    d += `L${x1} ${C + DROP_R + 20} L${x0} ${C + DROP_R + 20} Z`;
    this.waterPath.nativeElement.setAttribute('d', d);
    this.crestPath.nativeElement.setAttribute('d', crest);

    // Bubbles: rise at terminal velocity, wobble, recycle at the surface.
    const els = this.scene.nativeElement.querySelectorAll<SVGCircleElement>('.xh__bubble');
    this.bubbles.forEach((b, i) => {
      b.y -= b.v * dt;
      if (b.y < level + 6) { b.y = C + DROP_R - 6; b.x = C - 48 + Math.random() * 96; }
      const el = els[i];
      if (el) {
        el.setAttribute('cx', (b.x + Math.sin(this.t * 3 + i) * 1.5).toFixed(1));
        el.setAttribute('cy', b.y.toFixed(1));
      }
    });
  }
}
