import { Component, OnInit, OnDestroy } from '@angular/core';
import { MediaShowcaseService } from '../../services/media-showcase.service';
import { SHOWCASE_MEDIA } from '../../data/media.data';
import { SHOWCASE_SOCIAL_LINKS } from '../../data/social-links.data';
import { COMPANY_STATS } from '../../data/company-stats.data';
import { MediaStageComponent } from '../media-stage/media-stage.component';
import { MediaNavigationComponent } from '../media-navigation/media-navigation.component';
import { SocialLinksComponent } from '../social-links/social-links.component';
import { CompanyStatsComponent } from '../company-stats/company-stats.component';

@Component({
  selector: 'app-media-showcase',
  standalone: true,
  imports: [
    MediaStageComponent,
    MediaNavigationComponent,
    SocialLinksComponent,
    CompanyStatsComponent
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
          />
        </div>

        <div class="showcase-stage">
          <app-media-stage
            [media]="media"
            [currentIndex]="service.currentIndex()"
            (videoEnded)="onVideoEnded($event)"
          />
        </div>

        <div class="showcase-social">
          <app-social-links [links]="socialLinks" />
        </div>
      </div>

      <div class="showcase-footer">
        <app-company-stats [stats]="companyStats" />
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

      .showcase-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 20;
        padding: 1.5rem;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
      }

      @media (max-width: 768px) {
        .showcase-nav {
          position: absolute;
          top: auto;
          bottom: 6rem;
          left: 0;
          right: 0;
          padding: 0.75rem;
          align-items: flex-end;
        }

        .showcase-social {
          position: absolute;
          top: 1rem;
          bottom: auto;
          right: 1rem;
          padding: 0.5rem;
          align-items: flex-start;
        }

        .showcase-footer {
          padding: 1rem;
        }
      }
    `
  ]
})
export class MediaShowcaseComponent implements OnInit, OnDestroy {
  readonly media = SHOWCASE_MEDIA;
  readonly socialLinks = SHOWCASE_SOCIAL_LINKS;
  readonly companyStats = COMPANY_STATS;

  constructor(readonly service: MediaShowcaseService) {}

  ngOnInit(): void {
    this.service.setMedia(this.media);
  }

  ngOnDestroy(): void {
    this.service.clear();
  }

  onSelectSlide(index: number): void {
    this.service.goToSlide(index);
  }

  onVideoEnded(mediaId: string): void {
    this.service.onVideoEnded(mediaId);
  }

  onMouseEnter(): void {
    this.service.pause();
  }

  onMouseLeave(): void {
    this.service.resume();
  }
}
