# HOME_MEDIA_SOURCE.md

Complete current source code for the application's Home page media rendering pipeline.
Generated for debugging the black-screen issue. Nothing below is modified, summarized, or
abridged. File contents are verbatim from the working tree at generation time.

IMPORTANT NAVIGATIONAL FACT: The Home route (/home) renders the MediaShowcaseComponent
tree under features/media-showcase (selector app-media-showcase). There is a SEPARATE,
unrelated MediaComponent under features/media (selector app-media) that powers the /media
route. It is NOT used on Home, but its source is included below because it was requested.

---

## DEPENDENCY TREE (who renders whom - Home media path)

app-root (AppComponent)
  -> router-outlet
    -> app-main-layout (MainLayoutComponent)
         -> app-header (HeaderComponent)            [fixed, z-50, overlays media]
         -> app-mobile-menu (MobileMenuComponent)    [fixed overlay, z-[100] when open]
         -> main.flex-1
              -> router-outlet
                -> app-home (HomeComponent)
                     -> app-media-showcase (MediaShowcaseComponent)   <-- HOME MEDIA
                          -> app-media-navigation (MediaNavigationComponent)
                          -> app-media-stage (MediaStageComponent)
                               -> img   (image slides)
                               -> video (video slides, mute/autoplay-on-active)
                               -> .stage-overlay (div)
                          -> app-social-links (SocialLinksComponent, media-showcase)
                          -> app-company-stats (CompanyStatsComponent)
                     -> app-section-header, app-expertise-card, app-project-card,
                        app-cta-banner (non-media content BELOW the showcase)
         -> app-footer (FooterComponent)

Injections / imports per component:

HomeComponent
  imports(TS): RouterLink, TranslatePipe, MediaShowcaseComponent,
               SectionHeaderComponent, ExpertiseCardComponent,
               ProjectCardComponent, CtaBannerComponent
  template: <app-media-showcase /> then expertise/projects/cta sections

MediaShowcaseComponent
  imports: MediaStageComponent, MediaNavigationComponent,
           SocialLinksComponent, CompanyStatsComponent
  services: MediaShowcaseService (providedIn: 'root')
  data: SHOWCASE_MEDIA, SHOWCASE_SOCIAL_LINKS, COMPANY_STATS

MediaStageComponent
  imports: CommonModule             ; model: MediaItem (re-exported from core)

MediaNavigationComponent imports: CommonModule
SocialLinksComponent (media-showcase) imports: CommonModule, RouterLink, TranslatePipe
CompanyStatsComponent imports: CommonModule, TranslatePipe

MediaShowcaseService : uses MediaItem model; signal/computed/effect (Angular).

NOT used on Home (included for completeness because requested):
  - MediaComponent (features/media) -> MediaService (core), MediaItem (core), SectionHeader
  - shared/media/media-hero, shared/media/media-lightbox, shared/components/social-links

---

================================================================
FILE: src/index.html
================================================================
<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <title>SigatWebsite</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>

<body>
  <app-root></app-root>
</body>

</html>

================================================================
FILE: src/styles.css  (GLOBAL CSS - body/html/app-root/layout)
================================================================
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}

.nav-link {
  position: relative;
  overflow: hidden;
}
.nav-link::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.12);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 300ms ease-out;
  pointer-events: none;
  border-radius: inherit;
}
.nav-link:hover::before {
  transform: scaleY(1);
}
.nav-link:active::before {
  transform: scaleY(1);
  background: rgba(255, 255, 255, 0.18);
}
@media (prefers-reduced-motion: reduce) {
  .nav-link::before {
    transition: none;
  }
}

.header-glass {
  box-shadow: 0 1px 20px rgba(15, 23, 42, 0.08);
}

app-header {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

================================================================
FILE: src/app/app.component.ts
================================================================
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

================================================================
FILE: src/app/app.component.html
================================================================
<router-outlet />

================================================================
FILE: src/app/app.component.css
================================================================
(empty file)

================================================================
FILE: src/app/app.routes.ts  (HOME ROUTE CONFIG)
================================================================
import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'about',
        loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent)
      },
      {
        path: 'expertise',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/expertise/expertise.component').then(m => m.ExpertiseComponent)
          },
          {
            path: ':slug',
            loadComponent: () => import('./features/expertise/expertise-detail.component').then(m => m.ExpertiseDetailComponent)
          }
        ]
      },
      {
        path: 'projects',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/projects/projects.component').then(m => m.ProjectsComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/projects/project-detail.component').then(m => m.ProjectDetailComponent)
          }
        ]
      },
      {
        path: 'capabilities',
        loadComponent: () => import('./features/capabilities/capabilities.component').then(m => m.CapabilitiesComponent)
      },
      {
        path: 'hse',
        loadComponent: () => import('./features/hse/hse.component').then(m => m.HseComponent)
      },
      {
        path: 'partnerships',
        loadComponent: () => import('./features/partnerships/partnerships.component').then(m => m.PartnershipsComponent)
      },
      {
        path: 'media',
        loadComponent: () => import('./features/media/media.component').then(m => m.MediaComponent)
      },
      {
        path: 'contact',
        loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent)
      },
      {
        path: '**',
        redirectTo: '/home'
      }
    ]
  }
];

================================================================
FILE: src/app/app.config.ts
================================================================
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideTranslateService({
      lang: 'fr'
    }),
    provideTranslateHttpLoader({
      prefix: 'assets/i18n/',
      suffix: '.json'
    })
  ]
};
