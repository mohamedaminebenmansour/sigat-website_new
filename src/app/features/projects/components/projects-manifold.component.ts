import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface ManifoldBranch { key: string; labelKey: string; count: number; }

/**
 * FILTER = a distribution manifold.
 * One header pipe, one branch per category, each with a gate valve. Opening
 * a valve turns its handwheel several times (a real gate valve is
 * multi-turn) and the water is routed down that branch only. The open
 * branch feeds the project list below.
 */
@Component({
  selector: 'app-projects-manifold',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="mf" role="radiogroup" [attr.aria-label]="'pj_filter_label' | translate">
      <svg class="mf__svg" viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true">
        <path class="mf__pipe" d="M0 34 H600" vector-effect="non-scaling-stroke" />
        <path class="mf__water mf__water--header" d="M0 34 H600" vector-effect="non-scaling-stroke" />
        @for (b of branches(); track b.key; let i = $index) {
          <path class="mf__pipe" [attr.d]="branchPath(i)" vector-effect="non-scaling-stroke" />
          <path class="mf__water" [class.is-open]="b.key === active()" [attr.d]="branchPath(i)" pathLength="1" vector-effect="non-scaling-stroke" />
        }
      </svg>
      <div class="mf__valves">
        @for (b of branches(); track b.key) {
          <button type="button" role="radio" class="mf__valve" [class.is-open]="b.key === active()"
                  [attr.aria-checked]="b.key === active()" (click)="pick.emit(b.key)">
            <svg class="mf__wheel" viewBox="-30 -30 60 60" aria-hidden="true">
              <circle r="25" class="mf__rim" />
              @for (a of spokes; track a) { <line x1="0" y1="0" x2="0" y2="-23" [attr.transform]="'rotate(' + a + ')'" /> }
              <circle r="6" class="mf__hub" />
            </svg>
            <span class="mf__label">{{ b.labelKey | translate }} <b>{{ b.count }}</b></span>
          </button>
        }
      </div>
    </div>
  `
})
export class ProjectsManifoldComponent {
  readonly branches = input.required<ManifoldBranch[]>();
  readonly active = input.required<string>();
  readonly pick = output<string>();
  readonly spokes = [0, 72, 144, 216, 288];

  branchPath(i: number): string {
    const n = this.branches().length;
    const x = ((i + 0.5) / n) * 600;
    return `M${x} 34 V150`;
  }
}
