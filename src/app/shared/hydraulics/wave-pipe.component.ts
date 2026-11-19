import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { renderWavePipe } from './wave-pipe';
import { HydroTicker } from '../hydro/hydro-ticker.service';

/** Section divider: wavy glass pipe with flowing water and glowing couplings. */
@Component({
  selector: 'app-wave-pipe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full pointer-events-none', '[style.height.px]': 'height()' },
  template: '',
})
export class WavePipeComponent implements AfterViewInit, OnDestroy {
  readonly height = input(120);
  readonly amplitude = input(34);
  readonly radius = input(10);
  readonly phase = input(0.6);
  readonly speed = input(70);
  readonly fillAbove = input('');
  readonly fillBelow = input('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ticker = inject(HydroTicker);
  private ro?: ResizeObserver;
  private lastW = 0;
  private off?: () => void;
  private streaks: { el: SVGPathElement; v: number }[] = [];
  private t = 0;
  private acc = 0;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const host = this.el.nativeElement;
    const draw = () => {
      const w = host.clientWidth;
      if (w === this.lastW) return;
      this.lastW = w;
      renderWavePipe(host, {
        height: this.height(), amplitude: this.amplitude(), radius: this.radius(), phase: this.phase(),
        speed: this.speed(), fillAbove: this.fillAbove(), fillBelow: this.fillBelow(),
      });
      this.streaks = Array.from(host.querySelectorAll<SVGPathElement>('.wp-streak')).map(el => ({ el, v: Number(el.dataset['v'] ?? 60) }));
    };
    this.ro = new ResizeObserver(draw);
    this.ro.observe(host);
    draw();
    // foam streaks flow along the pipe: ~30 updates/s, only while the pipe is on screen
    this.off = this.ticker.register(host, dt => {
      this.t += dt; this.acc += dt;
      if (this.acc < 1 / 30) return;
      this.acc = 0;
      for (const s of this.streaks) s.el.setAttribute('stroke-dashoffset', (-this.t * s.v).toFixed(1));
    });
  }

  ngOnDestroy(): void { this.ro?.disconnect(); this.off?.(); }
}
