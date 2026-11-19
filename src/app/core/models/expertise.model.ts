export interface Expertise {
  id: number;
  /** Legacy English copy (still used by the expertise detail page). */
  title: string;
  description: string;
  iconClass: string;
  details: string[];

  // ------------------------------------------------------------------
  // Translatable presentation (Expertise page hub + flow list). Optional so
  // older consumers keep working.
  // ------------------------------------------------------------------
  /** Route segment under /expertise (e.g. 'pipeline'). */
  slug?: string;
  /** i18n keys — titleKey, descriptionKey and one key per detail line. */
  titleKey?: string;
  descriptionKey?: string;
  detailKeys?: string[];
  /** Field photo for the card (path without the -768/-1280 suffix). */
  image?: string;
}
