import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  IMAGE_LOADER,
  ImageLoader,
  ImageLoaderConfig,
  NgOptimizedImage,
} from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Direction a slide travels / enters from. Each transition uses a different
 * deterministic direction (see ENTRANCE_SEQUENCE) for an editorial feel.
 */
type SlideDirection =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** Deterministic, repeating entrance sequence (never random). */
const ENTRANCE_SEQUENCE: readonly SlideDirection[] = [
  'right',
  'bottom-left',
  'top',
  'left',
  'top-right',
  'bottom',
  'bottom-right',
  'top-left',
];

/** Exit direction is the mirror of the entrance so the slides wipe coherently. */
const EXIT_DIRECTION: Record<SlideDirection, SlideDirection> = {
  right: 'left',
  left: 'right',
  top: 'bottom',
  bottom: 'top',
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left',
};

/**
 * Typed gallery configuration. Add / remove / reorder entries here and the
 * gallery (counter, segments, preloading, autoplay) adapts automatically.
 */
interface StoryGalleryImage {
  readonly src: string;
  readonly alt: string;
  readonly objectPosition: string;
}

const GALLERY_IMAGES: readonly StoryGalleryImage[] = [
  {
    src: 'assets/media/company-story-gallery/story-01.webp',
    alt: 'SIGAT hydraulic infrastructure construction site',
    objectPosition: 'center center',
  },
  {
    src: 'assets/media/company-story-gallery/story-02.webp',
    alt: 'SIGAT pipeline installation project',
    objectPosition: 'center center',
  },
  {
    src: 'assets/media/company-story-gallery/story-03.webp',
    alt: 'SIGAT civil engineering works',
    objectPosition: 'center center',
  },
  {
    src: 'assets/media/company-story-gallery/story-04.webp',
    alt: 'SIGAT riprap and terrain stabilization',
    objectPosition: 'center center',
  },
];

/** Responsive candidates served by the loader (files: story-XX-768 / -1280). */
const IMAGE_SRCSET = '768w, 1280w';
const IMAGE_SIZES = '(min-width: 1280px) 600px, (min-width: 1024px) 52vw, 100vw';

/** Autoplay display duration per image (ms). */
const AUTOPLAY_MS = 3000;
/** CSS transition duration (must match --cs-transition in the stylesheet). */
const TRANSITION_MS = 800;
/** Commit delay when the user prefers reduced motion (opacity-only fade). */
const REDUCED_MOTION_TRANSITION_MS = 250;
/** Minimum horizontal distance for a swipe to be recognized. */
const SWIPE_THRESHOLD_PX = 48;

/**
 * Component-scoped loader: maps width candidates of NgOptimizedImage onto the
 * pre-generated responsive WebP files (story-01.webp -> story-01-768.webp).
 */
const responsiveWebpLoader: ImageLoader = (config: ImageLoaderConfig): string =>
  config.isPlaceholder || !config.width
    ? config.src
    : config.src.replace(/\.webp$/i, `-${config.width}.webp`);

@Component({
  selector: 'app-company-story',
  standalone: true,
  imports: [NgOptimizedImage, TranslatePipe],
  providers: [{ provide: IMAGE_LOADER, useValue: responsiveWebpLoader }],
  templateUrl: './company-story.component.html',
  styleUrl: './company-story.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyStoryComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly galleryRef = viewChild.required<ElementRef<HTMLElement>>('gallery');

  protected readonly images = GALLERY_IMAGES;
  protected readonly imageSrcset = IMAGE_SRCSET;
  protected readonly imageSizes = IMAGE_SIZES;

  /** Index of the image currently on display (rendered immediately). */
  protected readonly activeIndex = signal(0);
  /** Index of the image being preloaded / entering during a transition. */
  protected readonly preloadIndex = signal(GALLERY_IMAGES.length > 1 ? 1 : 0);
  /** Entrance direction of the slide that is transitioning in. */
  protected readonly entranceKey = signal<SlideDirection>('right');
  protected readonly isTransitioning = signal(false);

  protected readonly counter = computed(() => ({
    current: String(this.activeIndex() + 1).padStart(2, '0'),
    total: String(GALLERY_IMAGES.length).padStart(2, '0'),
  }));

  /** Class string for the slide currently on display. */
  protected readonly activeSlideClass = computed(() => {
    if (!this.isTransitioning()) {
      return 'cs-slide cs-slide--active';
    }
    return `cs-slide cs-slide--exit-${EXIT_DIRECTION[this.entranceKey()]}`;
  });

  /** Class string for the preload / entering slide layer. */
  protected readonly preloadSlideClass = computed(() => {
    if (!this.isTransitioning()) {
      return 'cs-slide cs-slide--hidden';
    }
    return `cs-slide cs-slide--enter-${this.entranceKey()}`;
  });

  private readonly loadedImages = new Set<number>();
  private readonly failedImages = new Set<number>();
  private readonly reducedMotion =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Navigation target waiting for its image to finish preloading. */
  private pendingIndex: number | null = null;
  private pointerStart: { x: number; y: number } | null = null;
  private inView = false;
  private hovered = false;
  private focused = false;
  private documentHidden =
    typeof document === 'undefined' ? false : document.visibilityState === 'hidden';

  constructor() {
    afterNextRender(() => {
      this.setupIntersectionObserver();
      this.setupVisibilityListener();
      this.scheduleAutoplay();
    });

    this.destroyRef.onDestroy(() => {
      this.clearAutoPlayTimer();
      this.clearTransitionTimer();
    });
  }

  // ------------------------------------------------------------------
  // Navigation (template API)
  // ------------------------------------------------------------------

  protected next(): void {
    this.goTo((this.activeIndex() + 1) % GALLERY_IMAGES.length);
  }

  protected previous(): void {
    this.goTo(
      (this.activeIndex() - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length,
    );
  }

  protected goToIndex(index: number): void {
    const current = this.activeIndex();
    if (index === current) {
      return;
    }
    this.goTo(index);
  }

  /**
   * Core navigation. The current image ALWAYS stays visible until the target
   * image is fully preloaded; only then does the CSS transition start.
   */
  private goTo(startIndex: number): void {
    if (this.isTransitioning()) {
      return;
    }
    const target = this.resolveTarget(startIndex);
    if (target === this.activeIndex()) {
      this.scheduleAutoplay();
      return;
    }

    this.entranceKey.set(ENTRANCE_SEQUENCE[target % ENTRANCE_SEQUENCE.length]);
    this.clearAutoPlayTimer();

    if (this.loadedImages.has(target)) {
      this.beginTransition(target);
      return;
    }

    // Not downloaded yet: keep the current image on screen and wait for load.
    this.pendingIndex = target;
    this.preloadIndex.set(target);
  }

  /** Skips images that previously failed to load. */
  private resolveTarget(startIndex: number): number {
    let candidate = startIndex;
    for (let attempt = 0; attempt < GALLERY_IMAGES.length; attempt++) {
      if (!this.failedImages.has(candidate)) {
        return candidate;
      }
      candidate = (candidate + 1) % GALLERY_IMAGES.length;
    }
    return startIndex;
  }

  protected onImageLoad(index: number): void {
    this.loadedImages.add(index);
    if (this.pendingIndex === index) {
      this.beginTransition(index);
    }
  }

  protected onImageError(index: number): void {
    this.failedImages.add(index);
    if (this.pendingIndex !== index) {
      return;
    }
    // Never show a blank gallery: fall through to the next healthy image.
    this.pendingIndex = null;
    const fallback = this.resolveTarget((index + 1) % GALLERY_IMAGES.length);
    if (!this.failedImages.has(fallback) && fallback !== this.activeIndex()) {
      this.pendingIndex = fallback;
      this.preloadIndex.set(fallback);
    }
  }

  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Autoplay (single timeout chain, never duplicated)
  // ------------------------------------------------------------------

  private scheduleAutoplay(): void {
    this.clearAutoPlayTimer();
    if (!this.canAutoplay()) {
      return;
    }
    this.autoPlayTimer = setTimeout(() => {
      this.autoPlayTimer = null;
      this.next();
    }, AUTOPLAY_MS);
  }

  private canAutoplay(): boolean {
    return (
      this.inView &&
      !this.hovered &&
      !this.focused &&
      !this.documentHidden &&
      !this.isTransitioning() &&
      this.pendingIndex === null &&
      this.failedImages.size < GALLERY_IMAGES.length
    );
  }

  // ------------------------------------------------------------------
  // Pause / resume triggers
  // ------------------------------------------------------------------

  protected onPointerEnter(): void {
    this.hovered = true;
    this.clearAutoPlayTimer();
  }

  protected onPointerLeave(): void {
    this.hovered = false;
    this.scheduleAutoplay();
  }

  protected onFocusIn(): void {
    this.focused = true;
    this.clearAutoPlayTimer();
  }

  protected onFocusOut(): void {
    this.focused = false;
    this.scheduleAutoplay();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  // ------------------------------------------------------------------
  // Swipe (pointer events, vertical page scroll untouched)
  // ------------------------------------------------------------------

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.pointerStart = { x: event.clientX, y: event.clientY };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!start || this.isTransitioning()) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }
    if (deltaX < 0) {
      this.next();
    } else {
      this.previous();
    }
  }

  protected onPointerCancel(): void {
    this.pointerStart = null;
  }

  // Transition state machine
  // ------------------------------------------------------------------

  private beginTransition(target: number): void {
    this.pendingIndex = null;
    this.clearTransitionTimer();
    this.isTransitioning.set(true);
    this.transitionTimer = setTimeout(
      () => this.commitTransition(target),
      this.reducedMotion ? REDUCED_MOTION_TRANSITION_MS : TRANSITION_MS,
    );
  }

  private commitTransition(target: number): void {
    this.transitionTimer = null;
    this.activeIndex.set(target);
    this.preloadIndex.set((target + 1) % GALLERY_IMAGES.length);
    this.isTransitioning.set(false);
    this.scheduleAutoplay();
  }

  // ------------------------------------------------------------------
  // Timer helpers (single instance each, cleared on destroy)
  // ------------------------------------------------------------------

  private clearAutoPlayTimer(): void {
    if (this.autoPlayTimer !== null) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // Visibility: pause autoplay when the gallery scrolls out of view
  // ------------------------------------------------------------------

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const gallery = this.galleryRef();
    if (!gallery) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const visible = Boolean(entries[0]?.isIntersecting);
        this.inView = visible;
        if (visible) {
          this.scheduleAutoplay();
        } else {
          this.clearAutoPlayTimer();
        }
      },
      { threshold: [0.35] },
    );
    io.observe(gallery.nativeElement);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  // ------------------------------------------------------------------
  // Hidden / background tab: pause autoplay, resume when visible again
  // ------------------------------------------------------------------

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const onChange = (): void => {
      this.documentHidden = document.visibilityState === 'hidden';
      if (this.documentHidden) {
        this.clearAutoPlayTimer();
      } else {
        this.scheduleAutoplay();
      }
    };
    document.addEventListener('visibilitychange', onChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onChange),
    );
  }
}

