import { AfterViewInit, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  COMPANY_INFO, COMPANY_PHONE, COMPANY_TEL, COMPANY_MAILTO, CONTACT_ROUTES, ContactAudience, FORM_ENDPOINT,
} from '../../../core/company/company-info';

/** One form field. Labels are `ct_f_<id>`, placeholders `ct_f_<id>_ph`, options `ct_o_<option>`. */
interface Field {
  id: string;
  kind: 'text' | 'select' | 'chips' | 'textarea' | 'url';
  step: 2 | 3;
  required?: boolean;
  options?: string[];
  placeholder?: boolean;
  wide?: boolean;
}

const AUDIENCES: { id: ContactAudience; icon: string }[] = [
  { id: 'client', icon: 'fa-building-columns' },
  { id: 'supplier', icon: 'fa-truck-ramp-box' },
  { id: 'subcontractor', icon: 'fa-helmet-safety' },
  { id: 'partner', icon: 'fa-handshake' },
  { id: 'job', icon: 'fa-user-tie' },
];

/**
 * What each visitor is asked. Step 2 = who they are, step 3 = what they need/offer.
 * Steps 4 (message) and 5 (contact details) are shared by everyone.
 */
const FIELDS: Record<ContactAudience, Field[]> = {
  client: [
    { id: 'orgType', kind: 'select', step: 2, required: true, options: ['public', 'municipality', 'private', 'engineering', 'individual'] },
    { id: 'company', kind: 'text', step: 2, placeholder: true },
    { id: 'works', kind: 'chips', step: 3, required: true, wide: true, options: ['aep', 'sewer', 'station', 'reservoir', 'civil', 'vrd', 'other'] },
    { id: 'location', kind: 'text', step: 3, placeholder: true },
    { id: 'budget', kind: 'select', step: 3, options: ['b_lt1', 'b_1_5', 'b_5_10', 'b_gt10', 'b_unknown'] },
    { id: 'timeline', kind: 'select', step: 3, options: ['t_tender', 't_asap', 't_3m', 't_6m', 't_study'] },
  ],
  supplier: [
    { id: 'company', kind: 'text', step: 2, required: true, placeholder: true },
    { id: 'taxId', kind: 'text', step: 2, placeholder: true },
    { id: 'products', kind: 'chips', step: 3, required: true, wide: true, options: ['p_pipes', 'p_valves', 'p_pumps', 'p_materials', 'p_rental', 'p_services', 'other'] },
    { id: 'brands', kind: 'text', step: 3, placeholder: true },
    { id: 'website', kind: 'url', step: 3, placeholder: true },
  ],
  subcontractor: [
    { id: 'company', kind: 'text', step: 2, required: true, placeholder: true },
    { id: 'region', kind: 'text', step: 2, placeholder: true },
    { id: 'trades', kind: 'chips', step: 3, required: true, wide: true, options: ['s_earth', 's_pipelaying', 's_civil', 's_electromech', 's_survey', 's_transport', 'other'] },
    { id: 'equipment', kind: 'textarea', step: 3, placeholder: true, wide: true },
  ],
  partner: [
    { id: 'company', kind: 'text', step: 2, required: true, placeholder: true },
    { id: 'country', kind: 'text', step: 2, placeholder: true },
    { id: 'partnerType', kind: 'chips', step: 3, required: true, wide: true, options: ['jv', 'technical', 'investor', 'distribution', 'other'] },
    { id: 'tender', kind: 'text', step: 3, placeholder: true, wide: true },
  ],
  job: [
    { id: 'position', kind: 'select', step: 2, required: true, options: ['j_engineer', 'j_foreman', 'j_technician', 'j_operator', 'j_hse', 'j_admin', 'j_intern', 'j_spontaneous'] },
    { id: 'experience', kind: 'select', step: 2, options: ['e_0_2', 'e_3_5', 'e_6_10', 'e_10'] },
    { id: 'cvLink', kind: 'url', step: 3, placeholder: true, wide: true },
  ],
};

type SendState = 'idle' | 'sending' | 'sent' | 'mail' | 'error';

/**
 * CONTACT FORM — "the connection". One door, five routes: client, supplier,
 * subcontractor, partner, job applicant. Each gets its own questions and is
 * routed to its own mailbox (CONTACT_ROUTES). `/contact?type=partner` preselects.
 * The glass pipe fills as the 5 steps are completed (flanges turn orange).
 */
@Component({
  selector: 'app-project-inquiry',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  template: `
    <section id="project-inquiry" class="ci py-16 md:py-24">
      <div class="container mx-auto px-4">
        <div class="ci__head text-center max-w-3xl mx-auto mb-12 md:mb-14">
          <p class="hx-eyebrow">{{ 'ct_eyebrow' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'ct_title' | translate }}</h2>
          <p class="text-lg text-gray-600 mt-3">{{ 'ct_subtitle' | translate }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
          <div class="lg:col-span-3 ci__form">
            <div class="ci__pipe" aria-hidden="true">
              <i [style.height]="'calc(' + progress() + '% - 6px)'"></i>
              @for (f of [0, 1, 2, 3, 4]; track f) { <span class="ci__flange" [class.is-on]="done()[f]" [style.top.%]="f * 23"></span> }
            </div>

            @if (state() === 'sent' || state() === 'mail') {
              <div class="ci-done" role="status" aria-live="polite">
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
                <h3 class="hx-display">{{ (state() === 'sent' ? 'ct_sent_title' : 'ct_mail_title') | translate }}</h3>
                <p>{{ (state() === 'sent' ? 'ct_sent_text' : 'ct_mail_text') | translate }}</p>
                @if (state() === 'mail') {
                  <p class="ci-done__addr"><a [href]="mailto" dir="ltr">{{ routeTo() }}</a></p>
                }
                <button type="button" class="ci-done__again" (click)="reset()">{{ 'ct_again' | translate }}</button>
              </div>
            } @else {
            <form (submit)="$event.preventDefault(); send()" class="space-y-9" novalidate>
              <!-- 01 who are you -->
              <fieldset>
                <legend class="ci-legend"><span>01</span>{{ 'ct_step_1' | translate }}</legend>
                <div class="ci-aud" role="radiogroup" [attr.aria-label]="'ct_step_1' | translate">
                  @for (a of audiences; track a.id) {
                    <button type="button" role="radio" class="ci-aud__item" [class.is-on]="audience() === a.id"
                            [attr.aria-checked]="audience() === a.id" (click)="pick(a.id)">
                      <i class="fa-solid {{ a.icon }}" aria-hidden="true"></i>
                      <b>{{ 'ct_aud_' + a.id | translate }}</b>
                      <small>{{ 'ct_aud_' + a.id + '_d' | translate }}</small>
                    </button>
                  }
                </div>
              </fieldset>

              @if (audience(); as aud) {
                <!-- 02 + 03 audience-specific -->
                @for (step of [2, 3]; track step) {
                  <fieldset>
                    <legend class="ci-legend"><span>0{{ step }}</span>{{ 'ct_step_' + step + '_' + aud | translate }}</legend>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      @for (f of fieldsFor(step); track f.id) {
                        <div [class.ci-wide]="f.wide">
                          @if (f.kind === 'chips') {
                            <span class="ci-label">{{ 'ct_f_' + f.id | translate }}@if (f.required) { *}</span>
                            <div class="ci-chips">
                              @for (o of f.options; track o) {
                                <button type="button" class="ci-chip" [class.is-on]="hasChip(f.id, o)" [attr.aria-pressed]="hasChip(f.id, o)" (click)="toggleChip(f.id, o)">{{ 'ct_o_' + o | translate }}</button>
                              }
                            </div>
                          } @else {
                            <label class="ci-label" [for]="'ci-' + f.id">{{ 'ct_f_' + f.id | translate }}@if (f.required) { *}</label>
                            @switch (f.kind) {
                              @case ('select') {
                                <select class="ci-input" [id]="'ci-' + f.id" [value]="val(f.id)" (change)="set(f.id, $any($event.target).value)">
                                  <option value="">{{ 'ct_choose' | translate }}</option>
                                  @for (o of f.options; track o) { <option [value]="o" [selected]="val(f.id) === o">{{ 'ct_o_' + o | translate }}</option> }
                                </select>
                              }
                              @case ('textarea') {
                                <textarea class="ci-input" rows="3" [id]="'ci-' + f.id" [value]="val(f.id)" (input)="set(f.id, $any($event.target).value)"
                                          [placeholder]="f.placeholder ? ('ct_f_' + f.id + '_ph' | translate) : ''"></textarea>
                              }
                              @default {
                                <input class="ci-input" [type]="f.kind === 'url' ? 'url' : 'text'" [id]="'ci-' + f.id" [value]="val(f.id)" (input)="set(f.id, $any($event.target).value)"
                                       [placeholder]="f.placeholder ? ('ct_f_' + f.id + '_ph' | translate) : ''" />
                              }
                            }
                          }
                        </div>
                      }
                    </div>
                    @if (step === 3 && aud === 'job') { <p class="ci-hint"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> {{ 'ct_cv_hint' | translate }}</p> }
                  </fieldset>
                }

                <!-- 04 message -->
                <fieldset>
                  <legend class="ci-legend"><span>04</span>{{ 'ct_step_4' | translate }}</legend>
                  <label class="sr-only" for="ci-message">{{ 'ct_step_4' | translate }}</label>
                  <textarea id="ci-message" class="ci-input" rows="5" maxlength="1500" [value]="message()" (input)="message.set($any($event.target).value)"
                            [placeholder]="'ct_msg_ph_' + aud | translate"></textarea>
                </fieldset>

                <!-- 05 contact -->
                <fieldset>
                  <legend class="ci-legend"><span>05</span>{{ 'ct_step_5' | translate }}</legend>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="ci-label" for="ci-name">{{ 'ct_name' | translate }} *</label>
                      <input id="ci-name" class="ci-input" autocomplete="name" [value]="name()" (input)="name.set($any($event.target).value)" />
                    </div>
                    <div>
                      <label class="ci-label" for="ci-role">{{ 'ct_role' | translate }}</label>
                      <input id="ci-role" class="ci-input" autocomplete="organization-title" [value]="role()" (input)="role.set($any($event.target).value)" />
                    </div>
                    <div>
                      <label class="ci-label" for="ci-email">{{ 'ct_email' | translate }} *</label>
                      <input id="ci-email" type="email" class="ci-input" autocomplete="email" dir="ltr" [value]="email()" (input)="email.set($any($event.target).value)"
                             [attr.aria-invalid]="email() && !emailOk()" />
                      @if (email() && !emailOk()) { <small class="ci-err">{{ 'ct_email_bad' | translate }}</small> }
                    </div>
                    <div>
                      <label class="ci-label" for="ci-phone">{{ 'ct_phone' | translate }}</label>
                      <input id="ci-phone" type="tel" class="ci-input" autocomplete="tel" dir="ltr" placeholder="+216" [value]="phone()" (input)="phone.set($any($event.target).value)" />
                    </div>
                  </div>
                  <!-- honeypot: bots fill it, people never see it -->
                  <input class="ci-hp" tabindex="-1" autocomplete="off" aria-hidden="true" (input)="trap = $any($event.target).value" />
                  <label class="ci-consent">
                    <input type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)" />
                    <span>{{ 'ct_consent' | translate }} <a routerLink="/legal" fragment="privacy">{{ 'footer_privacy' | translate }}</a>.</span>
                  </label>
                </fieldset>

                @if (state() === 'error') { <p class="ci-err ci-err--box" role="alert">{{ 'ct_error' | translate }} <a [href]="mailto" dir="ltr">{{ routeTo() }}</a></p> }
                @if (!canSend() && missing().length) {
                  <p class="ci-missing">{{ 'ct_missing' | translate }} {{ missingText() }}</p>
                }
                <button type="submit" class="ci-send" [disabled]="!canSend() || state() === 'sending'">
                  <i class="fa-solid" [class.fa-paper-plane]="state() !== 'sending'" [class.fa-spinner]="state() === 'sending'" [class.fa-spin]="state() === 'sending'" aria-hidden="true"></i>
                  {{ 'ct_send_' + aud | translate }}
                </button>
                <p class="ci-hint">{{ (endpoint ? 'ct_note_direct' : 'ct_note_mail') | translate }}</p>
              }
            </form>
            }
          </div>

          <!-- side: what happens next for this visitor + direct lines -->
          <aside class="lg:col-span-2 space-y-8">
            <div class="ci-next">
              <h3 class="hx-display">{{ 'ct_next_title' | translate }}</h3>
              <ol>
                @for (i of [1, 2, 3]; track i) {
                  <li><span>{{ i }}</span>{{ 'ct_next_' + (audience() || 'client') + '_' + i | translate }}</li>
                }
              </ol>
            </div>
            <div class="ci-direct">
              <h3 class="hx-display">{{ 'ct_direct_title' | translate }}</h3>
              <a [href]="mailto" dir="ltr"><i class="fa-regular fa-envelope" aria-hidden="true"></i>{{ info.email }}</a>
              @if (tel) { <a [href]="tel" dir="ltr"><i class="fa-solid fa-phone" aria-hidden="true"></i>{{ phoneLabel }}</a> }
              <p><i class="fa-regular fa-clock" aria-hidden="true"></i>{{ 'ct_hours' | translate }} {{ info.hours.weekdays }} · {{ 'ct_hours_sat' | translate }} {{ info.hours.saturday }}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  `
})
export class ProjectInquiryComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslateService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly audiences = AUDIENCES;
  readonly info = COMPANY_INFO;
  readonly tel = COMPANY_TEL;
  readonly phoneLabel = COMPANY_PHONE;
  readonly endpoint = FORM_ENDPOINT;

  readonly audience = signal<ContactAudience | null>(null);
  readonly values = signal<Record<string, string>>({});
  readonly message = signal('');
  readonly name = signal('');
  readonly role = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly consent = signal(false);
  readonly state = signal<SendState>('idle');
  trap = '';

  readonly emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email().trim()));
  readonly routeTo = computed(() => CONTACT_ROUTES[this.audience() ?? 'client'].to);
  readonly mailto = COMPANY_MAILTO;

  /** required fields still empty, as translation keys */
  readonly missing = computed(() => {
    const a = this.audience();
    if (!a) return ['ct_step_1'];
    const v = this.values(), out: string[] = [];
    for (const f of FIELDS[a]) if (f.required && !v[f.id]?.trim()) out.push('ct_f_' + f.id);
    if (!this.name().trim()) out.push('ct_name');
    if (!this.emailOk()) out.push('ct_email');
    if (!this.consent()) out.push('ct_consent_short');
    return out;
  });
  readonly canSend = computed(() => this.missing().length === 0);

  /** the 5 flanges of the connection pipe */
  readonly done = computed(() => {
    const a = this.audience(), v = this.values();
    const stepOk = (s: 2 | 3) => !!a && FIELDS[a].filter(f => f.step === s).every(f => !f.required || !!v[f.id]?.trim())
      && FIELDS[a].some(f => f.step === s && !!v[f.id]?.trim());
    return [!!a, stepOk(2), stepOk(3), this.message().trim().length > 10, !!this.name().trim() && this.emailOk() && this.consent()];
  });
  readonly progress = computed(() => (this.done().filter(Boolean).length / 5) * 100);

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const t = q.get('type') as ContactAudience | null;
    if (t && t in FIELDS) {
      this.audience.set(t);
      const r = q.get('role');
      if (t === 'job' && r && FIELDS.job[0].options!.includes(r)) this.values.set({ position: r });
    }
  }

  ngAfterViewInit(): void {
    // arriving from "Devenir partenaire" / "Postuler": go straight to the form
    if (this.audience()) setTimeout(() => this.host.nativeElement.querySelector('#project-inquiry')?.scrollIntoView({ behavior: 'smooth' }), 350);
  }

  fieldsFor(step: number): Field[] {
    const a = this.audience();
    return a ? FIELDS[a].filter(f => f.step === step) : [];
  }

  pick(a: ContactAudience): void {
    if (a === this.audience()) return;
    this.audience.set(a);
    this.values.set({});
    if (this.state() === 'error') this.state.set('idle');
  }

  val(id: string): string { return this.values()[id] ?? ''; }
  set(id: string, v: string): void { this.values.update(o => ({ ...o, [id]: v })); }
  hasChip(id: string, o: string): boolean { return this.val(id).split(',').includes(o); }
  toggleChip(id: string, o: string): void {
    const cur = this.val(id).split(',').filter(Boolean);
    this.set(id, (cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o]).join(','));
  }

  missingText(): string {
    return this.missing().map(k => this.i18n.instant(k)).join(', ');
  }

  reset(): void {
    this.values.set({}); this.message.set(''); this.consent.set(false);
    this.state.set('idle');
  }

  /** readable value: option keys → translated labels */
  private show(f: Field, raw: string): string {
    if (!f.options) return raw;
    return raw.split(',').filter(Boolean).map(o => this.i18n.instant('ct_o_' + o)).join(', ');
  }

  async send(): Promise<void> {
    const a = this.audience();
    if (!a || !this.canSend() || this.trap) return;
    const t = (k: string) => this.i18n.instant(k);
    const route = CONTACT_ROUTES[a];
    const v = this.values();
    const rows: [string, string][] = [[t('ct_step_1'), t('ct_aud_' + a)]];
    for (const f of FIELDS[a]) if (v[f.id]?.trim()) rows.push([t('ct_f_' + f.id), this.show(f, v[f.id].trim())]);
    rows.push([t('ct_name'), this.name().trim()]);
    if (this.role().trim()) rows.push([t('ct_role'), this.role().trim()]);
    rows.push([t('ct_email'), this.email().trim()]);
    if (this.phone().trim()) rows.push([t('ct_phone'), this.phone().trim()]);
    const who = v['company']?.trim() || this.name().trim();
    const subject = `[SIGAT·${route.tag}] ${who}`;

    if (FORM_ENDPOINT) {
      this.state.set('sending');
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ to: route.to, subject, audience: a, _replyto: this.email().trim(), fields: Object.fromEntries(rows), message: this.message().trim() }),
        });
        this.state.set(res.ok ? 'sent' : 'error');
      } catch {
        this.state.set('error');
      }
      return;
    }

    // no server yet: open the visitor's mail app with everything written (mailto is limited to ~2000 chars)
    const body = rows.map(([k, x]) => `${k} : ${x}`).join('\n') + '\n\n' + this.message().trim().slice(0, 1200);
    window.location.href = `mailto:${route.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    this.state.set('mail');
  }
}
