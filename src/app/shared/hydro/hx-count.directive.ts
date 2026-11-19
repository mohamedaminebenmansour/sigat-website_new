import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

/** Counts a number up (ease-out) the first time the host is visible. */
@Directive({ selector: '[hxCount]', standalone: true })
export class HxCountDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  readonly hxCount = input.required<number>();
  readonly duration = input(2200);
  private io?: IntersectionObserver;
  private raf = 0;

  ngOnInit(): void {
    const host = this.el.nativeElement as HTMLElement;
    host.textContent = '0';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      this.io?.disconnect();
      if (reduce) { host.textContent = this.fmt(this.hxCount()); return; }
      const t0 = performance.now();
      const run = (now: number) => {
        const t = Math.min(1, (now - t0) / this.duration());
        host.textContent = this.fmt(Math.round(this.hxCount() * (1 - Math.pow(1 - t, 3))));
        if (t < 1) this.raf = requestAnimationFrame(run);
      };
      this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(run)));
    }, { threshold: 0.4 });
    this.io.observe(host);
  }

  private fmt(n: number): string {
    return n.toLocaleString('fr-FR');
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    cancelAnimationFrame(this.raf);
  }
}
