import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { MediaService } from '../../core/media/media.service';
import { MediaItem } from '../../core/media/media-item.model';

@Component({
  selector: 'app-media',
  standalone: true,
imports: [TranslatePipe, SectionHeaderComponent],
  templateUrl: './media.component.html',
  styleUrl: './media.component.css'
})
export class MediaComponent {
readonly mediaItems: MediaItem[];

  constructor(private readonly mediaService: MediaService) {
    this.mediaItems = this.mediaService.getAll();
  }

  isVideo(item: MediaItem): boolean {
    return item.type === 'video';
  }

  thumbnailFor(item: MediaItem): string {
    return item.thumbnail || item.poster || item.src;
  }
}
