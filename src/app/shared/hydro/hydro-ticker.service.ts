import { Injectable, NgZone, inject } from '@angular/core';

export type TickFn = (dt: number, time: number) => void;

interface Sub { el: Element; fn: TickFn; visible: boolean; }

/**
 * One shared requestAnimationFrame loop for every hydraulic animation.
 *
 *  - Runs outside Angular's zone (no change detection per frame).
 *  - A callback only runs while its host element is near the viewport.
 *  - The loop sleeps completely when nothing is visible or the tab is hidden.
 */
@Injectable({ providedIn: 'root' })
export class HydroTicker {
  private readonly zone = inject(NgZone);
  private readonly subs = new Set<Sub>();
  private io?: IntersectionObserver;
  private raf = 0;
  private last = 0;
  private time = 0;

  readonly reducedMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.wake());
    }
  }

  /** Register a per-frame callback bound to an element's visibility. Returns an unsubscribe fn. */
  register(el: Element, fn: TickFn): () => void {
    const sub: Sub = { el, fn, visible: false };
    this.subs.add(sub);
    this.observer()?.observe(el);
    return () => {
      this.subs.delete(sub);
      if (![...this.subs].some(s => s.el === el)) this.io?.unobserve(el);
    };
  }

  private observer(): IntersectionObserver | undefined {
    if (this.io || typeof IntersectionObserver === 'undefined') return this.io;
    this.io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          for (const s of this.subs) if (s.el === e.target) s.visible = e.isIntersecting;
        }
        this.wake();
      },
      { rootMargin: '120px 0px' }
    );
    return this.io;
  }

  private wake(): void {
    if (this.raf || document.hidden) return;
    if (![...this.subs].some(s => s.visible)) return;
    this.zone.runOutsideAngular(() => {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    });
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(1 / 24, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    let any = false;
    for (const s of this.subs) {
      if (!s.visible) continue;
      any = true;
      s.fn(this.reducedMotion ? 0 : dt, this.time);
    }
    if (any && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  };
}
