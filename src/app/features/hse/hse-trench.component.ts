import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../shared/hydro/hydro-ticker.service';
import { HxWaveEdgeComponent } from '../../shared/hydro/hx-wave-edge.component';

/**
 * HSE · ON SITE — a trench made safe the way the rules require (cross-section, 1 m = 100 px).
 *   1 preparation  existing networks located (cable locator), marked on the ground, trench set out
 *   2 induction    site fenced off and signed, the worker in PPE
 *   3 execution    trench 1.80 m deep, 1.00 m wide (> 1.30 m and width ≤ 2/3 depth → shoring required):
 *                  steel shoring panels standing 15 cm above ground, hydraulic struts pumped out,
 *                  spoil kept ≥ 0.40 m from the edge, ladder rising above the edge, the worker inside
 *   4 handover     pipe on its bedding, shoring removed bottom-up as the trench is backfilled,
 *                  surface reinstated, fencing removed
 * Plays by itself while on screen (one stage every STAGE s, loops); clicking a step shows it and pauses
 * the loop for a moment. CSS transitions only; reduced motion = the finished site, steps still clickable.
 */
@Component({
  selector: 'app-hse-trench',
  standalone: true,
  imports: [TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section #sec class="crv ht" [attr.data-stage]="stage()">
      <app-hx-wave-edge color="#eef6fd" back="#2f8fe0" [flip]="true" />
      <div class="hx-container crv__grid">
        <div class="crv__copy">
          <header class="hx-head">
            <p class="hx-eyebrow hx-eyebrow--light">{{ 'hse_site_kicker' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'hse_site_title' | translate }}</h2>
          </header>
          <ol class="crv__steps ht__steps" [class.is-paused]="paused()">
            @for (i of [1, 2, 3, 4]; track i) {
              <li [class.is-on]="stage() >= i" [class.is-cur]="stage() === i">
                <button type="button" (click)="show(i)" [attr.aria-pressed]="stage() === i">
                  <span class="crv__mark" aria-hidden="true">{{ i }}</span>
                  <span><b>{{ 'hse_site_' + i + '_t' | translate }}</b><span>{{ 'hse_site_' + i | translate }}</span></span>
                </button>
                <i class="ht__bar" aria-hidden="true"></i>
              </li>
            }
          </ol>
        </div>

        <div class="jt__scene ht__scene" aria-hidden="true">
          <svg viewBox="0 0 640 420">
            <!-- ground + strata -->
            <rect x="0" y="150" width="640" height="270" class="ht-soil" />
            <rect x="0" y="230" width="640" height="190" class="ht-soil2" />
            <rect x="0" y="146" width="640" height="5" class="ht-top" />
            <!-- existing buried cable + warning mesh (to be found before digging) -->
            <line x1="430" y1="196" x2="520" y2="196" class="ht-mesh" />
            <circle cx="475" cy="214" r="9" class="ht-cable" />
            <circle cx="475" cy="214" r="9" class="ht-ping" />
            <!-- the trench (dug in stage 3) -->
            <rect x="270" y="150" width="100" height="180" class="ht-void" />
            <!-- stage 4: bedding, pipe, backfill rising, reinstatement -->
            <rect x="270" y="314" width="100" height="16" class="ht-bed" />
            <rect x="270" y="150" width="100" height="164" class="ht-backfill" />
            <circle cx="320" cy="300" r="17" class="ht-pipe" />
            <rect x="262" y="143" width="116" height="8" class="ht-asphalt" />
            <!-- setting-out: paint marks on the ground -->
            <g class="ht-mark">
              <line x1="270" y1="146" x2="270" y2="128" /><line x1="370" y1="146" x2="370" y2="128" />
              <line x1="475" y1="146" x2="475" y2="122" class="ht-mark--cable" />
            </g>
            <!-- cable locator sweeping the ground -->
            <g class="ht-locator"><rect x="-3" y="-60" width="6" height="56" rx="2" /><rect x="-14" y="-6" width="28" height="8" rx="3" /><rect x="-9" y="-70" width="18" height="12" rx="3" class="ht-locator__head" /></g>
            <!-- spoil heap, kept clear of the edge -->
            <path d="M410 150 Q470 92 560 150 Z" class="ht-spoil" />
            <!-- shoring: steel panels 15 cm above ground, hydraulic struts -->
            <g class="ht-shore">
              <rect x="261" y="135" width="9" height="195" class="ht-panel" />
              <rect x="370" y="135" width="9" height="195" class="ht-panel" />
              @for (y of [196, 276]; track y) {
                <g class="ht-strut" [attr.transform]="'translate(270 ' + y + ')'">
                  <rect x="0" y="-6" width="58" height="12" rx="3" class="ht-cyl" />
                  <rect x="58" y="-3" width="42" height="6" class="ht-rod" />
                  <rect x="-1" y="-9" width="5" height="18" class="ht-shoe" /><rect x="96" y="-9" width="5" height="18" class="ht-shoe" />
                </g>
              }
              <!-- ladder, rising above the edge -->
              <g class="ht-ladder">
                <line x1="282" y1="330" x2="282" y2="92" /><line x1="296" y1="330" x2="296" y2="92" />
                @for (y of [110, 135, 160, 185, 210, 235, 260, 285, 310]; track y) { <line x1="282" [attr.y1]="y" x2="296" [attr.y2]="y" /> }
              </g>
            </g>
            <!-- fencing + sign -->
            <g class="ht-fence">
              @for (x of [150, 210, 580, 625]; track x) { <rect [attr.x]="x" y="104" width="5" height="44" class="ht-post" /> }
              <rect x="150" y="110" width="65" height="7" class="ht-rail" /><rect x="580" y="110" width="50" height="7" class="ht-rail" />
              <line x1="110" y1="150" x2="110" y2="96" class="ht-signpost" />
              <path d="M110 64 L130 98 L90 98 Z" class="ht-sign" /><rect x="108.5" y="74" width="3" height="13" class="ht-sign__mark" /><circle cx="110" cy="92" r="1.8" class="ht-sign__mark" />
            </g>
            <!-- worker in PPE: on the surface for the induction, then in the shored trench -->
            <g class="ht-worker ht-worker--top" transform="translate(178 150)"><rect x="-6" y="-24" width="5" height="24" class="ht-leg" /><rect x="1" y="-24" width="5" height="24" class="ht-leg" /><rect x="-9" y="-50" width="18" height="28" rx="4" class="ht-vest" /><rect x="-9" y="-40" width="18" height="3" class="ht-band" /><circle cy="-58" r="7" class="ht-face" /><path d="M-9 -60 Q0 -72 9 -60 Z" class="ht-helmet" /></g>
            <g class="ht-worker ht-worker--in" transform="translate(338 330)"><rect x="-6" y="-24" width="5" height="24" class="ht-leg" /><rect x="1" y="-24" width="5" height="24" class="ht-leg" /><rect x="-9" y="-50" width="18" height="28" rx="4" class="ht-vest" /><rect x="-9" y="-40" width="18" height="3" class="ht-band" /><circle cy="-58" r="7" class="ht-face" /><path d="M-9 -60 Q0 -72 9 -60 Z" class="ht-helmet" /></g>
            <!-- dimensions: why the shoring is required -->
            <g class="ht-dims">
              <line x1="236" y1="150" x2="236" y2="330" /><line x1="230" y1="150" x2="242" y2="150" /><line x1="230" y1="330" x2="242" y2="330" />
              <line x1="230" y1="280" x2="242" y2="280" class="ht-dims__lim" />
              <text x="226" y="284" text-anchor="end" class="ht-dims__t ht-dims__t--lim">{{ 'hse_dim_limit' | translate }}</text>
              <text x="226" y="244" text-anchor="end" class="ht-dims__t">{{ 'hse_dim_depth' | translate }}</text>
              <line x1="370" y1="164" x2="410" y2="164" /><line x1="410" y1="157" x2="410" y2="171" />
              <text x="390" y="184" text-anchor="middle" class="ht-dims__t">{{ 'hse_dim_setback' | translate }}</text>
              <text x="384" y="128" class="ht-dims__t ht-dims__t--s">{{ 'hse_dim_up' | translate }}</text>
            </g>
            <!-- handover: a green tick on the reinstated surface -->
            <g class="ht-ok" transform="translate(320 104)"><circle r="16" /><path d="M-7 0 L-2 6 L8 -6" /></g>
          </svg>
        </div>
      </div>
      <app-hx-wave-edge color="#eaf5fd" back="#2f8fe0" />
    </section>
  `
})
export class HseTrenchComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  readonly stage = signal(1);
  readonly paused = signal(false);
  private off?: () => void;
  private clock = 0;
  private resumeAt = 0;
  private static readonly STAGE = 3.6;   // seconds per stage (matches the CSS bar)
  private static readonly HOLD = 2;      // extra time on the finished site before looping

  ngAfterViewInit(): void {
    const sec = this.sec.nativeElement, T = HseTrenchComponent.STAGE, cycle = T * 4 + HseTrenchComponent.HOLD;
    if (this.ticker.reducedMotion) { this.stage.set(4); return; }
    // the ticker only runs while the section is on screen, so the loop pauses off-screen by itself
    this.off = this.ticker.register(sec, dt => {
      if (this.paused()) {
        this.resumeAt -= dt;
        if (this.resumeAt > 0) return;
        this.zone.run(() => this.paused.set(false));
        this.clock = (this.stage() - 1) * T;
      }
      this.clock = (this.clock + dt) % cycle;
      const st = Math.min(4, 1 + Math.floor(this.clock / T));
      if (st !== this.stage()) this.zone.run(() => this.stage.set(st));
    });
  }

  /** a click shows that stage and holds it for a moment before the loop carries on */
  show(i: number): void {
    this.stage.set(i);
    this.paused.set(true);
    this.resumeAt = 7;
  }

  ngOnDestroy(): void { this.off?.(); }
}
