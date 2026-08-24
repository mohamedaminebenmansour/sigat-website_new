import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppTranslateService } from './core/services/translate.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'sigat-website';

  constructor(private appTranslateService: AppTranslateService) {
    // The translate service is initialized in its constructor,
    // which calls translate.use('fr') and sets HTML attributes.
  }
}
