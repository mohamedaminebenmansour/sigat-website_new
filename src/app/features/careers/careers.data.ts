/**
 * Open positions shown on /careers.
 * TODO(SIGAT): replace with the real openings (or empty the list: the page then
 * shows only the spontaneous application). `role` must be one of the job
 * positions of the contact form (j_engineer, j_foreman, j_technician, j_operator,
 * j_hse, j_admin, j_intern) so "Apply" preselects it.
 * Texts are translation keys: careers_job_<id>_title / _desc in fr/en/ar.json.
 */
export interface Opening {
  id: string;
  role: string;
  icon: string;
  /** translation key of the place, or plain text */
  place: string;
  /** contract key: careers_contract_cdi / cdd / stage */
  contract: 'cdi' | 'cdd' | 'stage';
}

export const OPENINGS: Opening[] = [
  { id: 'works_engineer', role: 'j_engineer', icon: 'fa-helmet-safety', place: 'careers_place_tunis', contract: 'cdi' },
  { id: 'foreman_pipes', role: 'j_foreman', icon: 'fa-person-digging', place: 'careers_place_sites', contract: 'cdd' },
  { id: 'hse_officer', role: 'j_hse', icon: 'fa-shield-halved', place: 'careers_place_sites', contract: 'cdi' },
  { id: 'intern', role: 'j_intern', icon: 'fa-graduation-cap', place: 'careers_place_tunis', contract: 'stage' },
];
