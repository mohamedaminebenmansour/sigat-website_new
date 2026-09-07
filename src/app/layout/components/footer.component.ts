import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NAV_LINKS } from '../../core/navigation/navigation.service';
import { SOCIAL_LINKS } from '../../core/social/social-links';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="site-footer">
      <section class="footer-cta">
          <a
            routerLink="/partnerships"
            class="footer-cta-link"
            [attr.aria-label]="'nav_partner_cta' | translate"
          >
            <span class="footer-line footer-line-top-left" aria-hidden="true"></span>
            <span class="footer-line footer-line-top-right" aria-hidden="true"></span>
            <span class="footer-cta-title">{{ 'nav_partner_cta' | translate }}</span>
            <span class="footer-line footer-line-bottom-left" aria-hidden="true"></span>
            <span class="footer-line footer-line-bottom-right" aria-hidden="true"></span>
          </a>
        </section>
      <div class="footer-inner">
        <!-- ============ ZONE B: corporate information ============
             FIVE balanced columns in ONE grid: brand (logo + social),
             two editorial navigation groups, the real address with a
             Google Maps action, and the real contact data. -->
        <div class="footer-content">
          <div class="footer-brand-block">
            <a routerLink="/home" class="footer-logo-link" aria-label="SIGAT">
              <img
                src="assets/media/logo/sigatlogo-white.png"
                alt="SIGAT"
                class="footer-logo"
                loading="lazy"
              />
            </a>
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

          <nav class="footer-nav-group" [attr.aria-label]="'nav_quick_links' | translate">
            <ul class="footer-links">
              @for (link of navPrimary; track link.path) {
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

          <nav class="footer-nav-group" [attr.aria-label]="'nav_quick_links' | translate">
            <ul class="footer-links">
              @for (link of navSecondary; track link.path) {
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

          <div class="footer-block">
            <h3 class="footer-heading">{{ 'footer_visit_us' | translate }}</h3>
            <p class="footer-address">{{ 'footer_address' | translate }}</p>
            <a
              class="footer-maps-link"
              [href]="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="footer-maps-cta">{{ 'footer_maps_cta' | translate }}</span>
            </a>
          </div>

          <div class="footer-block">
            <h3 class="footer-heading">{{ 'footer_contact_us' | translate }}</h3>
            <ul class="footer-contact-list">
              <li>
                <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a [href]="phoneHref()" class="footer-contact-link">{{ 'footer_phone' | translate }}</a>
              </li>
              <li>
                <svg xmlns="http://www.w3.org/2000/svg" class="footer-contact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:contact@sigat.tn" class="footer-contact-link">{{ 'footer_email' | translate }}</a>
              </li>
            </ul>
          </div>
        </div>

        <!-- ============ ZONE C: conversion CTA ============
             RECOMMENDED centerpiece: all footer information above, then a
             strong final conversion CTA. Routes to /partnerships via
             Angular RouterLink. The four line segments stay ANCHORED and
             GROW in width only (never translate) toward the center on
             hover/focus/keyboard, converging into one continuous line. -->

      </div>

      <!-- ============ ZONE C: legal ============ -->
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
        --cta-title-size: clamp(1.8rem, 3vw, 2.8rem);   /* SIGAT wordmark size */
        --cta-line-thickness: 1px;                      /* 1-2px max */
        --cta-line-offset: clamp(2.4rem, 4vw, 3rem);    /* vertical gap title<->lines */
        --cta-line-inset: 8%;                           /* horizontal inset from edges */
        --cta-line-opacity: 0.6;                        /* resting line visibility */
        --cta-line-w-min: clamp(2.5rem, 12vw, 5rem);    /* resting length (~40-80px) */
        --cta-line-w-max: clamp(5rem, 26vw, 10rem);     /* hover (resting) length (~80-160px) */
        --cta-anim-duration: 700ms;                     /* width growth duration */
        --cta-anim-ease: cubic-bezier(0.22, 1, 0.36, 1);

        /* Layout */
        --footer-max-w: 75rem;             /* content max width */
        --footer-pad-x: clamp(1.25rem, 4vw, 2.5rem);
        --logo-width: clamp(6.9rem, 9vw, 9.4rem);       /* ~110-150px white logo */
        --column-gap: clamp(1.2rem, 2vw, 2.2rem);
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

      /* ============ ZONE C: conversion CTA ============
         The four segments are ANCHORED at their outer ends. The ONLY
         animated property is WIDTH (the inner end grows toward the
         center) - no translateX/Y, no position/margin animation. The
         whole CTA is a real Angular RouterLink (accessible, keyboard
         focus, Enter navigates to /partnerships). */
      .footer-cta-link {
        position: relative;
        display: block;
        padding: clamp(2.25rem, 4.5vw, 3.5rem) 1rem;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
      }
      .footer-line {
        position: absolute;
        height: var(--cta-line-thickness);
        background: var(--footer-line);
        opacity: var(--cta-line-opacity);
        width: var(--cta-line-w-min);
        transition:
          width var(--cta-anim-duration) var(--cta-anim-ease),
          background-color 350ms ease,
          opacity 350ms ease,
          box-shadow 350ms ease;
        pointer-events: none;
      }
      /* Outer ends anchored: left lines anchored LEFT and grow rightward
         (toward center); right lines anchored RIGHT and grow leftward.
         Symmetric physical placement -> identical in LTR and RTL. */
      .footer-line-top-left,
      .footer-line-bottom-left { left: var(--cta-line-inset); }
      .footer-line-top-right,
      .footer-line-bottom-right { right: var(--cta-line-inset); }
      .footer-line-top-left,
      .footer-line-top-right { top: calc(50% - var(--cta-line-offset)); }
      .footer-line-bottom-left,
      .footer-line-bottom-right { top: calc(50% + var(--cta-line-offset)); }

      .footer-cta-title {
        margin: 0;
        font-size: var(--cta-title-size);
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #ffffff;
        text-decoration: none;
        transition: color 350ms ease, text-shadow 350ms ease;
      }

      /* Whole CTA link (title + lines + padding) is the hover target;
         :focus-visible = keyboard parity. Hover width = 50% - inset, so
         the two segments meet EXACTLY at the horizontal center: each pair
         becomes ONE continuous line above / below the CTA text. Pure width
         growth - outer edges never move. */
      .footer-cta-link:hover .footer-line-top-left,
      .footer-cta-link:hover .footer-line-bottom-left,
      .footer-cta-link:focus-visible .footer-line-top-left,
      .footer-cta-link:focus-visible .footer-line-bottom-left {
        width: calc(50% - var(--cta-line-inset));
      }
      .footer-cta-link:hover .footer-line-top-right,
      .footer-cta-link:hover .footer-line-bottom-right,
      .footer-cta-link:focus-visible .footer-line-top-right,
      .footer-cta-link:focus-visible .footer-line-bottom-right {
        width: calc(50% - var(--cta-line-inset));
      }
      .footer-cta-link:hover .footer-line,
      .footer-cta-link:focus-visible .footer-line {
        background: var(--footer-accent);
        opacity: 1;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
      }
      .footer-cta-link:hover .footer-cta-title,
      .footer-cta-link:focus-visible .footer-cta-title {
        color: var(--footer-accent);
        text-shadow: 0 0 18px rgba(245, 158, 11, 0.28);
      }

      /* ============ ZONE B: information area ============
         FIVE columns: brand | nav 1 | nav 2 | visit | contact. */
      .footer-content {
        display: grid;
        grid-template-columns: 1fr 0.8fr 0.8fr 1.2fr 1.2fr;
        gap: var(--column-gap);
        align-items: start;
        padding: 20px var(--footer-pad-x) 10px;
        border-top: 1px solid var(--footer-border);
      }

      /* Brand column: white logo + social, top-aligned like the others.
         padding-top matches the headings' optical top so the logo aligns
         with the other columns' heading baseline. */
      .footer-brand-block {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1.1rem;
        padding-top: 0.75rem;
      }

      .footer-heading {
        margin: 0 0 0.75rem;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--footer-muted);
      }
/*__MORE__*/
      /* Visit-us block: real address + Google Maps action */
      .footer-address {
        margin: 0 0 0.6rem;
        font-size: 0.875rem;
        line-height: 1.55;
        color: var(--footer-text);
        max-width: 30ch;
      }
      .footer-maps-link {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.82rem;
        color: var(--footer-muted);
        text-decoration: none;
        transition: color 250ms ease;
      }
      .footer-maps-link .footer-contact-icon {
        width: 1rem;
        height: 1rem;
        margin-top: 0;
      }
      .footer-maps-link:hover { color: var(--footer-accent); }

      /* Contact block */
      .footer-contact-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .footer-contact-list li {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        margin-bottom: 0.55rem;
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .footer-contact-icon {
        width: 1.1rem;
        height: 1.1rem;
        flex-shrink: 0;
        margin-top: 0.2rem;
        color: var(--footer-muted);
        transition: color 250ms ease;
      }
      .footer-maps-link:hover .footer-contact-icon,
      .footer-contact-list li:hover .footer-contact-icon {
        color: var(--footer-accent);
      }
      .footer-contact-link {
        color: var(--footer-text);
        text-decoration: none;
        transition: color 250ms ease;
      }
      .footer-contact-link:hover { color: var(--footer-accent); }

      /* ============ ZONE C: legal ============ */
      .footer-bottom {
        padding-block: 1rem;
        border-top: 1px solid var(--footer-border);
        text-align: center;
      }
      .footer-copyright {
        margin: 0;
        font-size: 0.75rem;
        color: var(--footer-muted);
      }
      .footer-social {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        margin: 0;
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

      /* White logo (bottom row) */
      .footer-logo-link {
        display: inline-block;
        flex-shrink: 0;
      }
      .footer-logo {
        display: block;
        width: var(--logo-width);
        max-width: 100%;
        height: auto;
        object-fit: contain;
      }

      /* ============ Accessibility ============ */
      footer.site-footer a:focus-visible {
        outline: 2px solid var(--footer-accent);
        outline-offset: 3px;
        border-radius: 2px;
      }

      /* ============ Responsive ============ */
      @media (max-width: 1024px) {
        /* Tablet: brand row on top, then 2x2 + full-width visit block. */
        .footer-content { grid-template-columns: 1fr 1fr; }
        .footer-brand-block {
          grid-column: 1 / -1;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
        .footer-block:nth-of-type(2) { grid-column: 1 / -1; }
      }
      @media (max-width: 640px) {
        .footer-content { grid-template-columns: 1fr; gap: 1.9rem; }
        .footer-brand-block {
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .footer-social { justify-content: center; }
        .footer-cta-link { padding-inline: 0.25rem; }
        .footer-cta-title { letter-spacing: 0.02em; }
        .footer-bottom { text-align: center; }
      }

      /* ============ Reduced motion ============ */
      @media (prefers-reduced-motion: reduce) {
        .footer-line {
          width: var(--cta-line-w-min) !important;
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
  constructor(private readonly translate: TranslateService) {}

  /** Single sources of truth - no duplicated navigation/social data. */
  readonly navLinks = NAV_LINKS;
  readonly socialLinks = SOCIAL_LINKS;

  /** Editorial two-group navigation from the SAME NAV_LINKS source.
      Group 1: Accueil / À propos / Expertise. Group 2: Projets / Partenariats / Contact. */
  readonly navPrimary = NAV_LINKS.slice(0, 3);
  readonly navSecondary = NAV_LINKS.slice(3);

  /**
   * Google Maps search for the REAL SIGAT address (same data as the
   * 'footer_address' translation key). No coordinates are invented.
   * TODO: replace with the exact Google Maps place URL / coordinates
   * as soon as SIGAT provides them.
   */
  readonly mapsUrl =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('2000, Immeuble Amira 20 Mars, Le Bardo, Tunisie');

  /**
   * tel: href derived from the REAL 'footer_phone' translation value
   * (which is the project's own placeholder data - nothing is invented).
   * Non-digit characters and spaces are stripped for a clean dial link.
   * Falls back safely if the value cannot be read.
   */
  phoneHref(): string {
    const raw = this.translate.instant('footer_phone') ?? '';
    const digits = raw.replace(/\D/g, '');
    return digits ? `tel:+${digits.replace(/^\+/, '')}` : '#';
  }
}
