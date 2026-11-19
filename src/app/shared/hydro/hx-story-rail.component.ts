import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface StoryChapter { id: string; labelKey: string; }

/**
 * The page as one pipeline: a glass pipe on the side fills with water as
 * the visitor scrolls, and every chapter is a junction on that pipe.
 * Reusable on any page — pass the section ids in reading order.
 */
@Component({
  selector: 'app-hx-story-rail',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <nav #rail class="hx-rail" [attr.aria-label]="'hx_rail_label' | translate">
      <span class="hx-rail__pipe" aria-hidden="true"><span class="hx-rail__water"></span></span>
      <ol>
        @for (c of chapters(); track c.id; let i = $index) {
          <li>
            <button type="button" class="hx-rail__node" [attr.data-i]="i" (click)="go(c.id)">
              <span class="hx-rail__dot" aria-hidden="true"></span>
              <span class="hx-rail__label"><b>{{ (i + 1).toString().padStart(2, '0') }}</b> {{ c.labelKey | translate }}</span>
            </button>
          </li>
        }
      </ol>
    </nav>
  `
})
export class HxStoryRailComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  readonly chapters = input.required<StoryChapter[]>();
  @ViewChild('rail', { static: true }) rail!: ElementRef<HTMLElement>;
  private raf = 0;

  private onScroll = () => {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    this.update();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    cancelAnimationFrame(this.raf);
  }

  go(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private update(): void {
    const vh = window.innerHeight;
    const ids = this.chapters().map(c => c.id);
    const tops = ids.map(id => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity);
    let active = 0;
    tops.forEach((t, i) => { if (t <= vh * 0.5) active = i; });
    // Water level: whole chapters + fraction of the current one.
    const next = tops[active + 1];
    const cur = tops[active];
    const frac = next !== undefined && isFinite(next) ? Math.min(1, Math.max(0, (vh * 0.5 - cur) / (next - cur))) : 0;
    const fill = ids.length > 1 ? Math.min(1, (active + frac) / (ids.length - 1)) : 1;
    const el = this.rail.nativeElement;
    el.style.setProperty('--fill', fill.toFixed(4));
    el.querySelectorAll<HTMLElement>('.hx-rail__node').forEach((n, i) => {
      n.classList.toggle('is-wet', i <= active);
      n.classList.toggle('is-active', i === active);
      if (i === active) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
    });
    // Light chapters need a dark rail; deep ones a light rail.
    const sec = document.getElementById(ids[active]);
    el.classList.toggle('is-dark', !sec?.matches('.hx-ch--deep, .hx-hero, .hx-tap'));
  }
}
