import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StatCounterComponent } from '../../shared/components/stat-counter.component';
import { CompanyStoryComponent } from './components/company-story.component';
import { MissionVisionComponent } from './components/mission-vision.component';
import { ValuesComponent } from './components/values.component';
import { LeadershipComponent } from './components/leadership.component';
import { GeographicPresenceComponent } from './components/geographic-presence.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    StatCounterComponent,
    CompanyStoryComponent,
    MissionVisionComponent,
    ValuesComponent,
    LeadershipComponent,
    GeographicPresenceComponent
  ],
  template: `
    <!-- Hero -->
    <section
      class="relative min-h-[50vh] flex items-center bg-cover bg-center"
      style="background-image: url('https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=1600&q=80');"
    >
      <div class="absolute inset-0 bg-blue-900/70"></div>
      <div class="relative z-10 container mx-auto px-4 text-center">
        <!-- Breadcrumb -->
        <div class="flex items-center justify-center gap-2 text-sm text-gray-300 mb-4">
          <a routerLink="/home" class="hover:text-white transition-colors">{{ 'nav_home' | translate }}</a>
          <span>/</span>
          <span class="text-white">{{ 'about_page_breadcrumb' | translate }}</span>
        </div>

        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
          {{ 'about_page_title' | translate }}
        </h1>
      </div>
    </section>

    <!-- Company Story -->
    <app-company-story />

    <!-- Mission & Vision -->
    <app-mission-vision />

    <!-- Core Values -->
    <app-values />

    <!-- Leadership Team -->
    <app-leadership />

    <!-- Geographic Presence -->
    <app-geographic-presence />

    <!-- Stats -->
    <section class="py-12 bg-gray-100">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <app-stat-counter [value]="15" suffix="+" [label]="'home_stat_years' | translate" />
          <app-stat-counter [value]="120" suffix="+" [label]="'home_stat_projects' | translate" />
          <app-stat-counter [value]="500" suffix="km+" [label]="'home_stat_pipelines' | translate" />
          <app-stat-counter [value]="300" suffix="+" [label]="'home_stat_employees' | translate" />
        </div>
      </div>
    </section>
  `
})
export class AboutComponent {}
