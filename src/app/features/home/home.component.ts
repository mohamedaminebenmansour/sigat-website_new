import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MediaShowcaseComponent } from '../media-showcase/components/media-showcase/media-showcase.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ExpertiseCardComponent } from '../../shared/components/expertise-card.component';
import { ProjectCardComponent } from '../../shared/components/project-card.component';
import { CtaBannerComponent } from '../../shared/components/cta-banner.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    MediaShowcaseComponent,
    SectionHeaderComponent,
    ExpertiseCardComponent,
    ProjectCardComponent,
    CtaBannerComponent
  ],
  template: `
    <!-- ==================== MEDIA SHOWCASE ==================== -->
    <app-media-showcase />

    <!-- ==================== EXPERTISE ==================== -->
    <section class="py-16 md:py-20 bg-gray-100">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'home_expertise_title' | translate"
          [subtitle]="'home_expertise_subtitle' | translate"
        />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <app-expertise-card
            [title]="'home_expertise_1_title' | translate"
            [description]="'home_expertise_1_desc' | translate"
            iconClass="fa-solid fa-water"
            routerLink="/expertise/hydraulic"
          />
          <app-expertise-card
            [title]="'home_expertise_2_title' | translate"
            [description]="'home_expertise_2_desc' | translate"
            iconClass="fa-solid fa-pipe-valve"
            routerLink="/expertise/pipeline"
          />
          <app-expertise-card
            [title]="'home_expertise_3_title' | translate"
            [description]="'home_expertise_3_desc' | translate"
            iconClass="fa-solid fa-building"
            routerLink="/expertise/civil"
          />
          <app-expertise-card
            [title]="'home_expertise_4_title' | translate"
            [description]="'home_expertise_4_desc' | translate"
            iconClass="fa-solid fa-hard-hat"
            routerLink="/expertise/general-construction"
          />
        </div>
      </div>
    </section>

    <!-- ==================== FEATURED PROJECTS ==================== -->
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'home_projects_title' | translate"
          [subtitle]="'home_projects_subtitle' | translate"
        />
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <app-project-card
            [title]="'home_project_1_title' | translate"
            [location]="'home_project_1_location' | translate"
            year="2023"
            category="Hydraulic"
            [imageUrl]="'https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=800&q=80'"
            routerLink="/projects/1"
          />
          <app-project-card
            [title]="'home_project_2_title' | translate"
            [location]="'home_project_2_location' | translate"
            year="2022"
            category="Pipeline"
            [imageUrl]="'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80'"
            routerLink="/projects/2"
          />
          <app-project-card
            [title]="'home_project_3_title' | translate"
            [location]="'home_project_3_location' | translate"
            year="2024"
            category="Infrastructure"
            [imageUrl]="'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800&q=80'"
            routerLink="/projects/4"
          />
        </div>
      </div>
    </section>

    <!-- ==================== CTA BANNER ==================== -->
    <app-cta-banner
      [title]="'home_cta_title' | translate"
      [description]="'home_cta_subtitle' | translate"
      [buttonText]="'home_cta_btn' | translate"
      buttonRoute="/partnerships"
    />
  `
})
export class HomeComponent {}
