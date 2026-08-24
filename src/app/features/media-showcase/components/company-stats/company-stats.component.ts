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
        <span class="stat-value">{{ stat.value }}{{ stat.suffix }}</span>
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
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
    }

    .stat-value {
      font-size: clamp(1.75rem, 4vw, 2.5rem); /* large, dominant number */
      font-weight: 800;
      line-height: 1;
      color: #1e3a8a; /* professional corporate blue (blue-900) */
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
      letter-spacing: -0.01em;
    }

    .stat-label {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.82);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }

    @media (min-width: 768px) {
      .company-stats {
        grid-template-columns: repeat(4, 1fr);
        gap: 1.5rem 3rem;
      }

      .stat-label {
        font-size: 0.8rem;
      }
    }
  `]
})
export class CompanyStatsComponent {
  @Input() stats: CompanyStat[] = [];
}
