import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { OutfallEngine } from './outfall-engine';

/**
 * HOME · LAST CHAPTER — the outfall: where SIGAT's water arrives.
 * A PE100 main (pipe only, owner's request: no concrete) discharges as a free overfall into the pool
 * (physics in outfall-engine.ts). Hovering / focusing "start a project" opens the flow further.
 * The pool's deep colour (#0b4c91) is handed to the footer.
 */
@Component({
  selector: 'app-home-outfall',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section #sec class="ho" id="ch-outfall" data-chapter="06" aria-labelledby="ho-title">
      <div class="ho__copy">
        <p class="hx-eyebrow">{{ 'hx_out_kicker' | translate }}</p>
        <h2 id="ho-title" class="hx-h2 hx-display">{{ 'hx_tap_title' | translate }}</h2>
        <p class="ho__lead">{{ 'hx_tap_text' | translate }}</p>
        <div class="ho__ctas">
          <a routerLink="/contact" class="hx-btn hx-btn--primary"
             (mouseenter)="demand(1.45)" (mouseleave)="demand(1)" (focus)="demand(1.45)" (blur)="demand(1)">
            {{ 'contact_hero_btn_primary' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
          <a routerLink="/partnerships" class="ho__ghost">{{ 'hx_tap_partner' | translate }}</a>
        </div>
      </div>
      <div class="ho__scene" (pointerdown)="poke($event)">
        <canvas #cv aria-hidden="true"></canvas>
      </div>
    </section>
  `
})
export class HomeOutfallComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  private engine?: OutfallEngine;
  private off?: () => void;
  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const cv = this.cv.nativeElement, box = cv.parentElement!;
    this.engine = new OutfallEngine(cv, this.ticker.reducedMotion);
    const fit = () => this.engine?.resize(box.clientWidth, box.clientHeight);
    fit();
    this.ro = new ResizeObserver(fit); this.ro.observe(box);
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.engine?.frame(dt));
  }

  ngOnDestroy(): void { this.off?.(); this.ro?.disconnect(); }

  demand(f: number): void { this.engine?.setDemand(f); }

  poke(e: PointerEvent): void {
    const r = this.cv.nativeElement.getBoundingClientRect();
    this.engine?.poke(e.clientX - r.left, e.clientY - r.top);
  }
}
