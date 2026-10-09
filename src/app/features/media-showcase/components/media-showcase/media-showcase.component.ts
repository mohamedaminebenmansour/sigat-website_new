import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { MediaShowcaseService } from '../../services/media-showcase.service';
import { SHOWCASE_MEDIA } from '../../data/media.data';
import { SHOWCASE_SOCIAL_LINKS } from '../../data/social-links.data';
import { MediaStageComponent } from '../media-stage/media-stage.component';
import { MediaNavigationComponent } from '../media-navigation/media-navigation.component';
import { SocialLinksComponent } from '../social-links/social-links.component';

/**
 * Minimum visible fraction of the showcase for which the hero video may play.
 * Shared by the IntersectionObserver thresholds and the ratio check so the
 * pause/resume behaviour stays in one place.
 */
const VISIBILITY_THRESHOLD = 0.4;

@Component({
  selector: 'app-media-showcase',
  standalone: true,
  imports: [
    MediaStageComponent,
    MediaNavigationComponent,
    SocialLinksComponent
  ],
  template: `
    <div
      class="media-showcase"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      role="region"
      aria-label="Media showcase"
    >
      <div class="showcase-grid">
        <div class="showcase-nav">
          <app-media-navigation
            [items]="media"
            [currentIndex]="service.currentIndex()"
            (select)="onSelectSlide($event)"
            (previous)="onPreviousMedia()"
            (next)="onNextMedia()"
          />
        </div>

        <div class="showcase-stage">
          <app-media-stage
            #stage
            [media]="media"
            [currentIndex]="service.currentIndex()"
            (videoEnded)="onVideoEnded($event)"
            (videoError)="onVideoError()"
          />
        </div>

        <div class="showcase-social">
          <app-social-links [links]="socialLinks" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .media-showcase {
        position: relative;
        width: 100%;
        height: 100svh;
        background: #000;
        overflow: hidden;
      }

      .showcase-grid {
        position: relative;
        height: 100%;
      }

      .showcase-stage {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .showcase-nav {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        padding: 1.5rem;
      }

      .showcase-social {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        padding: 1.5rem;
      }

      @media (max-width: 767px) {
        /* Mobile composition: .media-showcase = flex column with the media
           zone (.showcase-grid) filling the available height. The navigation
           pill is anchored to the BOTTOM of the media zone, while the water
           stats band (the showcase's next sibling) overlaps the very bottom
           edge from outside — so the two can never collide regardless of
           viewport height or orientation. */
        .media-showcase {
          display: flex;
          flex-direction: column;
          height: 100svh;
          overflow: hidden;
        }

        .showcase-grid {
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          height: auto;
        }

        .showcase-stage {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        /* Horizontal ← ● ● ● → pill at the bottom of the media zone, above
           the statistics row by construction. */
        .showcase-nav {
          position: absolute;
          left: 50%;
          right: auto;
          top: auto;
          bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          padding: 0;
          align-items: center;
          z-index: 20;
        }

        /* Social lives inside the media zone with a committed offset below
           the header safe area, so it can never overlap the navbar/menu. */
        .showcase-social {
          position: absolute;
          inset-inline-end: 0.75rem;
          top: calc(6.75rem + env(safe-area-inset-top, 0px));
          bottom: auto;
          padding: 0;
          align-items: flex-start;
          z-index: 20;
        }

        /* Squat / landscape screens: drop the decorative social pill so the
           nav + media + stats composition stays clean. */
        @media (max-height: 480px) {
          .showcase-social {
            display: none;
          }
        }
      }

      @media (min-width: 768px) and (max-width: 1024px) {
        /* Tablet hybrid: same desktop zones, tighter and touch friendly. */
        .showcase-nav {
          padding-inline-start: 1.75rem;
        }

        .showcase-social {
          padding-inline-end: 1.75rem;
        }
      }
    `
  ]
})
export class MediaShowcaseComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly media = SHOWCASE_MEDIA;
  readonly socialLinks = SHOWCASE_SOCIAL_LINKS;

  /** Media stage hosting the active <video> element (visibility playback). */
  @ViewChild('stage') stageRef?: MediaStageComponent;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private intersectionObserver: IntersectionObserver | null = null;

  /**
   * Hover pause only makes sense on devices with a real pointer; touch
   * devices synthesize mouseenter/mouseleave in confusing ways.
   */
  private readonly hoverCapable =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover)').matches;

  constructor(readonly service: MediaShowcaseService) {}

  ngOnInit(): void {
    this.service.setMedia(this.media);
    this.setupVisibilityObserver();
  }

  ngAfterViewInit(): void {
    // Re-evaluate once the stage exists (e.g. the showcase mounts already
    // scrolled out of view).
    this.syncVideoVisibility();
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.service.clear();
  }

  onSelectSlide(index: number): void {
    this.service.goToSlide(index);
  }

  onPreviousMedia(): void {
    const total = this.media.length;
    if (total === 0) {
      return;
    }
    // Wrapping semantics mirror the service's own next().
    const target = (this.service.currentIndex() - 1 + total) % total;
    this.service.goToSlide(target);
  }

  onNextMedia(): void {
    this.service.next();
  }

  onVideoEnded(mediaId: string): void {
    this.service.onVideoEnded(mediaId);
  }

  /** The hero video failed to load — continue gracefully from the first image. */
  onVideoError(): void {
    if (this.service.currentIndex() === 0 && this.media.length > 1) {
      this.service.goToSlide(1);
    }
  }

  onMouseEnter(): void {
    if (!this.hoverCapable) {
      return;
    }
    this.service.pause();
  }

  onMouseLeave(): void {
    if (!this.hoverCapable) {
      return;
    }
    this.service.resume();
  }

  /**
   * Pause/resume the video based on how much of the showcase is visible.
   * The observer is registered outside the Angular zone; the stage owns the
   * playback state so a manual user pause is never overridden.
   */
  private setupVisibilityObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    this.intersectionObserver = new IntersectionObserver(
      () => this.syncVideoVisibility(),
      { threshold: [0, VISIBILITY_THRESHOLD, 1] }
    );
    this.zone.runOutsideAngular(() =>
      this.intersectionObserver?.observe(this.host.nativeElement)
    );

    this.destroyRef.onDestroy(() => {
      this.intersectionObserver?.disconnect();
      this.intersectionObserver = null;
    });
  }

  private syncVideoVisibility(): void {
    const stage = this.stageRef;
    if (!stage || !this.host?.nativeElement) {
      return;
    }
    let ratio = 0;
    try {
      const bounds = this.host.nativeElement.getBoundingClientRect();
      const viewportHeight = document.documentElement?.clientHeight || window.innerHeight || 0;
      if (viewportHeight > 0) {
        ratio = Math.min(1, Math.max(0, Math.min(bounds.bottom, viewportHeight) - Math.max(bounds.top, 0)) / viewportHeight);
      }
    } catch {
      return;
    }
    if (ratio < VISIBILITY_THRESHOLD) {
      stage.pauseForVisibility();
    } else {
      stage.resumeFromVisibility();
    }
  }
}
