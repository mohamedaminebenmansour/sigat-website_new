import { Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Resolves when the water curtain fully covers the screen (null = no curtain). */
let coverPromise: Promise<boolean> | null = null;

/**
 * Router guard (canActivateChild): holds the route swap until the curtain
 * has covered the old page, so the change happens "under water".
 */
export const hxFlowGate = (): Promise<boolean> | boolean => coverPromise ?? true;

/**
 * Site-wide page transition: a wall of water rises over the old page,
 * the route swaps underneath, then the water keeps flowing up and away.
 * Every page change feels like the same continuous current.
 */
@Component({
  selector: 'app-hx-flow-transition',
  standalone: true,
  host: { class: 'hx-flow', 'aria-hidden': 'true' },
  template: `
    <div class="hx-flow__sheet">
      <svg class="hx-flow__edge hx-flow__edge--top" viewBox="0 0 1200 80" preserveAspectRatio="none">
        <path d="M0 80 V40 C150 0 300 0 450 40 S750 80 900 40 S1050 0 1200 40 V80Z" />
      </svg>
      <div class="hx-flow__body">
        <img src="assets/media/logo/sigatlogo-white-trim.png" alt="" class="hx-flow__logo" />
      </div>
      <svg class="hx-flow__edge hx-flow__edge--bottom" viewBox="0 0 1200 80" preserveAspectRatio="none">
        <path d="M0 0 V40 C150 80 300 80 450 40 S750 0 900 40 S1050 80 1200 40 V0Z" />
      </svg>
    </div>
  `
})
export class HxFlowTransitionComponent {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private coveredAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private static readonly COVER_MS = 520;

  constructor() {
    const router = inject(Router);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let first = true;

    router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(e => {
      if (reduce) return;
      if (e instanceof NavigationStart) {
        const nextPath = e.url.split(/[?#]/)[0];
        // Same page (fragment / query change) or initial load: no curtain.
        if (first || router.url.split(/[?#]/)[0] === nextPath) return;
        clearTimeout(this.timer);
        this.el.classList.remove('is-out');
        this.el.classList.add('is-in');
        this.coveredAt = performance.now() + HxFlowTransitionComponent.COVER_MS;
        coverPromise = new Promise(res => setTimeout(() => res(true), HxFlowTransitionComponent.COVER_MS));
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        first = false;
        coverPromise = null;
        if (!this.el.classList.contains('is-in')) return;
        const wait = Math.max(0, this.coveredAt - performance.now());
        this.timer = setTimeout(() => {
          this.el.classList.remove('is-in');
          this.el.classList.add('is-out');
          this.timer = setTimeout(() => this.el.classList.remove('is-out'), 760);
        }, wait);
      }
    });
  }
}
