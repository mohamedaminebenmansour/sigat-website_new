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
      transform: translateX(-4px);
    }

    .social-link i {
      font-size: 1rem;
      width: 1.25rem;
      text-align: center;
    }

    .social-label {
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .social-links {
        flex-direction: row;
        justify-content: center;
        gap: 1.25rem;
      }

      .social-link:hover {
        transform: translateY(-2px);
      }

      .social-label {
        display: none;
      }
    }
  `]
})
export class SocialLinksComponent {
  @Input() links: SocialLink[] = [];
}
