/**
 * Core company values — data-driven model shared by the Values section.
 *
 * `icon` holds a Font Awesome class (already loaded globally via CDN in
 * `src/index.html`), so no extra icon dependency is introduced.
 *
 * The array order is the semantic source of truth and MUST NOT be reordered
 * at runtime. The orbit only changes the *visual* position via an offset.
 */
export interface CompanyValue {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
}

export const COMPANY_VALUES: readonly CompanyValue[] = [
  {
    id: 'quality',
    titleKey: 'values_quality_title',
    descriptionKey: 'values_quality_desc',
    icon: 'fa-solid fa-award'
  },
  {
    id: 'engagement',
    titleKey: 'values_commitment_title',
    descriptionKey: 'values_commitment_desc',
    icon: 'fa-solid fa-handshake'
  },
  {
    id: 'responsibility',
    titleKey: 'values_responsibility_title',
    descriptionKey: 'values_responsibility_desc',
    icon: 'fa-solid fa-scale-balanced'
  },
  {
    id: 'safety',
    titleKey: 'values_safety_title',
    descriptionKey: 'values_safety_desc',
    icon: 'fa-solid fa-shield-halved'
  },
  {
    id: 'sustainability',
    titleKey: 'values_sustainability_title',
    descriptionKey: 'values_sustainability_desc',
    icon: 'fa-solid fa-recycle'
  },
  {
    id: 'environment',
    titleKey: 'values_environment_title',
    descriptionKey: 'values_environment_desc',
    icon: 'fa-solid fa-leaf'
  }
];