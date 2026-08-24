import { Injectable, signal, computed, effect, OnDestroy } from '@angular/core';
import { MediaItem } from '../models/media-item.model';

/**
 * Single source of truth for the Home media showcase.
 *
 * Owns all media state:
 *  - the current slide index
 *  - pause/resume
 *  - image auto-advance timing
 *
 * The stream of truth is the media list plus the active index. Videos advance
 * only through their own `ended` event; images advance on a single timer that
 * is cleared and restarted whenever the active index changes.
 *
 * Components are presentational: they bind to signals and forward user
 * interaction here. Business logic stays in this service.
 */
@Injectable({ providedIn: 'root' })
export class MediaShowcaseService implements OnDestroy {
  /** How long a still image stays before auto-advancing. */
  private static readonly IMAGE_DURATION_MS = 6000;

  private media: MediaItem[] = [];
  private imageTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  readonly currentIndex = signal(0);
  readonly isPaused = signal(false);
  readonly isTransitioning = signal(false);

  readonly currentMedia = computed(() => this.media[this.currentIndex()] ?? null);
  readonly totalSlides = computed(() => this.media.length);
  readonly isVideo = computed(() => this.currentMedia()?.type === 'video');

  constructor() {
    // Whenever the active slide changes, (re)start the auto-advance timer.
    // For videos it is a no-op (videos advance only on `ended`).
    effect(() => {
      const idx = this.currentIndex();
      if (idx >= 0 && this.isStarted) {
        this.restartAutoPlay();
      }
    });
  }

  /**
   * True once the showcase has been initialised via setMedia, so the effect
   * does not start a timer before there is any media to show.
   */
  private isStarted = false;

  /**
   * Load the showcase media list and initialise the showcase.
   * Resets index/pause so the showcase starts from the video (index 0).
   */
  setMedia(items: MediaItem[]): void {
    this.media = items;
    this.clearImageTimer();
    this.currentIndex.set(0);
    this.isPaused.set(false);
    this.isTransitioning.set(false);
    this.isStarted = true;
  }

  /**
   * Tear down the showcase when its component is destroyed.
   * Stops timers and resets index/pause so the next visit starts fresh.
   */
  clear(): void {
    this.isStarted = false;
    this.clearImageTimer();
    this.currentIndex.set(0);
    this.isPaused.set(false);
    this.isTransitioning.set(false);
  }

  goToSlide(index: number): void {
    if (index === this.currentIndex()) {
      return;
    }
    this.isTransitioning.set(true);
    this.currentIndex.set(index);
    const timer = setTimeout(() => this.isTransitioning.set(false), 600);
    // Ensure the transition flag is always released even if component is gone.
    if (this.destroyed) {
      clearTimeout(timer);
    }
  }

  next(): void {
    if (this.media.length === 0) {
      return;
    }
    this.goToSlide((this.currentIndex() + 1) % this.media.length);
  }

  pause(): void {
    if (this.isPaused()) {
      return;
    }
    this.isPaused.set(true);
    this.clearImageTimer();
  }

  resume(): void {
    if (!this.isPaused()) {
      return;
    }
    this.isPaused.set(false);
    this.restartAutoPlay();
  }

  /** Called by the stage when the active video has finished playing. */
  onVideoEnded(mediaId: string): void {
    if (this.isPaused()) {
      return;
    }
    const current = this.media[this.currentIndex()];
    if (current && current.id === mediaId) {
      this.next();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearImageTimer();
  }

  /** Starts an image auto-advance when the current slide is a still image. */
  private startAutoPlay(): void {
    this.clearImageTimer();
    if (this.isPaused()) {
      return;
    }
    const slide = this.media[this.currentIndex()];
    if (!slide || slide.type !== 'image') {
      return;
    }
    this.imageTimer = setTimeout(() => {
      if (!this.destroyed && !this.isPaused()) {
        this.next();
      }
    }, MediaShowcaseService.IMAGE_DURATION_MS);
  }

  private restartAutoPlay(): void {
    this.clearImageTimer();
    this.startAutoPlay();
  }

  private clearImageTimer(): void {
    if (this.imageTimer) {
      clearTimeout(this.imageTimer);
      this.imageTimer = null;
    }
  }
}
