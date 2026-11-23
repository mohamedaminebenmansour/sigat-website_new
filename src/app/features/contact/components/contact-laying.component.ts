import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { PipeLayingEngine } from './pipe-laying-engine';

/** one site, start to finish (s); then the finished line is held and the next site begins */
const PLAY = 36, HOLD = 6, FADE = 0.8;

/**
 * CONTACT · HERO — "how SIGAT lays a water main", as a one-screen hero.
 * Title + actions on top; below, a wide live window on a real installation that plays by itself
 * (excavation → bedding → laying & jointing → thrust block → initial fill → pressure test → final fill),
 * holds the line in service, fades, and starts a new site. No scroll-driving, no step labels.
 * The physics lives in pipe-laying-engine.ts.
 */
@Component({
  selector: 'app-contact-laying',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section #sec class="lay" id="contact-hero" aria-labelledby="lay-title">
      <div class="lay__copy">
        <p class="lay__kicker">{{ 'contact_lay_eyebrow' | translate }}</p>
        <h1 id="lay-title" class="lay__title hx-display">{{ 'contact_hero_title' | translate }}</h1>
        <p class="lay__lead">{{ 'contact_hero_subtitle' | translate }}</p>
        <div class="lay__ctas">
          <a href="#project-inquiry" (click)="go($event, 'project-inquiry')" class="hx-btn hx-btn--primary">{{ 'contact_hero_btn_primary' | translate }}</a>
          <a href="#contact-office" (click)="go($event, 'contact-office')" class="lay__ghost">{{ 'contact_hero_btn_secondary' | translate }}</a>
        </div>
      </div>
      <div class="lay__site">
        <canvas #cv class="lay__cv" aria-hidden="true"></canvas>
      </div>
    </section>
  `
})
export class ContactLayingComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;

  private engine?: PipeLayingEngine;
  private off?: () => void;
  private ro?: ResizeObserver;
  private clock = 0;
  private alpha = 1;

  ngAfterViewInit(): void {
    const cv = this.cv.nativeElement, box = cv.parentElement!;
    const reduced = this.ticker.reducedMotion;
    this.engine = new PipeLayingEngine(cv, reduced);
    const fit = () => this.engine?.resize(box.clientWidth, box.clientHeight);
    fit();
    this.ro = new ResizeObserver(fit); this.ro.observe(box);
    this.off = this.ticker.register(this.sec.nativeElement, dt => {
      const e = this.engine!;
      // reduced motion: one still frame of the line under test pressure
      if (reduced) { e.frame(dt, 0.8); return; }
      this.clock += Math.min(dt, 1 / 30);
      const cycle = PLAY + HOLD;
      if (this.clock >= cycle) { this.clock -= cycle; e.restart(); }
      const c = this.clock;
      e.frame(dt, Math.min(1, c / PLAY));
      // fade out at the end of the hold, fade the fresh site in
      const a = c > cycle - FADE ? (cycle - c) / FADE : c < FADE ? c / FADE : 1;
      const q = Math.round(a * 20) / 20;
      if (q !== this.alpha) { this.alpha = q; cv.style.opacity = String(q); }
    });
  }

  ngOnDestroy(): void { this.off?.(); this.ro?.disconnect(); }

  go(e: Event, id: string): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: this.ticker.reducedMotion ? 'auto' : 'smooth' });
  }
}
