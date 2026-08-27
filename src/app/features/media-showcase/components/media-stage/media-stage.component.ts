import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  HostListener,
  signal
} from '@angular/core';
import { MediaItem } from '../../models/media-item.model';

/** Small in-memory cache so the browser never re-fetches an already seen slide. */
const imageStates = new Map<string, 'loading' | 'loaded' | 'error'>();

/** Returns the responsive `srcset` for a base WebP path (<base> -1280/-768). */
function responsiveSrcSet(base: string): string {
  if (base.includes('.webp')) {
    const root = base.replace(/\.webp$/, '');
    return `${base} 1920w, ${root}-1280.webp 1280w, ${root}-768.webp 768w`;
  }
  return base;
}

/**
 * Pure presentational media renderer for the showcase.
 *
 * Shows exactly one slide at a time:
 *  - a still image, or
 *  - a video (muted, plays inline) that emits `videoEnded` so the service
 *    advances when the video finishes.
 *
 * The video carries the `autoplay` attribute in the template, so a freshly
 * created `<video>` element always starts playing from the beginning whenever
 * the gallery returns to a video slide (both automatic wrap-around and manual
 * first-dot selection).
 *
 * The component does not own business logic (timers, pause, indexing);
 * it receives the index and media list via inputs and reports purely
 * user/media events up to the parent.
 */
@Component({
  selector: 'app-media-stage',
  standalone: true,
  imports: [],
  templateUrl: './media-stage.component.html',
  styleUrl: './media-stage.component.css'
})
export class MediaStageComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() media: MediaItem[] = [];
  @Input() currentIndex = 0;
  @Output() videoEnded = new EventEmitter<string>();
  /** Emitted once when the local hero video fails to load (fallback path). */
  @Output() videoError = new EventEmitter<void>();

  @ViewChild('videoRef') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('ytFrame') ytFrameRef?: ElementRef<HTMLIFrameElement>;

  /** True when the video was playing right before the showcase left the viewport. */
  private wasPlayingBeforeHide = false;

  /**
   * User mute preference for the showcase video. The professional default is
   * muted; the preference survives slide changes and is never force-reset.
   */
  readonly isMuted = signal(true);

  /** Honors `prefers-reduced-motion`: keep the video as a calm poster. */
  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** True while the active slide is the hero video (drives the mute toggle). */
  toggleMute(): void {
    const video = this.videoRef?.nativeElement;
    if (!video) {
      return;
    }
    const next = !this.isMuted();
    this.isMuted.set(next);
    video.muted = next;
  }

  /** True when the user has activated the (deferred) YouTube player. */
  readonly youtubeActive = signal(false);

  /**
   * The first showcased slide is the LCP image: it must load eagerly with a
   * high fetch priority. All later slides are lazy / low priority.
   */
  isFirstVisible(): boolean {
    return this.currentIndex === 0;
  }

  imgSrc(src: string): string {
    return src;
  }

  imgSrcSet(src: string): string {
    return responsiveSrcSet(src);
  }

  imgFailed(src: string): boolean {
    return imageStates.get(src) === 'error';
  }

  onImgError(src: string): void {
    imageStates.set(src, 'error');
  }

  markLoaded(src: string): void {
    if (src && imageStates.get(src) !== 'error') {
      imageStates.set(src, 'loaded');
    }
  }

  /** Deferred activation: mount the YouTube iframe only when requested. */
  activateYoutube(): void {
    if (this.activeMedia()?.provider !== 'youtube') {
      return;
    }
    this.youtubeActive.set(true);
  }

  youtubeSrc(videoId: string): string {
    return (
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
      `?autoplay=1&mute=1&playsinline=1&rel=0`
    );
  }

  /** Preload only the *next* slide (never the whole gallery). */
  @HostListener('window:message', ['$event'])
  onWindowMessage(event: MessageEvent): void {
    if (event.source !== this.ytFrameRef?.nativeElement?.contentWindow) {
      return;
    }
    try {
      const data = JSON.parse(event.data as string);
      // YouTube player API -> onStateChange(0) = ended.
      if (
        data?.event === 'onStateChange' &&
        data.info === 0
      ) {
        this.onVideoEnded();
      }
    } catch {
      // Not a YouTube API message; ignore.
    }
  }

  activeMedia(): MediaItem | null {
    return this.media[this.currentIndex] ?? null;
  }

  /** Last video source that already reported an error (prevents emit loops). */
  private lastErroredSrc: string | null = null;

  /**
   * The hero video failed to load — never leave a black/empty stage.
   * Reports upward so the showcase can fall back to the first image.
   * Emits at most once per source so no navigation loop can occur.
   */
  onVideoError(): void {
    const current = this.activeMedia();
    const src = current?.type === 'video' ? current.src : null;
    if (!src || this.lastErroredSrc === src) {
      return;
    }
    this.lastErroredSrc = src;
    this.videoError.emit();
  }

  onVideoEnded(): void {
    const id = this.activeMedia()?.id;
    if (id) {
      this.videoEnded.emit(id);
    }
  }

  /**
   * Pause the current video because the showcase left the viewport.
   * Records whether it was actually playing so an automatic resume can
   * respect a manual user pause. The element and its position are untouched.
   */
  pauseForVisibility(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || video.paused || video.ended) {
      this.wasPlayingBeforeHide = false;
      return;
    }
    this.wasPlayingBeforeHide = true;
    video.pause();
  }

  /**
   * Resume after the showcase became visible again — only when the video was
   * playing before it was hidden. Never rewinds or reloads the media.
   */
  resumeFromVisibility(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || !this.wasPlayingBeforeHide) {
      return;
    }
    this.wasPlayingBeforeHide = false;
    void video.play().catch(() => {
      // Autoplay restrictions can still block playback; fail silently.
    });
  }

  ngAfterViewInit(): void {
    this.syncPlayback();
  }

  /** On slide change: reset the deferred YouTube state and preload the next. */
  ngOnChanges(): void {
    this.youtubeActive.set(false);
    this.preloadNext();
  }

  ngOnDestroy(): void {
    // Nothing to clean up; the DOM video is removed with the component.
  }

  /** Preload the next slide image so transitions are instant (no blank frame). */
  private preloadNext(): void {
    const nextIndex = this.currentIndex + 1;
    const next = this.media[nextIndex] ?? this.media[0];
    const src = next?.type === 'image' ? next.src : next?.poster;
    if (!src || imageStates.get(src) === 'loaded' || imageStates.get(src) === 'error') {
      return;
    }
    if (typeof Image === 'undefined') {
      return;
    }
    const pre = new Image();
    pre.onload = () => {
      imageStates.set(src, 'loaded');
    };
    pre.src = src;
  }

  private syncPlayback(): void {
    const video = this.videoRef?.nativeElement;
    const current = this.activeMedia();
    if (!video || !current || current.type !== 'video') {
      return;
    }
    // Respect reduced-motion: keep the calibrated poster, never force playback.
    if (this.reducedMotion) {
      video.muted = true;
      return;
    }
    // Belt-and-suspenders: the template's `autoplay` handles this for freshly
    // created elements; this ensures the initial activation also plays. The
    // video always starts from the beginning — no saved position is restored.
    void video.play().catch(() => {
      // Autoplay may be blocked by the browser; the poster remains visible.
    });
  }
}
