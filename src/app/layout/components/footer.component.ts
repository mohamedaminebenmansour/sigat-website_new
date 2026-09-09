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
            <span class="footer-cta-arrow" aria-hidden="true">→</span>
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
        --footer-muted: #F7F9FB94;           /* secondary text */
        --footer-accent: #f59e0b;          /* existing SIGAT amber (header CTA) */
        --footer-line: rgba(255, 255, 255, 0.55);  /* resting line color */
        --footer-border: rgba(255, 255, 255, 0.12);

        /* ================================
           PARTNER CTA VISUAL TUNING
           ================================ */
        --partner-title-size: clamp(1.8rem, 3vw, 2.8rem);   /* CTA title size */
        --partner-line-height: 2px;                        /* architectural line */
        --partner-line-opacity: 0.6;
        /* Outward reach of each line from the CENTER anchor (capped, so wide
           screens never stretch the lines away from the CTA). */
        --partner-line-max: clamp(7rem, 12vw, 16rem);
        /* Resting fragment length as a fraction of --partner-line-max (short,
           close to the text, before hover). */
        --partner-rest-scale: 0.38;
        /* Shared center anchor; both halves overlap here so they meet with no
           visible seam. Keep it a fraction of a pixel. */
        --partner-center-overlap: 0.5px;
        /* Vertical gap between the CTA title and the top/bottom lines. */
        --partner-y-gap: clamp(1.5rem, 3vw, 2.5rem);
        /* Cap the whole composition so huge screens stay compact. */
        --partner-cta-max-width: min(90vw, 52rem);
        --partner-anim-duration: 850ms;
        --partner-anim-ease: cubic-bezier(0.22, 1, 0.36, 1);

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
         Geometry model - the four line fragments are anchored at the CENTER
         of the CTA composition (never the footer edges). Each fragment's
         CENTER-facing end is fixed at the midline via a shared
         --partner-center-overlap, so scaleX only grows it OUTWARD. The two
         TOP fragments and the two BOTTOM fragments share the exact same
         anchor, so they always meet in the middle with no seam. The whole
         composition is capped by --partner-cta-max-width, and resting length
         is a fraction (--partner-rest-scale) of --partner-line-max, so wide
         screens never stretch the lines away from the text. */
      .footer-cta-link {
        position: relative;
        display: block;
        /* Cap the whole composition and center it relative to the text. */
        margin-inline: auto;
        width: min(100%, var(--partner-cta-max-width));
        padding: clamp(2.25rem, 4.5vw, 3.5rem) 0.5rem;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
      }
      .footer-line {
        position: absolute;
        /* Outward reach; the inner (CENTER) end is anchored below. */
        width: var(--partner-line-max);
        height: var(--partner-line-height);
        background: var(--footer-line);
        opacity: var(--partner-line-opacity);
        transform: scaleX(var(--partner-rest-scale));
        transition:
          transform var(--partner-anim-duration) var(--partner-anim-ease),
          background-color 350ms ease,
          opacity 350ms ease,
          box-shadow 350ms ease;
        pointer-events: none;
        will-change: transform;
      }
      /* LEFT fragments: CENTER-facing (right) end is the anchor,
         so they grow LEFTWARD (outward). */
      .footer-line-top-left,
      .footer-line-bottom-left {
        right: calc(50% - var(--partner-center-overlap));
        transform-origin: right center;
      }
      /* RIGHT fragments: CENTER-facing (left) end is the anchor,
         so they grow RIGHTWARD (outward). */
      .footer-line-top-right,
      .footer-line-bottom-right {
        left: calc(50% - var(--partner-center-overlap));
        transform-origin: left center;
      }
      /* Vertical placement: a line above and a line below the title. */
      .footer-line-top-left,
      .footer-line-top-right { top: calc(50% - var(--partner-y-gap)); }
      .footer-line-bottom-left,
      .footer-line-bottom-right { top: calc(50% + var(--partner-y-gap)); }

      .footer-cta-title {
        margin: 0;
        font-size: var(--partner-title-size);
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #ffffff;
        text-decoration: none;
        transition: color 350ms ease, text-shadow 350ms ease;
      }
      /* Clickability: a discreet arrow that belongs to the same interactive
         target as the text. Always present (also on mobile where there is no
         hover) and nudges on hover/focus and on tap. */
      .footer-cta-arrow {
        display: inline-block;
        margin-inline-start: 0.4rem;
        font-size: 0.72em;
        color: inherit;
        transition: color 350ms ease, transform 350ms ease;
      }

      /* Hover/focus: fragments grow OUTWARD to --partner-line-max. Both
         halves share the center anchor so they meet exactly in the middle. */
      .footer-cta-link:hover .footer-line-top-left,
      .footer-cta-link:hover .footer-line-bottom-left,
      .footer-cta-link:focus-visible .footer-line-top-left,
      .footer-cta-link:focus-visible .footer-line-bottom-left {
        transform: scaleX(1);
      }
      .footer-cta-link:hover .footer-line-top-right,
      .footer-cta-link:hover .footer-line-bottom-right,
      .footer-cta-link:focus-visible .footer-line-top-right,
      .footer-cta-link:focus-visible .footer-line-bottom-right {
        transform: scaleX(1);
      }
      .footer-cta-link:hover .footer-line,
      .footer-cta-link:focus-visible .footer-line {
        background: var(--footer-accent);
        opacity: 1;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
      }
      .footer-cta-link:hover .footer-cta-title,
      .footer-cta-link:focus-visible .footer-cta-title,
      .footer-cta-link:hover .footer-cta-arrow,
      .footer-cta-link:focus-visible .footer-cta-arrow {
        color: var(--footer-accent);
      }
      .footer-cta-link:hover .footer-cta-title,
      .footer-cta-link:focus-visible .footer-cta-title {
        text-shadow: 0 0 18px rgba(245, 158, 11, 0.28);
      }
      .footer-cta-link:hover .footer-cta-arrow,
      .footer-cta-link:focus-visible .footer-cta-arrow,
      .footer-cta-link:active .footer-cta-arrow {
        transform: translateX(0.18rem);
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
        align-items: center;
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
      @media (max-width: 900px) {
        .footer-cta-link { --partner-line-max: clamp(5rem, 12vw, 8rem); --partner-y-gap: 1.4rem; }
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
        .footer-cta-arrow { font-size: 0.9em; }
        .footer-bottom { text-align: center; }
      }
      @media (max-width: 480px) {
        .footer-cta-link { --partner-line-max: clamp(2.5rem, 15vw, 4rem); --partner-y-gap: 1.15rem; --partner-line-height: 1.5px; }
      }

      /* ============ Reduced motion ============ */
      @media (prefers-reduced-motion: reduce) {
        .footer-line {
          /* Stable final (connected) decorative state - no expansion. */
          transform: scaleX(1) !important;
          transition: background-color 200ms ease, opacity 200ms ease;
        }
        .footer-cta-title { transition: color 200ms ease; text-shadow: none; }
        .footer-cta-arrow { transition: none; transform: none; }
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
      Group 1: Accueil / Ã¢â€Å“Ãƒâ€¡ propos / Expertise. Group 2: Projets / Partenariats / Contact. */
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
