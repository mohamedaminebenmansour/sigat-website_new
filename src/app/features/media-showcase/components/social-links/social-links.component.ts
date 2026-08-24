import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SocialLink } from '../../models/social-link.model';

@Component({
  selector: 'app-social-links',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="social-links" aria-label="Social media links">
      <a
        *ngFor="let link of links"
        [href]="link.url"
        [attr.aria-label]="link.labelKey | translate"
        class="social-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i [class]="link.icon" aria-hidden="true"></i>
        <span class="social-label">{{ link.labelKey | translate }}</span>
      </a>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .social-links {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      z-index: 20;
    }

    .social-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      font-size: 0.8rem;
      transition: color 0.2s ease, transform 0.2s ease;
      padding: 0.35rem 0.5rem;
      border-radius: 0.375rem;
    }

    .social-link:hover {
      color: #fff;
      transform: translateY(-2px);
    }

    :host-context([dir='rtl']) .social-link:hover {
      transform: translateY(-2px);
    }

    .social-link i {
      font-size: 1rem;
      width: 1.25rem;
      text-align: center;
    }

    .social-label {
      white-space: nowrap;
    }

    @media (min-width: 768px) and (max-width: 1024px) {
      /* Tablet: keep the desktop right-hand rail but icon-only and tighter,
         so it never competes with navigation or statistics. */
      .social-links {
        gap: 0.85rem;
      }

      .social-label {
        display: none;
      }
    }

    @media (max-width: 767px) {
      /* Mobile: one quiet horizontal group (f in ◎) in its own safe area,
         clearly separated from the logo / hamburger zone above it. */
      .social-links {
        flex-direction: row;
        justify-content: center;
        gap: 0.35rem;
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        background: rgba(10, 20, 40, 0.32);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }

      .social-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.75rem;   /* >= 44px touch target */
        min-height: 2.75rem;
        border-radius: 999px;
      }

      .social-link i {
        font-size: 0.95rem;
      }
    }
  `]
})
export class SocialLinksComponent {
  @Input() links: SocialLink[] = [];
}
