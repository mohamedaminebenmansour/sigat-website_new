import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaItem } from '../../models/media-item.model';

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
  imports: [CommonModule],
  templateUrl: './media-stage.component.html',
  styleUrl: './media-stage.component.css'
})
export class MediaStageComponent implements AfterViewInit, OnDestroy {
  @Input() media: MediaItem[] = [];
  @Input() currentIndex = 0;
  @Output() videoEnded = new EventEmitter<string>();

  @ViewChild('videoRef') videoRef?: ElementRef<HTMLVideoElement>;

  /** True when the video was playing right before the showcase left the viewport. */
  private wasPlayingBeforeHide = false;

  activeMedia(): MediaItem | null {
    return this.media[this.currentIndex] ?? null;
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

  ngOnDestroy(): void {
    // Nothing to clean up; the DOM video is removed with the component.
  }

  private syncPlayback(): void {
    const video = this.videoRef?.nativeElement;
    const current = this.activeMedia();
    if (!video || !current || current.type !== 'video') {
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
