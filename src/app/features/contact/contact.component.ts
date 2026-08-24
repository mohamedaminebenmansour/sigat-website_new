import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SectionHeaderComponent],
  template: `
    <section class="py-16 md:py-20 bg-white">
      <div class="container mx-auto px-4">
        <app-section-header
          [title]="'contact_title' | translate"
          [subtitle]="'contact_subtitle' | translate"
        />

        <div class="max-w-6xl mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <!-- Left: Contact Info -->
            <div class="space-y-8">
              <div class="flex items-start gap-5">
                <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_address' | translate }}</h3>
                  <p class="text-gray-600" [innerHTML]="'contact_address_value' | translate"></p>
                </div>
              </div>

              <div class="flex items-start gap-5">
                <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_phone' | translate }}</h3>
                  <p class="text-gray-600">{{ 'contact_phone_value' | translate }}</p>
                </div>
              </div>

              <div class="flex items-start gap-5">
                <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_email' | translate }}</h3>
                  <p class="text-gray-600">{{ 'contact_email_value' | translate }}</p>
                </div>
              </div>

              <div class="flex items-start gap-5">
                <div class="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">{{ 'contact_hours' | translate }}</h3>
                  <p class="text-gray-600" [innerHTML]="'contact_hours_value' | translate"></p>
                </div>
              </div>
            </div>

            <!-- Right: Contact Form -->
            <div class="bg-gray-50 rounded-lg p-8 shadow-sm">
              <form [formGroup]="contactForm" (ngSubmit)="onSubmit()" class="space-y-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <!-- Name -->
                  <div>
                    <label for="name" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_name' | translate }} *</label>
                    <input
                      id="name"
                      type="text"
                      formControlName="name"
                      class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm"
                      [placeholder]="'contact_form_name_placeholder' | translate"
                    />
                    @if (contactForm.get('name')?.invalid && contactForm.get('name')?.touched) {
                      <p class="text-red-500 text-xs mt-1">{{ 'contact_form_name_required' | translate }}</p>
                    }
                  </div>

                  <!-- Email -->
                  <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_email' | translate }} *</label>
                    <input
                      id="email"
                      type="email"
                      formControlName="email"
                      class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm"
                      [placeholder]="'contact_form_email_placeholder' | translate"
                    />
                    @if (contactForm.get('email')?.invalid && contactForm.get('email')?.touched) {
                      <p class="text-red-500 text-xs mt-1">{{ 'contact_form_email_required' | translate }}</p>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <!-- Phone -->
                  <div>
                    <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_phone' | translate }}</label>
                    <input
                      id="phone"
                      type="tel"
                      formControlName="phone"
                      class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm"
                      [placeholder]="'contact_form_phone_placeholder' | translate"
                    />
                  </div>

                  <!-- Company -->
                  <div>
                    <label for="company" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_company' | translate }}</label>
                    <input
                      id="company"
                      type="text"
                      formControlName="company"
                      class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm"
                      [placeholder]="'contact_form_company_placeholder' | translate"
                    />
                  </div>
                </div>

                <!-- Subject -->
                <div>
                  <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_subject' | translate }} *</label>
                  <select
                    id="subject"
                    formControlName="subject"
                    class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm bg-white"
                  >
                    <option value="" disabled>{{ 'contact_form_select' | translate }}</option>
                    <option value="partnership">{{ 'contact_form_option_partnership' | translate }}</option>
                    <option value="quote">{{ 'contact_form_option_quote' | translate }}</option>
                    <option value="general">{{ 'contact_form_option_general' | translate }}</option>
                  </select>
                  @if (contactForm.get('subject')?.invalid && contactForm.get('subject')?.touched) {
                    <p class="text-red-500 text-xs mt-1">{{ 'contact_form_subject_required' | translate }}</p>
                  }
                </div>

                <!-- Message -->
                <div>
                  <label for="message" class="block text-sm font-medium text-gray-700 mb-1">{{ 'contact_form_message' | translate }} *</label>
                  <textarea
                    id="message"
                    formControlName="message"
                    rows="5"
                    class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm resize-none"
                    [placeholder]="'contact_form_message_placeholder' | translate"
                  ></textarea>
                  @if (contactForm.get('message')?.invalid && contactForm.get('message')?.touched) {
                    <p class="text-red-500 text-xs mt-1">{{ 'contact_form_message_required' | translate }}</p>
                  }
                </div>

                <button
                  type="submit"
                  [disabled]="contactForm.invalid"
                  class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {{ 'contact_form_submit' | translate }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ContactComponent {
  contactForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      company: [''],
      subject: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.contactForm.valid) {
      console.log('Contact form submitted:', this.contactForm.value);
      alert('Thank you for your message! We will get back to you shortly.');
      this.contactForm.reset();
    }
  }
}
