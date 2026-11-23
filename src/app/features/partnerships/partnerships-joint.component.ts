import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../shared/hydro/hydro-ticker.service';
import { HxWaveEdgeComponent } from '../../shared/hydro/hx-wave-edge.component';

/**
 * PARTNERSHIPS · HOW WE WORK TOGETHER — a flanged joint made up the way it is on site.
 *   1 contact        the second spool is brought up to the first
 *   2 qualification  the gasket goes in between the faces
 *   3 first project  studs inserted, nuts tightened in the cross (star) pattern 1-5-3-7-2-6-4-8,
 *                    shown on the flange face; the faces close onto the gasket
 *   4 long term      water flows through the joint, the gauge holds the pressure, no leak
 * Scroll advances the stage; CSS transitions only (no SMIL); reduced motion = the finished joint.
 */
@Component({
  selector: 'app-partnerships-joint',
  standalone: true,
  imports: [TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section #sec class="crv pj-joint" [attr.data-stage]="stage()">
      <app-hx-wave-edge color="#eef6fd" back="#2f8fe0" [flip]="true" />
      <div class="hx-container crv__grid">
        <div class="crv__copy">
          <header class="hx-head">
            <p class="hx-eyebrow hx-eyebrow--light">{{ 'pt_proc_kicker' | translate }}</p>
            <h2 class="hx-h2 hx-display">{{ 'pt_proc_title' | translate }}</h2>
          </header>
          <ol class="crv__steps">
            @for (i of [1, 2, 3, 4]; track i) {
              <li [class.is-on]="stage() >= i">
                <span class="crv__mark" aria-hidden="true">{{ i }}</span>
                <span><b>{{ 'pt_proc_' + i + '_t' | translate }}</b><span>{{ 'pt_proc_' + i | translate }}</span></span>
              </li>
            }
          </ol>
        </div>

        <div class="jt__scene" aria-hidden="true">
          <svg viewBox="0 0 640 360">
            <line x1="0" y1="200" x2="640" y2="200" class="jt__axis" />
            <!-- left spool: pipe + flange, bore shown cut open -->
            <g>
              <rect x="10" y="170" width="250" height="60" rx="3" class="jt__pipe" />
              <rect x="10" y="180" width="250" height="40" class="jt__bore" />
              <rect x="10" y="180" width="250" height="40" class="jt__water" />
              <line x1="10" y1="200" x2="270" y2="200" class="jt__flow" />
              <rect x="250" y="120" width="18" height="160" rx="2" class="jt__flange" />
              <!-- pressure gauge on a tapping -->
              <line x1="120" y1="170" x2="120" y2="138" class="jt__stem" />
              <g transform="translate(120 124)"><circle r="15" class="jt__gauge" /><line x1="0" y1="0" x2="0" y2="-11" class="jt__needle" /><circle r="2" class="jt__hub" /></g>
            </g>
            <!-- gasket -->
            <rect x="268" y="138" width="5" height="124" class="jt__gasket" />
            <!-- right spool (slides in) -->
            <g class="jt__right">
              <rect x="273" y="120" width="18" height="160" rx="2" class="jt__flange" />
              <rect x="291" y="170" width="340" height="60" rx="3" class="jt__pipe" />
              <rect x="291" y="180" width="340" height="40" class="jt__bore" />
              <rect x="291" y="180" width="340" height="40" class="jt__water" />
              <line x1="273" y1="200" x2="640" y2="200" class="jt__flow" />
            </g>
            <!-- studs + nuts (seen from the side) -->
            <g class="jt__bolts">
              @for (y of [130, 160, 240, 270]; track y) {
                <rect x="236" [attr.y]="y - 3" width="72" height="6" class="jt__stud" />
                <rect x="240" [attr.y]="y - 6" width="9" height="12" class="jt__nut" />
                <rect class="jt__nut jt__nut--r" x="296" [attr.y]="y - 6" width="9" height="12" />
              }
            </g>
            <!-- flange face: 8 bolts tightened in the cross pattern -->
            <g transform="translate(540 92)" class="jt__face">
              <circle r="58" class="jt__flange" />
              <circle r="26" class="jt__bore" />
              @for (b of bolts; track b.pos) {
                <circle [attr.cx]="b.x" [attr.cy]="b.y" r="7" class="jt__hole" [style.transition-delay]="b.delay" />
              }
            </g>
          </svg>
        </div>
      </div>
      <app-hx-wave-edge color="#eaf5fd" back="#2f8fe0" />
    </section>
  `
})
export class PartnershipsJointComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  private readonly zone = inject(NgZone);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  readonly stage = signal(0);
  private off?: () => void;

  /** 8 bolts on the bolt circle; tightening order 1-5-3-7-2-6-4-8 (opposite pairs, then the quarter turns) */
  readonly bolts = (() => {
    const order = [0, 4, 2, 6, 1, 5, 3, 7];
    return Array.from({ length: 8 }, (_, pos) => {
      const a = -Math.PI / 2 + pos * Math.PI / 4;
      return { pos, x: +(Math.cos(a) * 42).toFixed(1), y: +(Math.sin(a) * 42).toFixed(1), delay: (order.indexOf(pos) * 0.18 + 0.4) + 's' };
    });
  })();

  ngAfterViewInit(): void {
    const sec = this.sec.nativeElement;
    this.off = this.ticker.register(sec, () => {
      const r = sec.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.75 - r.top) / Math.max(1, r.height * 0.85)));
      const s = this.ticker.reducedMotion ? 4 : Math.min(4, Math.floor(p * 4.6));
      if (s !== this.stage()) this.zone.run(() => this.stage.set(s));
    });
  }

  ngOnDestroy(): void { this.off?.(); }
}
