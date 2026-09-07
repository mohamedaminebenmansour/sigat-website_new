import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NAV_LINKS } from '../../core/navigation/navigation.service';
import { SOCIAL_LINKS } from '../../core/social/social-links';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="site-footer">
      <div class="footer-inner">
        <!-- ============ ZONE A: primary SIGAT CTA ============
             Purely decorative brand signature: the four line segments
             converge around SIGAT on hover/focus-within (CSS only).
             aria-hidden lines; the title is real text for SEO/SR. -->
        <section class="footer-cta">
          <span class="footer-cta-line footer-cta-line--top-left" aria-hidden="true"></span>
          <span class="footer-cta-line footer-cta-line--top-right" aria-hidden="true"></span>
          <h2 class="footer-cta-title">SIGAT</h2>
          <span class="footer-cta-line footer-cta-line--bottom-left" aria-hidden="true"></span>
          <span class="footer-cta-line footer-cta-line--bottom-right" aria-hidden="true"></span>
        </section>

        <!-- ============ ZONE B: corporate information ============ -->
        <div class="footer-content">
          <!-- Brand: white logo + company identity + social -->
          <div class="footer-brand">
            <a routerLink="/home" class="footer-logo-link" aria-label="SIGAT">
              <img
                src="assets/media/logo/sigatlogo-white.png"
                alt="SIGAT"
                class="footer-logo"
                loading="lazy"
              />
            </a>
            <p class="footer-brand-name">{{ 'footer_company_name' | translate }}</p>
            <p class="footer-desc">{{ 'footer_company_desc' | translate }}</p>
            <ul class="footer-social">
              @for (social of socialLinks; track social.platform) {
                <li>
                  <a
                    [href]="social.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    [class]="social.icon + ' footer-social-link'"
                    [attr.aria-label]="social.platform"
                  ></a>
                </li>
              }
            </ul>
          </div>

          <!-- Navigation: reused from NAV_LINKS (single source of truth) -->
          <nav class="footer-nav" [attr.aria-label]="'nav_quick_links' | translate">
            <h3 class="footer-heading">{{ 'nav_quick_links' | translate }}</h3>
            <ul class="footer-links">
              @for (link of navLinks; track link.path) {
                <li>
                  <a
                    [routerLink]="link.path"
                    class="footer-nav-link"
                    [class.footer-nav-link--cta]="link.isCta"
                  >
                    {{ link.label | translate }}
                  </a>
                </li>
              }
            </ul>
          </nav>

          <!-- Contact: existing SIGAT information (footer_* keys) -->
          <div class="footer-contact">
            <h3 class="footer-heading">{{ 'nav_contact' | translate }}</h3>
            <ul class="footer-contact-list">
              <li>
                <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{{ 'footer_address' | translate }}</span>
              </li>
              <li>
                <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:contact@sigat.tn" class="footer-contact-link">{{ 'footer_email' | translate }}</a>
              </li>
              <li>
                <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{{ 'footer_phone' | translate }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Bottom legal row -->
      <div class="footer-bottom">
        <p class="footer-copyright">{{ 'footer_copyright' | translate }}</p>
      </div>
    </footer>
  `,
  styles: [`
      :host { display: block; }

      footer.site-footer {
        /* ================================
           FOOTER MANUAL DESIGN CONTROLS
           ================================ */
        /* Colors */
        --footer-bg: #032665;              /* dark charcoal, not pure black */
        --footer-text: #d6d7d9;            /* primary text on dark */
        --footer-muted: #9a9ca1;           /* secondary text */
        --footer-accent: #f59e0b;          /* existing SIGAT amber (header CTA) */
        --footer-line: rgba(255, 255, 255, 0.55);  /* resting line color */
        --footer-border: rgba(255, 255, 255, 0.12);

        /* CTA */
        --cta-title-size: clamp(2.6rem, 6vw, 4.6rem);   /* SIGAT wordmark size */
        --cta-line-width: clamp(4.5rem, 20%, 12.5rem);  /* segment length */
        --cta-line-thickness: 1px;                      /* 1-2px max */
        --cta-line-offset: clamp(3.1rem, 6vw, 4.4rem);  /* vertical gap title<->lines */
        --cta-line-inset: 9%;                           /* horizontal inset from edges */
        --cta-line-opacity: 0.6;                        /* resting line visibility */
        /* Convergence is an ABSOLUTE distance (not a % of line width) so the
           four segments travel a predictable, tunable amount toward SIGAT. */
        --cta-convergence: clamp(3rem, 12vw, 10rem);    /* inward travel on hover */
        --cta-anim-duration: 600ms;                     /* line movement duration */
        --cta-anim-ease: cubic-bezier(0.22, 1, 0.36, 1);

        /* Layout */
        --footer-max-w: 75rem;             /* content max width */
        --footer-pad-x: clamp(1.25rem, 4vw, 2.5rem);
        --logo-width: clamp(6.25rem, 10vw, 9rem);       /* 100-144px white logo */
        --column-gap: clamp(2rem, 5vw, 4rem);
        /* ================================ */

        background: var(--footer-bg);
        color: var(--footer-text);
        font-family: inherit;
      }

      .footer-inner {
        max-width: var(--footer-max-w);
        margin-inline: auto;
        padding-inline: var(--footer-pad-x);
      }

      /* ============ ZONE A: CTA ============ */
      .footer-cta {
        position: relative;
        padding: clamp(4rem, 9vw, 6.75rem) 1rem;
        text-align: center;
      }
      .footer-cta-line {
        position: absolute;
        width: var(--cta-line-width);
        height: var(--cta-line-thickness);
        background: var(--footer-line);
        opacity: var(--cta-line-opacity);
        transition:
          transform var(--cta-anim-duration) var(--cta-anim-ease),
          background-color 350ms ease,
          opacity 350ms ease,
          box-shadow 350ms ease;
        pointer-events: none;
      }
      /* Symmetric physical placement -> identical visual in LTR and RTL. */
      .footer-cta-line--top-left,
      .footer-cta-line--bottom-left { left: var(--cta-line-inset); }
      .footer-cta-line--top-right,
      .footer-cta-line--bottom-right { right: var(--cta-line-inset); }
      .footer-cta-line--top-left,
      .footer-cta-line--top-right { top: calc(50% - var(--cta-line-offset)); }
      .footer-cta-line--bottom-left,
      .footer-cta-line--bottom-right { top: calc(50% + var(--cta-line-offset)); }

      .footer-cta-title {
        margin: 0;
        font-size: var(--cta-title-size);
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #ffffff;
        transition: color 350ms ease, text-shadow 350ms ease;
      }

      /* Whole CTA area is the hover target (large padding above);
         :focus-within gives keyboard parity if the CTA ever becomes interactive. */
      .footer-cta:hover .footer-cta-line--top-left,
      .footer-cta:hover .footer-cta-line--bottom-left,
      .footer-cta:focus-within .footer-cta-line--top-left,
      .footer-cta:focus-within .footer-cta-line--bottom-left {
        transform: translateX(var(--cta-convergence));
      }
      .footer-cta:hover .footer-cta-line--top-right,
      .footer-cta:hover .footer-cta-line--bottom-right,
      .footer-cta:focus-within .footer-cta-line--top-right,
      .footer-cta:focus-within .footer-cta-line--bottom-right {
        transform: translateX(calc(var(--cta-convergence) * -1));
      }
      .footer-cta:hover .footer-cta-line,
      .footer-cta:focus-within .footer-cta-line {
        background: var(--footer-accent);
        opacity: 1;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
      }
      .footer-cta:hover .footer-cta-title,
      .footer-cta:focus-within .footer-cta-title {
        color: var(--footer-accent);
        text-shadow: 0 0 18px rgba(245, 158, 11, 0.28);
      }

      /* ============ ZONE B: information area ============ */
      .footer-content {
        display: grid;
        grid-template-columns: 1.6fr 1fr 1.2fr;
        gap: var(--column-gap);
        padding-block: clamp(2.5rem, 6vw, 4rem) clamp(2.25rem, 5vw, 3.5rem);
        border-top: 1px solid var(--footer-border);
      }

      .footer-heading {
        margin: 0 0 1.1rem;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--footer-muted);
      }
      /* Brand column */
      .footer-logo-link { display: inline-block; }
      .footer-logo {
        display: block;
        width: var(--logo-width);
        max-width: 100%;
        height: auto;
        object-fit: contain;
      }
      .footer-brand-name {
        margin: 1.1rem 0 0.35rem;
        font-size: 0.92rem;
        font-weight: 700;
        color: #ffffff;
      }
      .footer-desc {
        margin: 0;
        max-width: 34ch;
        font-size: 0.875rem;
        line-height: 1.65;
        color: var(--footer-muted);
      }
      .footer-social {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        margin: 1.4rem 0 0;
        padding: 0;
        list-style: none;
      }
      .footer-social-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border: 1px solid var(--footer-border);
        border-radius: 999px;
        color: var(--footer-text);
        font-size: 1rem;
        transition: color 250ms ease, border-color 250ms ease,
          transform 250ms ease, background-color 250ms ease;
      }
      .footer-social-link:hover {
        color: var(--footer-accent);
        border-color: var(--footer-accent);
        transform: translateY(-2px);
        background: rgba(245, 158, 11, 0.08);
      }

      /* Navigation column */
      .footer-links {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .footer-nav-link {
        position: relative;
        display: inline-block;
        padding: 0.4rem 0;
        font-size: 0.9rem;
        color: var(--footer-text);
        text-decoration: none;
        transition: color 250ms ease;
      }
      .footer-nav-link::after {
        content: '';
        position: absolute;
        inset-inline-start: 0;
        bottom: 0.15rem;
        width: 100%;
        height: 1px;
        background: var(--footer-accent);
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 300ms var(--cta-anim-ease);
      }
      .footer-nav-link:hover { color: #ffffff; }
      .footer-nav-link:hover::after { transform: scaleX(1); }
      .footer-nav-link--cta { color: var(--footer-accent); font-weight: 600; }

      /* Contact column */
      .footer-contact-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .footer-contact-list li {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        margin-bottom: 0.85rem;
        font-size: 0.875rem;
        line-height: 1.6;
      }
      .footer-contact-icon {
        width: 1.1rem;
        height: 1.1rem;
        flex-shrink: 0;
        margin-top: 0.15rem;
        color: var(--footer-muted);
      }
      .footer-contact-link {
        color: var(--footer-text);
        text-decoration: none;
        transition: color 250ms ease;
      }
      .footer-contact-link:hover { color: var(--footer-accent); }

      /* Bottom legal row */
      .footer-bottom { border-top: 1px solid var(--footer-border); }
      .footer-copyright {
        margin: 0;
        padding: 1.15rem var(--footer-pad-x);
        text-align: center;
        font-size: 0.75rem;
        color: var(--footer-muted);
      }

      /* ============ Accessibility ============ */
      footer.site-footer a:focus-visible {
        outline: 2px solid var(--footer-accent);
        outline-offset: 3px;
        border-radius: 2px;
      }

      /* ============ Responsive ============ */
      @media (max-width: 1024px) {
        .footer-content { grid-template-columns: 1fr 1fr; }
        .footer-brand { grid-column: 1 / -1; }
      }
      @media (max-width: 640px) {
        .footer-content { grid-template-columns: 1fr; gap: 2.25rem; }
        .footer-cta { padding-inline: 0.25rem; }
        .footer-cta-line { width: clamp(3.75rem, 24%, 6rem); }
      }

      /* ============ Reduced motion ============ */
      @media (prefers-reduced-motion: reduce) {
        .footer-cta-line {
          transform: none !important;
          transition: background-color 200ms ease, opacity 200ms ease;
        }
        .footer-cta-title { transition: color 200ms ease; text-shadow: none; }
        .footer-social-link { transition: none; transform: none !important; }
        .footer-nav-link::after { transition: none; }
      }

      /* ============ RTL (Arabic) ============
         The grid, logical spacing and text alignment follow the document
         direction automatically. The CTA uses symmetric physical placement,
         so it is identical in RTL. SIGAT stays a Latin brand word. */
    `,
  ],
})
export class FooterComponent {
  /** Single sources of truth - no duplicated navigation/social data. */
  readonly navLinks = NAV_LINKS;
  readonly socialLinks = SOCIAL_LINKS;
}
