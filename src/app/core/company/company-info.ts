/**
 * SINGLE SOURCE OF TRUTH for SIGAT's public contact and company details.
 * Footer, contact page, legal page and the forms all read from here —
 * change a value once and the whole site follows.
 *
 * Values marked TODO(SIGAT) are placeholders: anything still a placeholder is
 * hidden from the visitor (see the helpers at the bottom), never shown as "XX".
 */
export const COMPANY_INFO = {
  name: 'SIGAT',
  legalName: 'Société Internationale des Grands Travaux',
  founded: 2010,

  /** VERIFIED (company story + job postings: "Bardo, Tunis") */
  address: '2000, Immeuble Amira, 20 Mars, Le Bardo, Tunisie',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Immeuble+Amira+20+Mars+Le+Bardo+Tunisie',

  /** VERIFIED (provided by SIGAT, 2026-11-23). Move to contact@<domain> once the domain mail exists. */
  email: 'sigatsigat93@gmail.com',
  /** TODO(SIGAT): real phone, e.g. '+216 71 123 456'. While it contains "X" it is hidden everywhere. */
  phone: '+216 XX XXX XXX',

  /** Mon–Fri 8:00–17:00, Sat 8:00–13:00. */
  hours: { weekdays: '08:00 – 17:00', saturday: '08:00 – 13:00' },

  social: {
    /** VERIFIED (provided by SIGAT) */
    linkedin: 'https://www.linkedin.com/company/soci%C3%A9t%C3%A9-international-de-grand-travaux-sigat/',
    /** VERIFIED (provided by SIGAT) */
    facebook: 'https://www.facebook.com/profile.php?id=61593944295806',
  },

  /**
   * Legal identity, shown on /legal. TODO(SIGAT): fill from the RNE extract.
   * Empty strings are shown as "en cours de mise à jour".
   */
  legal: {
    form: 'SARL',                 // TODO(SIGAT): SARL / SA / SUARL ?
    rne: '',                      // Identifiant unique RNE
    taxId: '',                    // Matricule fiscal
    capital: '',                  // e.g. '1 000 000 TND'
    director: '',                 // Gérant / directeur de la publication
    host: '',                     // Hébergeur du site (name + address)
  },

  /**
   * Certification status. SIGAT is NOT certified yet — the process is under way.
   * When a certificate is obtained, set `status: 'certified'`, the body and the year.
   */
  certifications: [
    { std: 'ISO 9001:2015', key: 'quality', status: 'in-progress' as 'in-progress' | 'certified', body: '', year: '' },
    { std: 'ISO 14001:2015', key: 'environment', status: 'in-progress' as 'in-progress' | 'certified', body: '', year: '' },
    { std: 'ISO 45001:2018', key: 'safety', status: 'in-progress' as 'in-progress' | 'certified', body: '', year: '' },
  ],
} as const;

/**
 * Who writes to SIGAT, and which mailbox receives it.
 * All go to the same Gmail for now; the subject tag lets you filter in Gmail
 * (e.g. a filter on "[SIGAT·Fournisseur]" → label "Achats").
 * When dedicated mailboxes exist (commercial@, achats@, rh@ …) change `to` here only.
 */
export type ContactAudience = 'client' | 'supplier' | 'subcontractor' | 'partner' | 'job';

export const CONTACT_ROUTES: Record<ContactAudience, { to: string; tag: string }> = {
  client:        { to: COMPANY_INFO.email, tag: 'Client' },
  supplier:      { to: COMPANY_INFO.email, tag: 'Fournisseur' },
  subcontractor: { to: COMPANY_INFO.email, tag: 'Sous-traitant' },
  partner:       { to: COMPANY_INFO.email, tag: 'Partenariat' },
  job:           { to: COMPANY_INFO.email, tag: 'Candidature' },
};

/**
 * Form delivery. null = the form opens the visitor's e-mail app with everything
 * pre-written (works today, no server). To receive forms directly (and allow file
 * uploads), create a form endpoint (Formspree, Web3Forms, or your own server) and
 * paste its URL here: the form then POSTs JSON to it.
 */
export const FORM_ENDPOINT: string | null = null;

/**
 * Company profile PDF (plaquette) for tenders and partners, e.g. 'assets/docs/sigat-profil.pdf'.
 * null = the "profile" buttons ask for it through the contact form instead.
 */
export const COMPANY_PROFILE_PDF: string | null = null;

/**
 * true while references, openings and figures are illustrative. Shows a discreet
 * "sample data" note on those blocks. Set to false once SIGAT's real data is in.
 */
export const SAMPLE_DATA = true;

const isPlaceholder = (v: string) => !v || /x{2}/i.test(v);

/** Display phone, or null while it is a placeholder (so "XX" is never shown). */
export const COMPANY_PHONE: string | null = isPlaceholder(COMPANY_INFO.phone) ? null : COMPANY_INFO.phone;

/** WhatsApp chat link (null until the real phone number is set). */
export const COMPANY_WHATSAPP = COMPANY_PHONE ? 'https://wa.me/' + COMPANY_PHONE.replace(/\D/g, '') : null;

/** tel: href from the display phone (null while the phone is a placeholder). */
export const COMPANY_TEL = COMPANY_PHONE ? 'tel:' + COMPANY_PHONE.replace(/[^\d+]/g, '') : null;
export const COMPANY_MAILTO = 'mailto:' + COMPANY_INFO.email;
