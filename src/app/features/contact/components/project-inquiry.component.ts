import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-project-inquiry',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <section id="project-inquiry" class="py-16 md:py-24 bg-white">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500 mb-3">{{ 'contact_inquiry_eyebrow' | translate }}</p>
          <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{{ 'contact_inquiry_title' | translate }}</h2>
          <p class="text-lg text-gray-600">{{ 'contact_inquiry_subtitle' | translate }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 max-w-6xl mx-auto">
          <!-- Form: 3 columns -->
          <div class="lg:col-span-3">
            <form [formGroup]="inquiryForm" (ngSubmit)="onSubmit()" class="space-y-8">
              <!-- Step 01: Project Type -->
              <fieldset class="border-0 p-0">
                <legend class="text-sm font-semibold uppercase tracking-widest text-blue-900 mb-4">
                  <span class="text-orange-500 mr-2">01</span>{{ 'contact_inquiry_step_1_title' | translate }}
                </legend>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (opt of projectTypeOptions(); track opt.value) {
                    <label class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-900/40 transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50/50">
                      <input type="radio" formControlName="projectType" [value]="opt.value" class="h-4 w-4 text-blue-900 border-gray-300 focus:ring-blue-900" />
                      <span class="text-sm font-medium text-gray-700">{{ opt.label | translate }}</span>
                    </label>
                  }
                </div>
                @if (inquiryForm.get('projectType')?.invalid && inquiryForm.get('projectType')?.touched) {
                  <p class="text-red-500 text-xs mt-2">{{ 'contact_inquiry_required' | translate }}</p>
                }
              </fieldset>

              <!-- Step 02: Location -->
              <fieldset class="border-0 p-0">
                <legend class="text-sm font-semibold uppercase tracking-widest text-blue-900 mb-4">
                  <span class="text-orange-500 mr-2">02</span>{{ 'contact_inquiry_step_2_title' | translate }}
                </legend>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="inq-country" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_inquiry_country' | translate }}</label>
                    <input id="inq-country" type="text" formControlName="country" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_inquiry_country_placeholder' | translate" />
                  </div>
                  <div>
                    <label for="inq-city" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_inquiry_city' | translate }}</label>
                    <input id="inq-city" type="text" formControlName="city" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_inquiry_city_placeholder' | translate" />
                  </div>
                </div>
              </fieldset>

              <!-- Step 03: Scope -->
              <fieldset class="border-0 p-0">
                <legend class="text-sm font-semibold uppercase tracking-widest text-blue-900 mb-4">
                  <span class="text-orange-500 mr-2">03</span>{{ 'contact_inquiry_step_3_title' | translate }}
                </legend>
                <div>
                  <label for="inq-scope" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_inquiry_scope_label' | translate }}</label>
                  <textarea id="inq-scope" rows="4" formControlName="scope" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm resize-none" [placeholder]="'contact_inquiry_scope_placeholder' | translate"></textarea>
                </div>
              </fieldset>

              <!-- Step 04: Timeline -->
              <fieldset class="border-0 p-0">
                <legend class="text-sm font-semibold uppercase tracking-widest text-blue-900 mb-4">
                  <span class="text-orange-500 mr-2">04</span>{{ 'contact_inquiry_step_4_title' | translate }}
                </legend>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (opt of timelineOptions(); track opt.value) {
                    <label class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-900/40 transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50/50">
                      <input type="radio" formControlName="timeline" [value]="opt.value" class="h-4 w-4 text-blue-900 border-gray-300 focus:ring-blue-900" />
                      <span class="text-sm font-medium text-gray-700">{{ opt.label | translate }}</span>
                    </label>
                  }
                </div>
              </fieldset>

              <!-- Step 05: Contact Info -->
              <fieldset class="border-0 p-0">
                <legend class="text-sm font-semibold uppercase tracking-widest text-blue-900 mb-4">
                  <span class="text-orange-500 mr-2">05</span>{{ 'contact_inquiry_step_5_title' | translate }}
                </legend>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="inq-company" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_company' | translate }}</label>
                    <input id="inq-company" type="text" formControlName="company" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_form_company_placeholder' | translate" />
                  </div>
                  <div>
                    <label for="inq-name" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_name' | translate }} *</label>
                    <input id="inq-name" type="text" formControlName="name" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_form_name_placeholder' | translate" />
                    @if (inquiryForm.get('name')?.invalid && inquiryForm.get('name')?.touched) {
                      <p class="text-red-500 text-xs mt-1">{{ 'contact_form_name_required' | translate }}</p>
                    }
                  </div>
                  <div>
                    <label for="inq-email" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_email' | translate }} *</label>
                    <input id="inq-email" type="email" formControlName="email" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_form_email_placeholder' | translate" />
                    @if (inquiryForm.get('email')?.invalid && inquiryForm.get('email')?.touched) {
                      <p class="text-red-500 text-xs mt-1">{{ 'contact_form_email_required' | translate }}</p>
                    }
                  </div>
                  <div>
                    <label for="inq-phone" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_phone' | translate }}</label>
                    <input id="inq-phone" type="tel" formControlName="phone" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm" [placeholder]="'contact_form_phone_placeholder' | translate" />
                  </div>
                </div>
              </fieldset>

              <button type="submit" [disabled]="inquiryForm.invalid" class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-lg transition-colors text-base">
                {{ 'contact_inquiry_submit' | translate }}
              </button>
            </form>
          </div>

          <!-- Supporting info: 2 columns -->
          <div class="lg:col-span-2 space-y-8">
            <div class="bg-gray-50 rounded-xl p-6 md:p-8">
              <h3 class="text-lg font-bold text-gray-900 mb-4">{{ 'contact_inquiry_sidebar_title' | translate }}</h3>
              <ul class="space-y-4">
                <li class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-gray-600">{{ 'contact_inquiry_benefit_1' | translate }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-gray-600">{{ 'contact_inquiry_benefit_2' | translate }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-gray-600">{{ 'contact_inquiry_benefit_3' | translate }}</span>
                </li>
                <li class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-gray-600">{{ 'contact_inquiry_benefit_4' | translate }}</span>
                </li>
              </ul>
            </div>

            <div class="bg-blue-900 rounded-xl p-6 md:p-8 text-white">
              <h3 class="text-lg font-bold mb-2">{{ 'contact_inquiry_direct_title' | translate }}</h3>
              <p class="text-sm text-blue-100 mb-4">{{ 'contact_inquiry_direct_text' | translate }}</p>
              <a href="tel:+21323456789" class="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold text-sm transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {{ 'contact_phone_value' | translate }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ProjectInquiryComponent {
  readonly inquiryForm: FormGroup;

  readonly projectTypeOptions = signal([
    { value: 'hydraulic', label: 'contact_inquiry_type_hydraulic' },
    { value: 'pipeline', label: 'contact_inquiry_type_pipeline' },
    { value: 'civil', label: 'contact_inquiry_type_civil' },
    { value: 'construction', label: 'contact_inquiry_type_construction' },
    { value: 'other', label: 'contact_inquiry_type_other' },
  ]);

  readonly timelineOptions = signal([
    { value: 'asap', label: 'contact_inquiry_timeline_asap' },
    { value: '1-3', label: 'contact_inquiry_timeline_1_3' },
    { value: '3-6', label: 'contact_inquiry_timeline_3_6' },
    { value: '6plus', label: 'contact_inquiry_timeline_6plus' },
    { value: 'planning', label: 'contact_inquiry_timeline_planning' },
  ]);

  constructor(private fb: FormBuilder) {
    this.inquiryForm = this.fb.group({
      projectType: ['', Validators.required],
      country: [''],
      city: [''],
      scope: [''],
      timeline: [''],
      company: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
    });
  }

  onSubmit(): void {
    if (this.inquiryForm.valid) {
      console.log('Project inquiry submitted:', this.inquiryForm.value);
      alert('Thank you for your project inquiry. Our team will get back to you within 24 hours.');
      this.inquiryForm.reset();
    }
  }
}
