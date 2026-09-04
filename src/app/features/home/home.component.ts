import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MediaShowcaseComponent } from '../media-showcase/components/media-showcase/media-showcase.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { ProjectCardComponent } from '../../shared/components/project-card.component';
import { CtaBannerComponent } from '../../shared/components/cta-banner.component';
import { CompanyStoryComponent } from '../about/components/company-story.component';
import { ValuesComponent } from '../about/components/values.component';
import { Values3dComponent } from "../about/components/values-3d.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    MediaShowcaseComponent,
    SectionHeaderComponent,
    ProjectCardComponent,
    CtaBannerComponent,
    CompanyStoryComponent,
    ValuesComponent,
    Values3dComponent
],
  template: `
    <!-- ==================== MEDIA SHOWCASE / HERO (includes stats) ==================== -->
    <app-media-showcase />

    <!-- ==================== COMPANY STORY ==================== -->
    <app-company-story />

    <!-- ==================== CORE VALUES ==================== -->
    <app-values />
    <app-values-3d/>

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
