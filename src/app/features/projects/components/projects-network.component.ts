import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChild, ViewChildren, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { Project } from '../../../core/models/project.model';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';

/**
 * PROJECTS · THE NETWORK — the projects as a real distribution network.
 * A water main runs down the section (fed by the manifold above it). Each project is a branch on a tee
 * with its own gate valve. Scrolling advances the water front down the main; when it reaches a tee the
 * handwheel turns, the branch fills and the card's schematic of its works starts running:
 *   supply  — pressure main (AEP): flow, gauge rising to the service pressure, reservoir filling
 *   sewer   — gravity sewer on its slope, part-full, with a manhole
 *   desal   — reverse osmosis: HP pump, membrane, permeate out, brine out
 *   bridge  — canal bridge: the canal crosses above, the river below
 *   vrd     — roads & utilities: traffic above, water main / sewer / ducts below
 * Animations are CSS (no SMIL), paused until the branch is open; reduced motion = everything open, still.
 */
@Component({
  selector: 'app-projects-network',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div #net class="nw">
      <span class="nw__main" aria-hidden="true"><span #water class="nw__mainWater"></span></span>
      <div class="nw__list">
        @for (p of projects(); track p.id; let i = $index) {
          <article #row class="nw__row" [class.nw__row--r]="i % 2 === 1" [style.grid-column]="(i % 2) + 1" [style.grid-row]="(i + 1) + ' / span 2'">
            <span class="nw__branch" aria-hidden="true">
              <span class="nw__tee"></span>
              <span class="nw__bwater"></span>
              <svg class="nw__valve" viewBox="-20 -24 40 44">
                <rect x="-7" y="2" width="14" height="14" rx="2" class="nw__vbody" />
                <rect x="-1.5" y="-12" width="3" height="15" class="nw__vstem" />
                <g class="nw__wheel"><circle r="9" class="nw__rim" /><line x1="-9" y1="0" x2="9" y2="0" /><line x1="0" y1="-9" x2="0" y2="9" /><circle r="2.4" class="nw__hub" /></g>
              </svg>
            </span>
            <a class="nw__card" [routerLink]="'/projects/' + p.id">
              <span class="nw__photo">
                <img [src]="p.media?.cover ?? p.imageUrl" [alt]="p.title" loading="lazy" decoding="async" />
                <span class="nw__chip">{{ 'projects_filter_' + p.category | translate }} · {{ p.year }}</span>
              </span>
              <span class="nw__schema" aria-hidden="true">
                @switch (p.work) {
                  @case ('sewer') {
                    <svg viewBox="0 0 260 96">
                      <rect x="0" y="0" width="260" height="96" class="s-soil" />
                      <line x1="0" y1="16" x2="260" y2="16" class="s-ground" />
                      <rect x="150" y="16" width="22" height="50" class="s-shaft" />
                      <rect x="146" y="12" width="30" height="5" rx="1" class="s-cover" />
                      @for (k of [0, 1, 2, 3]; track k) { <line [attr.x1]="154" [attr.y1]="24 + k * 10" [attr.x2]="160" [attr.y2]="24 + k * 10" class="s-rung" /> }
                      <line x1="6" y1="44" x2="254" y2="74" class="s-pipe" />
                      <line x1="6" y1="49" x2="254" y2="79" class="s-sewage" />
                      <line x1="6" y1="49" x2="254" y2="79" class="s-dash fl" />
                    </svg>
                  }
                  @case ('desal') {
                    <svg viewBox="0 0 260 96">
                      <line x1="0" y1="36" x2="44" y2="36" class="s-feed" />
                      <g transform="translate(22 36)"><circle r="10" class="s-pump" /><g class="spin"><path d="M0 0 L0 -7 M0 0 L6 3.5 M0 0 L-6 3.5" class="s-imp" /></g></g>
                      <rect x="44" y="20" width="150" height="40" rx="20" class="s-vessel" />
                      <polyline points="58,40 70,36 82,44 94,36 106,44 118,36 130,44 142,36 154,44 166,36 180,40" class="s-membrane" />
                      @for (k of [0, 1, 2, 3, 4]; track k) { <circle [attr.cx]="60 + k * 26" cy="30" r="2" class="s-salt salt" [style.animation-delay]="(k * -0.5) + 's'" /> }
                      <line x1="194" y1="32" x2="260" y2="32" class="s-brine" />
                      <line x1="194" y1="32" x2="260" y2="32" class="s-dash fl" />
                      <path d="M120 60 V80 H260" class="s-perm" />
                      <path d="M120 60 V80 H260" class="s-dash fl" />
                    </svg>
                  }
                  @case ('bridge') {
                    <svg viewBox="0 0 260 96">
                      <rect x="0" y="80" width="260" height="16" class="s-river" />
                      <line x1="0" y1="88" x2="260" y2="88" class="s-dash fl fl--rev" />
                      <path d="M10 48 H250 V44 H10 Z" class="s-deck" />
                      @for (x of [40, 100, 160, 220]; track x) { <rect [attr.x]="x - 5" y="48" width="10" height="32" class="s-pier" /> }
                      @for (x of [40, 100, 160]; track x) { <path [attr.d]="'M' + (x + 5) + ' 80 Q' + (x + 30) + ' 50 ' + (x + 55) + ' 80'" class="s-arch" /> }
                      <rect x="10" y="30" width="240" height="14" class="s-trough" />
                      <rect x="14" y="34" width="232" height="9" class="s-canal" />
                      <line x1="14" y1="38" x2="246" y2="38" class="s-dash fl" />
                    </svg>
                  }
                  @case ('vrd') {
                    <svg viewBox="0 0 260 96">
                      <rect x="0" y="14" width="260" height="10" class="s-road" />
                      <line x1="0" y1="19" x2="260" y2="19" class="s-lane fl fl--rev" />
                      <rect x="0" y="24" width="260" height="8" class="s-base" />
                      <rect x="0" y="32" width="260" height="64" class="s-soil" />
                      <g transform="translate(60 62)"><circle r="11" class="s-dimain" /><circle r="7" class="s-core pulse" /></g>
                      <g transform="translate(132 70)"><circle r="13" class="s-conc" /><path d="M-10 3 A10 10 0 0 0 10 3 Z" class="s-sewage" /></g>
                      <g transform="translate(200 56)"><circle r="7" class="s-duct" /><circle r="7" class="s-duct2 pulse" /></g>
                    </svg>
                  }
                  @default {
                    <svg viewBox="0 0 260 96">
                      <rect x="8" y="52" width="196" height="22" rx="3" class="s-di" />
                      <rect x="12" y="56" width="188" height="14" class="s-water" />
                      <line x1="12" y1="63" x2="200" y2="63" class="s-dash fl" />
                      <line x1="70" y1="52" x2="70" y2="38" class="s-stem" />
                      <g transform="translate(70 28)"><circle r="11" class="s-gauge" /><line x1="0" y1="0" x2="0" y2="-8" class="s-needle ndl" /><circle r="1.6" class="s-hub" /></g>
                      <rect x="206" y="20" width="46" height="58" rx="3" class="s-tank" />
                      <rect x="209" y="23" width="40" height="52" class="s-lvl lvl" />
                    </svg>
                  }
                }
                <span class="nw__cap">{{ 'pj_work_' + (p.work ?? 'supply') | translate }}</span>
              </span>
              <span class="nw__body">
                <span class="nw__title hx-display">{{ p.title }}</span>
                <span class="nw__loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> {{ p.location }}</span>
                <span class="nw__client"><b>{{ 'pj_client' | translate }}</b> {{ p.client }}</span>
                <span class="nw__more">{{ 'pj_open' | translate }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
              </span>
            </a>
          </article>
        }
      </div>
    </div>
  `
})
export class ProjectsNetworkComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  readonly projects = input.required<Project[]>();
  @ViewChild('net', { static: true }) net!: ElementRef<HTMLElement>;
  @ViewChild('water', { static: true }) water!: ElementRef<HTMLElement>;
  @ViewChildren('row') rows!: QueryList<ElementRef<HTMLElement>>;
  private off?: () => void;
  private front = -1;

  ngAfterViewInit(): void {
    const net = this.net.nativeElement, water = this.water.nativeElement;
    this.off = this.ticker.register(net, () => {
      const r = net.getBoundingClientRect();
      // the water front stands a little below the middle of the screen
      const f = this.ticker.reducedMotion ? r.height : Math.max(0, Math.min(r.height, window.innerHeight * 0.62 - r.top));
      if (Math.abs(f - this.front) >= 0.5) { this.front = f; water.style.height = f + 'px'; }
      // (re-evaluated every frame: the filter can change the rows while the front stands still)
      for (const row of this.rows) {
        const el = row.nativeElement, tee = el.offsetTop + (el.querySelector('.nw__branch') as HTMLElement).offsetTop;
        el.classList.toggle('is-on', f >= tee);
      }
    });
  }

  ngOnDestroy(): void { this.off?.(); }
}
