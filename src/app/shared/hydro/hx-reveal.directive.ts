import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * Adds `is-in` to the host the first time it enters the viewport.
 * Pair with the `.hx-reveal` / `.hx-live` classes in styles/hydro.css.
 */
@Directive({ selector: '[hxReveal]', standalone: true })
export class HxRevealDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  /** Fraction of the element that must be visible. */
  readonly hxReveal = input<number | ''>('');
  private io?: IntersectionObserver;

  ngOnInit(): void {
    const host = this.el.nativeElement as HTMLElement;
    if (typeof IntersectionObserver === 'undefined') {
      host.classList.add('is-in');
      return;
    }
    const threshold = typeof this.hxReveal() === 'number' ? (this.hxReveal() as number) : 0.18;
    this.io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          host.classList.add('is-in');
          this.io?.disconnect();
        }
      },
      { threshold }
    );
    this.io.observe(host);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}
