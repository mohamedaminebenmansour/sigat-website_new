import { CompanyStat } from '../models/company-stat.model';

export const COMPANY_STATS: CompanyStat[] = [
  { labelKey: 'home_stat_years', value: 15, suffix: '+', icon: 'fa-solid fa-calendar-check' },
  { labelKey: 'home_stat_projects', value: 120, suffix: '+', icon: 'fa-solid fa-building' },
  { labelKey: 'home_stat_pipelines', value: 500, suffix: 'km+', icon: 'fa-solid fa-water' },
  { labelKey: 'home_stat_employees', value: 300, suffix: '+', icon: 'fa-solid fa-users' }
];
