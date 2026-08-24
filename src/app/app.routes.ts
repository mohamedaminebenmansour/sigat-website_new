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
