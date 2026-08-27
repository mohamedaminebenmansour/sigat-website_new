import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { ProjectMedia } from '../../core/models/project.model';

type DirName =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface Direction {
  dx: number;
  dy: number;
}

interface StackLayer {
  id: number;
  src: string;
  galleryIndex: number;
  /** Entrance direction (chosen once per transition). */
  dir: Direction;
  /** Exit direction (opposite entrance, so the photo passes through). */
  exit: Direction;
  rot: number;
  x: number;
  y: number;
  entering: boolean;
  leaving: boolean;
}

type Viewport = 'mobile' | 'tablet' | 'desktop';

/**
 * Direction map. Diagonal components are intentionally reduced so a
 * top-left/bottom-right entrance reads as a light slide, not a big jump.
 */
const D: Record<DirName, Direction> = {
  top: { dx: 0, dy: -1 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  'top-left': { dx: -0.72, dy: -0.72 },
  'top-right': { dx: 0.72, dy: -0.72 },
  'bottom-left': { dx: -0.72, dy: 0.72 },
  'bottom-right': { dx: 0.72, dy: 0.72 }
};

const opposite = (d: Direction): Direction => ({ dx: -d.dx, dy: -d.dy });

/** Deterministic (no Math.random) directional sequences per breakpoint. */
const DESKTOP_SEQ: DirName[] = [
  'right', 'top', 'bottom-left', 'left', 'top-right', 'bottom', 'top-left', 'bottom-right'
];
const TABLET_SEQ: DirName[] = [
  'top', 'bottom', 'right', 'bottom-left', 'left', 'top-right', 'bottom', 'top'
];
const MOBILE_SEQ: DirName[] = [
  'right', 'left', 'top', 'bottom', 'right', 'left', 'top', 'bottom'
];

/** Subtle synthetic resting rotations - never beyond +/-1.8deg. */
const ROTATIONS = [-1.8, 1.5, -1.2, 1.6, -1.4];

/**
 * Controlled placement slots (percentages of the container). Kept toward the
 * upper/right so the lower/left text safe-zone stays clear.
 */
const SLOTS: Record<Viewport, { x: number; y: number }[]> = {
  desktop: [
    { x: 62, y: 40 },
    { x: 52, y: 36 },
    { x: 68, y: 52 },
    { x: 56, y: 58 }
  ],
  tablet: [
    { x: 58, y: 42 },
    { x: 52, y: 52 },
    { x: 62, y: 46 }
  ],
  mobile: [{ x: 50, y: 46 }]
};

/* ------------------------------------------------------------------
 * Timing - configurable at a single location, not hardcoded throughout.
 * ------------------------------------------------------------------ */
const INITIAL_COVER_DELAY = 3000; // cover-only screen before gallery #1
const VISIBLE_MS = 4500; // how long each slide stays fully visible
const ENTER_FRAME_MS = 16; // kick frame so the CSS entrance transition starts
const EXIT_MS = 650; // exit transition length + removal cleanup
const INTERACTION_RESUME_MS = 6000; // auto-resume delay after user interaction

const pad2 = (n: number): string => String(n).padStart(2, '0');

let nextLayerId = 0;
@Component({
  selector: 'app-project-media-stack',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  styles: [
    `:host{display:block;position:relative;width:100%;height:100%;overflow:hidden}`
  ],
  template: `
    <div class="project-mstack"
         role="region"
         [attr.aria-roledescription]="'Gallery'"
         [attr.aria-label]="altLabel() + ' - gallery'"
         (mouseenter)="onMouseEnter()"
         (mouseleave)="onMouseLeave()"
         (pointerdown)="onPointerDown($event)"
         (pointerup)="onPointerUp($event)">

      @if (!coverFailed()) {
        <!-- Project hero / cover: permanent background, never in the gallery -->
        <img class="pms-cover" [src]="cover()" [srcset]="mediaSrcset(cover())"
             sizes="100vw" [alt]="altLabel() + ' - cover'"
             fetchpriority="high" (error)="onCoverError()" />
        <div class="pms-shade" aria-hidden="true"></div>
      } @else {
        <div class="pms-cover-fallback" aria-hidden="true"></div>
      }

      <!-- Foreground: ONE slide at a time (plus a transient outgoing layer) -->
      @for (layer of layers(); track layer.id) {
        <div class="pms-layer"
             [class.pms-layer--leaving]="layer.leaving"
             [style.left]="layer.x + '%'"
             [style.top]="layer.y + '%'"
             [style.transform]="layerTransform(layer)"
             [style.opacity]="layerOpacity(layer)"
             [attr.aria-hidden]="layer.leaving ? 'true' : null">
          <img [src]="layer.src" [srcset]="mediaSrcset(layer.src)" sizes="100vw"
                 [alt]="altFor(layer)"
                 loading="lazy" decoding="async" (error)="onLayerError(layer)" />
        </div>
      }

      <div class="pms-controls">
        <button type="button" class="pms-arrow pms-arrow-prev"
                (click)="previous()" aria-label="Previous photo">&#8249;</button>
        <span class="pms-count" aria-live="polite">{{ position() }}</span>
        <button type="button" class="pms-arrow pms-arrow-next"
                (click)="next()" aria-label="Next photo">&#8250;</button>
      </div>
    </div>
  `
})
export class ProjectMediaStackComponent implements OnInit {
  /** Project media manifest (single source of truth), owned by the page. */
  readonly media = input<ProjectMedia>();
  /** Human-readable label used to build meaningful alt text. */
  readonly altLabel = input<string>('Project photo');

  readonly layers = signal<StackLayer[]>([]);
  readonly coverFailed = signal(false);
  readonly cover = computed(() => this.media()?.cover ?? '');
  readonly gallery = computed(() => this.media()?.gallery ?? []);
  /** Compact counter, e.g. 03 / 08 */
  readonly position = signal('01 / 01');

  /** Responsive `srcset` for a WebP slide (uses the -1280 / -768 variants). */
  mediaSrcset(src: string): string {
    if (src.includes('.webp')) {
      const root = src.replace(/\.webp$/, '');
      return `${src} 1920w, ${root}-1280.webp 1280w, ${root}-768.webp 768w`;
    }
    return '';
  }

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private dirIndex = 0;
  private nextIndex = 0;
  private displayed = 0;
  private initialized = false;
  private viewport: Viewport = 'desktop';
  private reducedMotion = false;
  private hoverCapable = false;
  private hoverPaused = false;
  private visibilityPaused = false;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private exitTimers = new Set<ReturnType<typeof setTimeout>>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private startX = 0;
  private destroyed = false;

  constructor() {
    const w = typeof window;
    this.reducedMotion =
      w !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    this.hoverCapable =
      w !== 'undefined' && (window.matchMedia?.('(hover: hover)').matches ?? false);
    this.viewport = this.currentViewport();
    this.bindResize();
    this.bindVisibility();
    this.destroyRef.onDestroy(() => this.teardown());
  }

  ngOnInit(): void {
    this.resetAll();
  }

  /** Advance to the next slide (public API / control button). */
  next(): void {
    this.playAdvance(1);
  }

  /** Go back one slide (public API / control button). */
  previous(): void {
    this.playAdvance(-1);
  }

  onCoverError(): void {
    this.coverFailed.set(true);
  }

  onLayerError(layer: StackLayer): void {
    this.markLeaving(layer.id);
  }

  onMouseEnter(): void {
    if (this.hoverCapable) {
      this.hoverPaused = true;
      this.clearAuto();
    }
  }

  onMouseLeave(): void {
    if (this.hoverCapable) {
      this.hoverPaused = false;
      this.startGallery();
    }
  }

  onPointerDown(e: PointerEvent): void {
    this.startX = e.clientX;
  }

  onPointerUp(e: PointerEvent): void {
    const dx = e.clientX - this.startX;
    if (Math.abs(dx) > 40) {
      dx < 0 ? this.next() : this.previous();
    }
  }
  // ---------------------------------------------------------------------
  //  Layer transform/opacity (state -> CSS, no per-frame randomness)
  // ---------------------------------------------------------------------

  layerTransform(layer: StackLayer): string {
    let offX = 0;
    let offY = 0;
    let scale = 1;
    const amount = this.reducedMotion ? 0.06 : 1;
    if (layer.entering) {
      offX = layer.dir.dx * amount;
      offY = layer.dir.dy * amount;
      scale = 0.96;
    } else if (layer.leaving) {
      offX = layer.exit.dx * amount;
      offY = layer.exit.dy * amount;
    }
    return `translate(${offX}%, ${offY}%) translate(-50%, -50%) rotate(${layer.rot}deg) scale(${scale})`;
  }

  layerOpacity(layer: StackLayer): string {
    return layer.entering || layer.leaving ? '0' : '1';
  }

  altFor(layer: StackLayer): string {
    return `${this.altLabel()} - project documentation ${layer.galleryIndex + 1}`;
  }

  // ---------------------------------------------------------------------
  //  Core gallery logic
  // ---------------------------------------------------------------------

  private currentViewport(): Viewport {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    if (w <= 767) return 'mobile';
    if (w <= 1023) return 'tablet';
    return 'desktop';
  }

  private dirSeq(): DirName[] {
    if (this.viewport === 'mobile') return MOBILE_SEQ;
    if (this.viewport === 'tablet') return TABLET_SEQ;
    return DESKTOP_SEQ;
  }

  private resetAll(): void {
    this.coverFailed.set(false);
    this.nextIndex = 0;
    this.dirIndex = 0;
    this.initialized = false;
    this.layers.set([]);
    this.hoverPaused = false;
    this.visibilityPaused = false;
    this.updateCounter();
    this.startGallery();
  }

  /** Single chained auto-play timer. Always one timer at a time. */
  private startGallery(): void {
    this.clearAuto();
    if (this.destroyed || this.hoverPaused || this.visibilityPaused) return;
    const g = this.gallery();
    if (!g.length) return;

    if (!this.initialized) {
      this.initialized = true;
      this.preload(g[1] ?? g[0]); // prep the first gallery image during the cover delay
      this.autoTimer = setTimeout(() => {
        this.autoTimer = null;
        if (this.destroyed || this.hoverPaused || this.visibilityPaused) return;
        this.advanceDefault();
        this.startGallery();
      }, INITIAL_COVER_DELAY);
    } else {
      this.autoTimer = setTimeout(() => {
        this.autoTimer = null;
        if (this.destroyed || this.hoverPaused || this.visibilityPaused) return;
        this.advanceDefault();
        this.startGallery();
      }, VISIBLE_MS);
    }
  }

  private advanceDefault(): void {
    const g = this.gallery();
    if (!g.length) return;
    const gi = this.nextIndex % g.length;
    this.nextIndex = (gi + 1) % g.length;
    this.presentLayer(gi);
  }

  /** User-driven advance (button or swipe) pauses auto-play temporarily. */
  private playAdvance(step: number): void {
    const g = this.gallery();
    if (!g.length) return;
    this.pauseForInteraction();
    const len = g.length;
    let gi: number;
    if (step > 0) {
      gi = this.nextIndex % len;
      this.nextIndex = (gi + 1) % len;
    } else {
      this.nextIndex = (this.nextIndex - 1 + len) % len;
      gi = this.nextIndex;
    }
    this.presentLayer(gi);
  }

  private pauseForInteraction(): void {
    this.clearAuto();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.startGallery();
    }, INTERACTION_RESUME_MS);
  }

  /** Show gallery[gi]; retire the current slide via an animated exit. */
  private presentLayer(gi: number): void {
    this.expireCurrent();
    const layer = this.buildLayer(gi);
    this.layers.update((arr) => [layer, ...arr].slice(0, 2));
    this.settleEnter(layer.id);
    this.displayed = gi;
    const g = this.gallery();
    this.preload(g[(gi + 1) % g.length]);
    this.updateCounter();
  }

  private buildLayer(gi: number): StackLayer {
    const seq = this.dirSeq();
    const name = seq[this.dirIndex % seq.length];
    this.dirIndex++;
    const slots = SLOTS[this.viewport];
    const slot = slots[gi % slots.length];
    return {
      id: ++nextLayerId,
      src: this.gallery()[gi],
      galleryIndex: gi,
      dir: D[name],
      exit: opposite(D[name]),
      rot: ROTATIONS[this.dirIndex % ROTATIONS.length],
      x: slot.x,
      y: slot.y,
      entering: true,
      leaving: false
    };
  }

  /** Animate the current foreground slide out (exit), keep it for EXIT_MS. */
  private expireCurrent(): void {
    const arr = this.layers();
    const cur = arr.find((l) => !l.leaving);
    if (!cur) return;
    this.layers.update((list) =>
      list.map((l) => (l.id === cur.id ? { ...l, leaving: true } : l))
    );
    const t = setTimeout(() => this.removeLayer(cur.id), EXIT_MS);
    this.exitTimers.add(t);
  }

  /** After one frame the entering slide settles -> CSS animates it in. */
  private settleEnter(id: number): void {
    setTimeout(() => {
      this.layers.update((arr) =>
        arr.map((l) => (l.id === id ? { ...l, entering: false } : l))
      );
    }, ENTER_FRAME_MS);
  }

  private markLeaving(id: number): void {
    this.layers.update((arr) =>
      arr.map((l) => (l.id === id ? { ...l, leaving: true } : l))
    );
  }

  private removeLayer(id: number): void {
    this.layers.update((arr) => arr.filter((l) => l.id !== id));
  }

  private updateCounter(): void {
    const total = this.gallery().length;
    if (!total) return;
    const cur = (this.displayed % total) + 1;
    this.position.set(`${pad2(cur)} / ${pad2(total)}`);
  }

  private preload(src?: string): void {
    if (!src || typeof Image === 'undefined') return;
    const pre = new Image();
    pre.src = src;
  }

  // ---------------------------------------------------------------------
  //  Responsive / visibility / teardown
  // ---------------------------------------------------------------------

  private bindResize(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.viewport = this.currentViewport();
  };

  private bindVisibility(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(() => this.syncVisibility(), {
      threshold: [0, 0.45]
    });
    io.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  /** Pause auto-play when the hero is mostly out of view; resume when back. */
  private syncVisibility(): void {
    const el = this.host.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const covered =
      (Math.min(rect.bottom, vh) - Math.max(rect.top, 0)) / (rect.height || vh);
    if (covered >= 0.45) {
      this.visibilityPaused = false;
      this.startGallery();
    } else {
      this.visibilityPaused = true;
      this.clearAuto();
    }
  }

  private clearAuto(): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private teardown(): void {
    this.destroyed = true;
    this.clearAuto();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.exitTimers.forEach((t) => clearTimeout(t));
    this.exitTimers.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }
}