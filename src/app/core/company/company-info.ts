/**
 * SINGLE SOURCE OF TRUTH for SIGAT's public contact details.
 * Footer, "Suivez-nous" grid and the Contact page all read from here —
 * change a value once and the whole site follows.
 *
 * Status (checked 2026-11-18): LinkedIn and Facebook do not expose phone /
 * e-mail without a login, so only the items marked VERIFIED are confirmed.
 * Replace the TODO values with the real ones from the company pages.
 */
export const COMPANY_INFO = {
  name: 'SIGAT',
  legalName: 'Société Internationale des Grands Travaux',
  founded: 2010,

  /** VERIFIED (company story + job postings: "Bardo, Tunis") */
  address: '2000, Immeuble Amira, 20 Mars, Le Bardo, Tunisie',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Immeuble+Amira+20+Mars+Le+Bardo+Tunisie',

  /** TODO(SIGAT): confirm the official address (sigat.tn vs sigat.com was inconsistent). */
  email: 'contact@sigat.tn',
  /** TODO(SIGAT): real phone, e.g. '+216 71 123 456'. Shown as-is; tel: link built from digits. */
  phone: '+216 XX XXX XXX',

  /** From the previous contact-page design: Mon–Fri 8:00–17:00, Sat 8:00–13:00. */
  hours: { weekdays: '08:00 – 17:00', saturday: '08:00 – 13:00' },

  social: {
    /** VERIFIED (provided by SIGAT) */
    linkedin: 'https://www.linkedin.com/company/soci%C3%A9t%C3%A9-international-de-grand-travaux-sigat/',
    /** VERIFIED (provided by SIGAT) */
    facebook: 'https://www.facebook.com/profile.php?id=61593944295806',
  },
} as const;

/** WhatsApp chat link (null until the real phone number is set). */
export const COMPANY_WHATSAPP = /x/i.test(COMPANY_INFO.phone) ? null : 'https://wa.me/' + COMPANY_INFO.phone.replace(/\D/g, '');

/** tel: href from the display phone (null while the phone is a placeholder). */
export const COMPANY_TEL = /x/i.test(COMPANY_INFO.phone) ? null : 'tel:' + COMPANY_INFO.phone.replace(/[^\d+]/g, '');
export const COMPANY_MAILTO = 'mailto:' + COMPANY_INFO.email;
