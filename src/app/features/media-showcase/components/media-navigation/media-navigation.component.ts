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
        *ngFor="let _ of items; trackBy: trackByFn; let i = index"
        class="nav-dot"
        [class.active]="currentIndex === i"
        (click)="select.emit(i)"
        [attr.aria-label]="'Go to slide ' + (i + 1)"
        [attr.aria-pressed]="currentIndex === i"
      ></button>
    </nav>
  `,
  styles: [`
    :host { display: block; }

    .media-navigation {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      z-index: 20;
    }

    .nav-dot {
      position: relative;
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 9999px;
      border: none;
      background: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      transition: all 0.3s ease;
      padding: 0;
      outline: none;
    }

    .nav-dot:hover {
      background: rgba(255, 255, 255, 0.85);
      transform: scale(1.15);
    }

    .nav-dot.active {
      background: #fff;
      transform: scale(1.4);
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.7), 0 0 20px rgba(255, 255, 255, 0.35);
    }

    .nav-dot:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.8);
      outline-offset: 3px;
    }

    @media (max-width: 768px) {
      .media-navigation {
        flex-direction: row;
        justify-content: center;
        gap: 0.6rem;
      }
    }
  `]
})
export class MediaNavigationComponent {
  @Input() items: MediaItem[] = [];
  @Input() currentIndex = 0;
  @Output() select = new EventEmitter<number>();

  trackByFn(index: number): number {
    return index;
  }
}
