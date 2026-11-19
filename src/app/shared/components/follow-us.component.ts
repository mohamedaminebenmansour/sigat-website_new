import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPANY_INFO, COMPANY_MAILTO, COMPANY_WHATSAPP } from '../../core/company/company-info';


interface FollowItem { label: string; icon: string; bg: string; href: string; external: boolean; }

/**
 * "Follow Us" grid (LESSO-style): bordered glass cells, brand icon tiles, 3 + 3 + 2 layout.
 * Channels: Facebook, LinkedIn, WhatsApp, e-mail, location (from company-info.ts).
 */
@Component({
  selector: 'app-follow-us',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-6 flex items-center gap-1 font-bold text-blue-950" [class]="compact() ? 'text-3xl' : 'text-4xl md:text-5xl'">
        <span class="relative -mr-3 inline-block h-12 w-12 -translate-y-3 rounded-full"
              style="background: conic-gradient(from 200deg, #ef4444, #f97316, #fde68a00 70%, #fde68a00); -webkit-mask: radial-gradient(circle, transparent 52%, #000 54%); mask: radial-gradient(circle, transparent 52%, #000 54%);"
              aria-hidden="true"></span>
        {{ 'follow_title' | translate }}
      </h2>
      <div class="grid grid-cols-6 overflow-hidden rounded-xl border border-blue-950/20 bg-white/45 backdrop-blur-sm">
        @for (it of items; track it.label; let i = $index) {
          <a [href]="it.href" [attr.target]="it.external ? '_blank' : null" [attr.rel]="it.external ? 'noopener noreferrer' : null"
             class="group flex flex-col items-center justify-center gap-2.5 border-blue-950/15 transition-colors hover:bg-white/70"
             [class]="(i < 3 ? 'col-span-2 ' : 'col-span-3 ') + (compact() ? 'py-5' : 'py-7') + ((i < 2) || i === 3 ? ' border-r' : '') + (i < 3 ? ' border-b' : '')">
            <span class="grid h-12 w-12 place-items-center rounded-xl text-2xl text-white shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110"
                  [style.background]="it.bg"><i [class]="it.icon" aria-hidden="true"></i></span>
            <span class="text-[15px] text-blue-950">{{ it.label | translate }}</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class FollowUsComponent {
  readonly compact = input(false);
  /** SIGAT's real channels only (no Instagram / TikTok / YouTube). */
  readonly items: FollowItem[] = [
    { label: 'social_facebook_label', icon: 'fa-brands fa-facebook-f', bg: '#1877f2', href: COMPANY_INFO.social.facebook, external: true },
    { label: 'social_linkedin_label', icon: 'fa-brands fa-linkedin-in', bg: '#0a66c2', href: COMPANY_INFO.social.linkedin, external: true },
    // WhatsApp opens a chat once the real number is set in company-info.ts; until then it leads to the contact page.
    { label: 'footer_whatsapp', icon: 'fa-brands fa-whatsapp', bg: '#25d366', href: COMPANY_WHATSAPP ?? '/contact', external: !!COMPANY_WHATSAPP },
    { label: 'footer_email_label', icon: 'fa-regular fa-envelope', bg: '#1e5fd0', href: COMPANY_MAILTO, external: false },
    { label: 'footer_location', icon: 'fa-solid fa-location-dot', bg: '#dc2626', href: COMPANY_INFO.mapsUrl, external: true },
  ];
}
