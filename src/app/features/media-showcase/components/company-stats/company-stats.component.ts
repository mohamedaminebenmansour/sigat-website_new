import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { CompanyStat } from '../../models/company-stat.model';

@Component({
  selector: 'app-company-stats',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="company-stats" aria-label="Company statistics">
      <div class="stat-item" *ngFor="let stat of stats">
        <span class="stat-figure">
          @if (stat.icon) {
            <span class="stat-icon" aria-hidden="true">
              <i [class]="stat.icon"></i>
            </span>
          }
          <span class="stat-value">{{ stat.value }}<span class="stat-suffix">{{ stat.suffix }}</span></span>
        </span>
        <span class="stat-label">{{ stat.labelKey | translate }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .company-stats {
      /* Centered, width-constrained group with balanced side margins. */
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem 2rem;
      width: 100%;
      max-width: 56rem;
      margin-inline: auto; /* RTL-safe horizontal centering */
      padding-inline: 1rem;
      text-align: center;
      z-index: 20;
    }

    .stat-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
    }

    /* Icon + value row; flex mirrors RTL. */
    .stat-figure {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .stat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.15rem;
      height: 2.15rem;
      border-radius: 50%;
      background: #60a5fa29;
      border: 1px solid #93c5fd47;
      color: #bfdbfe;
      transition: transform .25s ease-out, opacity .25s ease-out;
    }

    .stat-icon i {
      font-size: 0.95rem;
      line-height: 1;
    }

    @media (hover: hover) {
      .stat-item:hover .stat-icon {
        transform: scale(1.06);
        opacity: 0.92;
      }
    }

    .stat-value {
      font-size: clamp(1.75rem, 4vw, 2.5rem); /* large, dominant number */
      font-weight: 800;
      line-height: 1;
      color: #1e3a8a; /* professional corporate blue (blue-900) */
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
      white-space: nowrap; /* keep number + suffix visually connected */
    }

    .stat-suffix {
      font-size: 0.72em;
      font-weight: 700;
      color: #f97316; /* SIGAT accent, matching the shared stat counter */
    }

    .stat-label {
      margin-top: 0.5rem;
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.82);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }

    @media (min-width: 768px) {
      .company-stats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.5rem 1rem;
        max-width: 70rem;
      }

      .stat-label {
        font-size: 0.8rem;
      }
    }

    @media (min-width: 768px) and (max-width: 1023px) {
      /* Tablet: four columns fit with tighter sizing. */
      .company-stats {
        gap: 1.1rem 0.75rem;
      }

      .stat-icon {
        width: 2rem;
        height: 2rem;
      }

      .stat-icon i {
        font-size: 0.9rem;
      }

      .stat-value {
        font-size: 1.9rem;
      }

      .stat-label {
        font-size: 0.7rem;
      }
    }

    /* Mobile: compact 2x2 block, no separators. */
    @media (max-width: 767px) {
      .company-stats {
        gap: 0.55rem 0.75rem;
        max-width: 24rem;
        padding-inline: 0.25rem;
      }

      .stat-icon {
        width: 1.9rem;
        height: 1.9rem;
      }

      .stat-icon i {
        font-size: 0.85rem;
      }

      .stat-value {
        font-size: 1.5rem;
      }

      .stat-label {
        font-size: 0.6rem;
        letter-spacing: 0.05em;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .stat-icon {
        transition: none;
      }

      .stat-item:hover .stat-icon {
        transform: none;
      }
    }
  `]
})
export class CompanyStatsComponent {
  @Input() stats: CompanyStat[] = [];
}
