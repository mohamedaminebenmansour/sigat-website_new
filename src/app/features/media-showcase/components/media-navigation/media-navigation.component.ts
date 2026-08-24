import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaItem } from '../../models/media-item.model';

@Component({
  selector: 'app-media-navigation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="media-navigation" aria-label="Media navigation">
      <button
        type="button"
        class="nav-arrow"
        (click)="previous.emit()"
        aria-label="Previous media"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <div class="nav-dots">
        @for (index of visibleIndexes(); track index) {
          <button
            type="button"
            class="nav-dot"
            [class.active]="currentIndex === index"
            (click)="select.emit(index)"
            [attr.aria-label]="'Go to media ' + (index + 1)"
            [attr.aria-current]="currentIndex === index ? 'true' : null"
          ></button>
        }
      </div>

      <button
        type="button"
        class="nav-arrow"
        (click)="next.emit()"
        aria-label="Next media"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Compact translucent control column: arrow / dots / arrow */
      .media-navigation {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem 0.45rem;
        border-radius: 999px;
        background: rgba(10, 20, 40, 0.32);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 20;
      }

      .nav-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: rgba(255, 255, 255, 0.72);
        cursor: pointer;
        transition: color 0.25s ease, background-color 0.25s ease;
      }

      /* Extends the hit area to >= ~48px without enlarging the visual arrow. */
      .nav-arrow::after {
        content: '';
        position: absolute;
        inset: -0.3rem;
      }

      .nav-arrow svg {
        width: 0.95rem;
        height: 0.95rem;
      }

      .nav-arrow:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.14);
      }

      .nav-arrow:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.8);
        outline-offset: 2px;
      }

      .nav-dots {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.55rem;
        padding: 0.15rem 0;
      }

      .nav-dot {
        position: relative;
        width: 0.55rem;
        height: 0.55rem;
        padding: 0;
        border: none;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.42);
        cursor: pointer;
        transition: all 0.28s ease;
        outline: none;
      }

      /* Larger invisible touch target around each small dot. */
      .nav-dot::after {
        content: '';
        position: absolute;
        inset: -0.45rem;
      }

      .nav-dot:hover {
        background: rgba(255, 255, 255, 0.85);
      }

      .nav-dot.active {
        background: #ffffff;
        transform: scale(1.35);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.65);
      }

      .nav-dot:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.8);
        outline-offset: 3px;
      }

      @media (max-width: 767px) {
        .media-navigation {
          flex-direction: row;
          gap: 0.55rem;
          padding: 0.45rem 0.75rem;
        }

        .nav-dots {
          flex-direction: row;
          gap: 0.7rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .nav-dot,
        .nav-arrow {
          transition: none;
        }
        .nav-dot.active {
          transform: none;
        }
      }
    `
  ]
})
export class MediaNavigationComponent {
  @Input() items: MediaItem[] = [];
  @Input() currentIndex = 0;
  @Output() select = new EventEmitter<number>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  /**
   * Sliding window of at most three media indexes that always contains the
   * current index. Boundaries clamp instead of showing empty placeholders:
   *   N <= 3            -> every index
   *   current = 0       -> [0, 1, 2]
   *   middle            -> [i - 1, i, i + 1]
   *   current = N - 1   -> [N - 3, N - 2, N - 1]
   */
  visibleIndexes(): number[] {
    const total = this.items.length;
    if (total === 0) {
      return [];
    }
    const windowSize = Math.min(3, total);
    const maxStart = total - windowSize;
    const start = Math.min(Math.max(this.currentIndex - 1, 0), maxStart);
    const indexes: number[] = [];
    for (let i = start; i < start + windowSize; i++) {
      indexes.push(i);
    }
    return indexes;
  }
}
