import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MockDataService } from '../services/mock-data.service';
import { NAV_LINKS } from '../navigation/navigation.service';
import { AppTranslateService } from '../services/translate.service';

export type SearchKind = 'page' | 'project' | 'expertise' | 'action';

export interface SearchHit {
  kind: SearchKind;
  title: string;
  /** short context line (place, client, description…) */
  sub: string;
  path: string;
  query?: Record<string, string>;
  icon: string;
}

interface Entry extends SearchHit { hay: string; }

const PAGE_ICON: Record<string, string> = {
  '/home': 'fa-house', '/about': 'fa-building', '/expertise': 'fa-gears', '/projects': 'fa-diagram-project',
  '/hse': 'fa-helmet-safety', '/partnerships': 'fa-handshake', '/careers': 'fa-user-plus', '/contact': 'fa-envelope', '/legal': 'fa-scale-balanced',
};

/** everyday words people type for each page (fr / en / ar), on top of its title and description */
const PAGE_WORDS: Record<string, string[]> = {
  '/careers': ['emploi', 'job', 'jobs', 'cv', 'stage', 'recrutement', 'offre', 'career', 'internship', 'وظيفة', 'توظيف'],
  '/contact': ['devis', 'quote', 'adresse', 'address', 'telephone', 'phone', 'email', 'mail', 'bureau', 'office', 'اتصال', 'عنوان'],
  '/hse': ['securite', 'safety', 'qualite', 'quality', 'iso', 'environnement', 'environment', 'سلامة', 'جودة'],
  '/projects': ['chantier', 'chantiers', 'reference', 'references', 'realisations', 'works', 'site', 'مشاريع'],
  '/partnerships': ['fournisseur', 'supplier', 'sous-traitant', 'subcontractor', 'groupement', 'partenaire', 'partner', 'شراكة'],
  '/expertise': ['metier', 'metiers', 'services', 'savoir-faire', 'خبرة'],
  '/about': ['histoire', 'history', 'valeurs', 'values', 'societe', 'company', 'من نحن'],
};

/** accent- and case-insensitive text (so "reservoir" finds "réservoir") */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Client-side site search: pages (title + description), projects (title, place, client, scope),
 * expertise domains (title, description, the works they cover) and the main actions
 * (start a project, become a supplier / subcontractor / partner, apply). Built in the current language.
 */
@Injectable({ providedIn: 'root' })
export class SiteSearchService {
  private readonly t = inject(TranslateService);
  private readonly data = inject(MockDataService);
  private readonly app = inject(AppTranslateService);
  private cache?: { lang: string; entries: Entry[] };

  private index(): Entry[] {
    const lang = this.app.getCurrentLang() || 'fr';
    if (this.cache?.lang === lang) return this.cache.entries;
    const tr = (k: string) => { const v = this.t.instant(k); return typeof v === 'string' && v !== k ? v : ''; };
    const e: Entry[] = [];
    const add = (h: SearchHit, extra: string[]) => e.push({ ...h, hay: norm([h.title, h.sub, ...extra].join(' ')) });

    for (const l of [...NAV_LINKS, { path: '/about', label: 'nav_about' }, { path: '/legal', label: 'seo_legal_t' }]) {
      const page = l.path.slice(1);
      add({ kind: 'page', title: tr(l.label), sub: tr(`seo_${page}_d`), path: l.path, icon: PAGE_ICON[l.path] ?? 'fa-file' }, [tr(`seo_${page}_t`), ...(PAGE_WORDS[l.path] ?? [])]);
    }
    for (const p of this.data.getProjects().filter(p => !p.isOffice)) {
      add({ kind: 'project', title: p.title, sub: `${p.location} · ${p.year}`, path: `/projects/${p.id}`, icon: 'fa-location-dot' },
          [p.client, p.scope, tr('projects_filter_' + p.category), p.work ? tr('pj_work_' + p.work) : '']);
    }
    for (const x of this.data.getExpertise()) {
      const anyX = x as unknown as { slug?: string; titleKey?: string; descriptionKey?: string; detailKeys?: string[] };
      if (!anyX.slug || !anyX.titleKey) continue;
      add({ kind: 'expertise', title: tr(anyX.titleKey), sub: tr(anyX.descriptionKey ?? ''), path: `/expertise/${anyX.slug}`, icon: 'fa-water' },
          (anyX.detailKeys ?? []).map(tr));
    }
    const actions: [string, string, Record<string, string>, string, string[]][] = [
      ['contact_hero_btn_primary', '/contact', { type: 'client' }, 'fa-paper-plane', ['devis', 'quote', 'projet', 'project']],
      ['pt_cta_supplier', '/contact', { type: 'supplier' }, 'fa-truck-ramp-box', ['fournisseur', 'supplier']],
      ['pt_who_subc_cta', '/contact', { type: 'subcontractor' }, 'fa-helmet-safety', ['sous-traitant', 'subcontractor']],
      ['pt_cta_partner', '/contact', { type: 'partner' }, 'fa-handshake', ['partenaire', 'groupement', 'partner']],
      ['careers_cta_spontaneous', '/contact', { type: 'job', role: 'j_spontaneous' }, 'fa-user-plus', ['emploi', 'job', 'cv', 'stage', 'recrutement']],
    ];
    for (const [k, path, query, icon, words] of actions) add({ kind: 'action', title: tr(k), sub: '', path, query, icon }, words);

    this.cache = { lang, entries: e.filter(x => x.title) };
    return this.cache.entries;
  }

  /** ranked hits: every word must match; title matches and word starts rank first */
  search(q: string, limit = 8): SearchHit[] {
    const words = norm(q).split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
    if (!words.length) return [];
    const scored: { h: Entry; s: number }[] = [];
    for (const h of this.index()) {
      const title = norm(h.title);
      let s = 0, ok = true;
      for (const w of words) {
        if (!h.hay.includes(w)) { ok = false; break; }
        s += title.includes(w) ? 3 : 1;
        if (title.startsWith(w) || title.includes(' ' + w)) s += 2;
      }
      if (ok) scored.push({ h, s: s + (h.kind === 'project' ? 0.5 : 0) });
    }
    // groups appear in the order of their best hit; inside a group, best first (keyboard order = display order)
    const top = scored.sort((a, b) => b.s - a.s).slice(0, limit);
    const order: SearchKind[] = [];
    for (const x of top) if (!order.includes(x.h.kind)) order.push(x.h.kind);
    return top.sort((a, b) => order.indexOf(a.h.kind) - order.indexOf(b.h.kind) || b.s - a.s)
      .map(({ h }) => ({ kind: h.kind, title: h.title, sub: h.sub, path: h.path, query: h.query, icon: h.icon }));
  }
}
