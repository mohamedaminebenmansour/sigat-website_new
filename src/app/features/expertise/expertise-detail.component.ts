import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Expertise } from '../../core/models/expertise.model';

interface PipeType {
  name: string;
  description: string;
  applications: string;
  icon: string;
}

interface MethodologyStep {
  step: number;
  title: string;
  description: string;
}

@Component({
  selector: 'app-expertise-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="min-h-screen bg-white">
      @if (isHydraulic) {
        <!-- HYDRAULIC EXPERTISE DETAIL -->
        <!-- Hero -->
        <section class="relative h-64 md:h-80 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1541888946425-d81bb50b2e0b?w=1600&q=80');">
          <div class="absolute inset-0 bg-blue-900/60"></div>
          <div class="absolute inset-0 flex items-center">
            <div class="container mx-auto px-4">
              <a routerLink="/expertise" class="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                {{ 'expertise_back' | translate }}
              </a>
              <h1 class="text-3xl md:text-5xl font-bold text-white">{{ 'expertise_hydraulic_title' | translate }}</h1>
              <p class="text-gray-200 text-lg mt-3 max-w-2xl">{{ 'expertise_hydraulic_subtitle' | translate }}</p>
            </div>
          </div>
        </section>

        <!-- Pipe Types -->
        <section class="py-16 md:py-20">
          <div class="container mx-auto px-4">
            <h2 class="text-3xl font-bold text-gray-900 text-center mb-4">{{ 'expertise_hydraulic_pipes_title' | translate }}</h2>
            <div class="w-16 h-1 bg-orange-500 mx-auto rounded-full mb-12"></div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              @for (pipe of pipeTypes; track pipe.name) {
                <div class="bg-gray-50 rounded-lg p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div class="text-4xl text-blue-900 mb-4">
                    <i [class]="pipe.icon"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-900 mb-3">{{ pipe.name }}</h3>
                  <p class="text-gray-600 text-sm leading-relaxed mb-4">{{ pipe.description }}</p>
                  <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Applications</p>
                    <p class="text-gray-700 text-sm">{{ pipe.applications }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- Methodology Timeline -->
        <section class="py-16 md:py-20 bg-gray-50">
          <div class="container mx-auto px-4">
            <h2 class="text-3xl font-bold text-gray-900 text-center mb-4">{{ 'expertise_hydraulic_methodology_title' | translate }}</h2>
            <div class="w-16 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p class="text-gray-600 text-center max-w-2xl mx-auto mb-12">{{ 'expertise_hydraulic_methodology_subtitle' | translate }}</p>

            <div class="max-w-3xl mx-auto">
              @for (step of methodology; track step.step) {
                <div class="relative flex gap-6 pb-12 last:pb-0">
                  <!-- Timeline line -->
                  @if (step.step < methodology.length) {
                    <div class="absolute left-5 top-10 bottom-0 w-0.5 bg-blue-200"></div>
                  }

                  <!-- Step number circle -->
                  <div class="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-sm">
                    {{ step.step }}
                  </div>

                  <!-- Content -->
                  <div class="flex-1 bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <h3 class="text-lg font-bold text-gray-900 mb-2">{{ step.title }}</h3>
                    <p class="text-gray-600 text-sm leading-relaxed">{{ step.description }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="py-12 bg-blue-900">
          <div class="container mx-auto px-4 text-center">
            <h3 class="text-2xl font-bold text-white mb-4">{{ 'expertise_hydraulic_cta_title' | translate }}</h3>
            <a routerLink="/contact" class="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
              {{ 'expertise_hydraulic_cta_btn' | translate }}
            </a>
          </div>
        </section>
      } @else {
        <!-- GENERIC EXPERTISE DETAIL -->
        @if (expertise(); as e) {
          <section class="relative h-64 md:h-80 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1600&q=80');">
            <div class="absolute inset-0 bg-blue-900/60"></div>
            <div class="absolute inset-0 flex items-center">
              <div class="container mx-auto px-4">
                <a routerLink="/expertise" class="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Expertise
                </a>
                <h1 class="text-3xl md:text-5xl font-bold text-white">{{ e.title }}</h1>
                <p class="text-gray-200 text-lg mt-3 max-w-2xl">{{ e.description }}</p>
              </div>
            </div>
          </section>

          <section class="py-16 md:py-20">
            <div class="container mx-auto px-4 max-w-4xl">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">Key Capabilities</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (detail of e.details; track detail) {
                  <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                    <svg class="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-gray-700">{{ detail }}</span>
                  </div>
                }
              </div>

              <div class="mt-12 text-center">
                <a routerLink="/contact" class="inline-block bg-blue-900 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
                  Discuss Your {{ e.title }} Needs
                </a>
              </div>
            </div>
          </section>
        } @else {
          <div class="py-20 text-center">
            <p class="text-gray-500 text-lg">Expertise area not found</p>
            <a routerLink="/expertise" class="inline-block mt-4 text-blue-900 hover:underline font-medium">&larr; Back to Expertise</a>
          </div>
        }
      }
    </div>
  `
})
export class ExpertiseDetailComponent {
  readonly expertise = signal<Expertise | undefined>(undefined);
  isHydraulic = false;

  pipeTypes: PipeType[] = [
    {
      name: 'Steel Pipe',
      description:
        'High-strength carbon steel pipes ideal for high-pressure water transmission mains. Available with internal cement mortar lining and external fusion-bonded epoxy coating for corrosion protection.',
      applications: 'Long-distance water transmission, fire mains, high-pressure industrial lines',
      icon: 'fa-solid fa-industry'
    },
    {
      name: 'HDPE Pipe',
      description:
        'High-density polyethylene pipes offering excellent flexibility, chemical resistance, and leak-free fusion joints. Lightweight and durable for trenchless installation methods.',
      applications: 'Potable water networks, sewage systems, irrigation networks, gas distribution',
      icon: 'fa-solid fa-recycle'
    },
    {
      name: 'PVC Pipe',
      description:
        'Unplasticized polyvinyl chloride pipes providing a cost-effective solution for gravity and low-pressure systems. Resistant to corrosion and biological growth with a long service life.',
      applications: 'Stormwater drainage, sewer collection, low-pressure irrigation, electrical conduits',
      icon: 'fa-solid fa-chart-line'
    }
  ];

  methodology: MethodologyStep[] = [
    {
      step: 1,
      title: 'Survey & Route Planning',
      description:
        'Comprehensive topographical survey and geotechnical investigation. Detailed route optimization considering terrain, existing utilities, and environmental constraints. Preparation of alignment sheets and crossing schedules.'
    },
    {
      step: 2,
      title: 'Trenching & Excavation',
      description:
        'Mechanical excavation using Caterpillar 336 excavators to required depth and width. Shoring and dewatering as needed per soil conditions. Bedding preparation with selected granular material to ensure uniform pipe support.'
    },
    {
      step: 3,
      title: 'Pipe Laying & Alignment',
      description:
        'Precision lowering of pipes using side-boom tractors or cranes. Alignment verification using laser-guided systems. Proper placement of jointing materials and gaskets before connection.'
    },
    {
      step: 4,
      title: 'Welding & Jointing',
      description:
        'Butt-fusion welding for HDPE using automated fusion machines with data logging. Shielded metal arc welding (SMAW) for steel pipes with pre-heat and post-weld heat treatment as per WPS. 100% visual and non-destructive testing.'
    },
    {
      step: 5,
      title: 'Pressure Testing & Inspection',
      description:
        'Hydrostatic pressure testing at 1.5x design pressure for a minimum of 2 hours. Leak detection using calibrated pressure gauges and data loggers. CCTV inspection for sewer lines to verify joint integrity.'
    },
    {
      step: 6,
      title: 'Backfilling & Restoration',
      description:
        'Layered backfill with approved material compacted to 95% Proctor density. Installation of warning tape and tracer wire. Final surface restoration including topsoiling, hydroseeding, and asphalt reinstatement.'
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private mockData: MockDataService
  ) {
    const slug = this.route.snapshot.paramMap.get('slug') || '';

    if (slug === 'hydraulic') {
      this.isHydraulic = true;
    } else {
      // Map slugs to expertise IDs
      const slugToId: Record<string, number> = {
        'pipeline': 2,
        'civil': 3,
        'general-construction': 4
      };
      const id = slugToId[slug];
      if (id) {
        this.expertise.set(this.mockData.getExpertiseById(id));
      }
    }
  }
}
