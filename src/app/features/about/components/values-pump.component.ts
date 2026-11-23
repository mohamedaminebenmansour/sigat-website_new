import {
  AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChild, ViewChildren, inject, input, signal
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { HxRevealDirective } from '../../../shared/hydro/hx-reveal.directive';
import { Path, Seg, buildPath, clamp, drawGlassPipe } from '../../../shared/hydraulics/hydraulics-core';
import { COMPANY_VALUES } from './values.data';

/** Colour palette for the industrial pump rendering (resolved from CSS vars + variant). */
interface PumpPalette {
  casing: string; casingDark: string; casingLight: string; casingRim: string;
  motor: string; motorDark: string; motorLight: string; motorFin: string;
  shaft: string; shaftDark: string; impeller: string; impellerDark: string; impellerRim: string;
  water: string; waterDark: string; waterSurface: string;
  bolt: string; boltLight: string; gasket: string; accent: string; cavitation: string;
}

/**
 * NOS VALEURS — the pump replaces the old "solar system".
 *
 * Our own centrifugal pump (drawn, cut-away: volute casing, cutwater,
 * backward-curved impeller, top discharge flange + reducer) turns CLOCKWISE,
 * consistent with its left-side vertical discharge. Outside it the water is
 * a free vortex (v ∝ 1/r → ω ∝ 1/r²): the six values ride it clockwise as
 * glass bubbles, each linked to the pump by a log-spiral streamline.
 *
 * Rendering: two canvases (back / front) sandwich the DOM bubbles so values
 * pass behind and in front of the pump, while staying real, focusable
 * buttons with Font Awesome icons and translated text.
 */
@Component({
  selector: 'app-values-pump',
  standalone: true,
  imports: [TranslatePipe, HxRevealDirective],
  template: `
    <section #sec class="vp" [class.vp--feed]="riserX() !== null" [class.vp--head-right]="(riserX() ?? 1) < 0.42" [attr.id]="sectionId()">
      <canvas #back class="vp__cv" aria-hidden="true"></canvas>
      <div class="hx-container vp__head hx-reveal" hxReveal>
        <p class="hx-eyebrow">{{ 'about_values_title' | translate }}</p>
        <h2 class="hx-h2 hx-display">{{ 'values_subtitle' | translate }}</h2>
        <p class="hx-lead hx-lead--dark">{{ 'values_intro' | translate }}</p>
      </div>

      <div #stage class="vp__stage" (pointerleave)="hover.set(-1)">
        @for (v of values; track v.id; let i = $index) {
          <button #planet type="button" class="vp__planet" [class.is-focus]="focus() === i"
                  (mouseenter)="hover.set(i)" (focus)="hover.set(i)" (blur)="hover.set(-1)" (click)="hover.set(i)"
                  [attr.aria-pressed]="focus() === i">
            <img src="assets/brand/bubble.webp" alt="" class="vp__bubble" />
            <i [class]="v.icon" aria-hidden="true"></i>
            <span>{{ v.titleKey | translate }}</span>
          </button>
        }
      </div>
      <canvas #front class="vp__cv vp__cv--front" aria-hidden="true"></canvas>

      <div class="vp__panel" aria-live="polite">
        <span class="vp__ptile" aria-hidden="true"><i [class]="values[focus()].icon"></i></span>
        <div class="vp__pbody">
          <p class="vp__pidx">{{ (focus() + 1).toString().padStart(2, '0') }} <span>/ {{ values.length.toString().padStart(2, '0') }}</span></p>
          <h3 class="hx-display">{{ values[focus()].titleKey | translate }}</h3>
          <p>{{ values[focus()].descriptionKey | translate }}</p>
        </div>
        <span class="vp__dots" aria-hidden="true">@for (v of values; track v.id; let i = $index) { <i [class.is-on]="i === focus()"></i> }</span>
      </div>
      <p class="vp__hint">{{ 'hx_pump_hint' | translate }}</p>
    </section>
  `
})
export class ValuesPumpComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  @ViewChild('sec', { static: true }) sec!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stage!: ElementRef<HTMLElement>;
  @ViewChild('back', { static: true }) back!: ElementRef<HTMLCanvasElement>;
  @ViewChild('front', { static: true }) front!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('planet') planetEls!: QueryList<ElementRef<HTMLElement>>;

  /** Home: x of the discharge riser as a fraction of the section width — the
   *  riser then goes straight up to feed the logo reservoir above. null =
   *  About layout (riser bends and leaves sideways). */
  readonly riserX = input<number | null>(null);
  /** Draw the water source: wet well + suction line + foot valve/strainer. */
  readonly source = input(false);
  readonly sectionId = input('values');
  /** Motor contactor. Home: driven by the reservoir float switches above; About: always on. */
  readonly running = input(true);
  /** Pump model: 'centrifugal' (end-suction, motor + volute) or 'vertical-turbine' (line-shaft, deep well). */
  readonly pumpModel = input<'centrifugal' | 'vertical-turbine'>('centrifugal');
  /** Pump colour variant: 'industrial-blue' | 'navy' | 'mint' | 'slate' | 'orange'. Mirrors --vp-pump-* CSS vars. */
  readonly pumpColor = input<'industrial-blue' | 'navy' | 'mint' | 'slate' | 'orange'>('industrial-blue');

  readonly values = COMPANY_VALUES;
  readonly hover = signal(-1);
  readonly focus = signal(0);

  private off?: () => void;
  private t = 0;        // pump / flow clock
  private orbitT = 0;   // orbit clock (slows down while a value is read)
  private spin = 0;
  /**
   * Machine state. n = rotor speed / rated (inertia: spin-up τ≈0.7 s, coast-down τ≈2.4 s).
   * Affinity laws: H ∝ n², and the pump only delivers once its head beats the
   * static head of the column (H0). Q is what the flow meter reads.
   */
  private n = 1;
  private q = 1;             // delivered flow / rated
  private flowPh = 0;        // ∫ q dt — advects every streak, so slowing never makes them jump
  private chk = 1;           // swing check-valve disc opening 0..1 (it lags the flow)
  private hammer = -1;       // time since the check valve slammed (water hammer), −1 = none
  private static readonly H0 = 0.42;   // static head / shut-off head at rated speed
  private pipe?: Path;
  private suction?: Path;
  /** horizontal discharge run (section coords) carrying the fittings */
  private run?: { x0: number; x1: number; y: number; d: number };
  private pipeKey = '';
  private swirl = Array.from({ length: 60 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() }));
  private g = { w: 1, h: 1, ox: 0, oy: 0, x: 0, y: 0, R: 50, pr: 40, q: 0.4, pipeR: 9 };
  private pal!: PumpPalette;

  /** Resolve the pump colour palette from CSS custom properties (+ variant overrides).
   *  Read once per layout so the canvas stays cheap inside requestAnimationFrame. */
  private refreshPalette(): void {
    const cs = getComputedStyle(this.sec.nativeElement);
    const gv = (name: string, fb: string) => { const v = cs.getPropertyValue(name).trim(); return v ? v : fb; };
    const base: PumpPalette = {
      casing: gv('--vp-pump-casing', '#2c4a7a'), casingDark: gv('--vp-pump-casing-dark', '#162e4f'),
      casingLight: gv('--vp-pump-casing-light', '#5b7aa0'), casingRim: gv('--vp-pump-casing-rim', '#8fb0d8'),
      motor: gv('--vp-pump-motor', '#1f3a5f'), motorDark: gv('--vp-pump-motor-dark', '#102238'),
      motorLight: gv('--vp-pump-motor-light', '#4a6a8f'), motorFin: gv('--vp-pump-motor-fin', '#0c1a2c'),
      shaft: gv('--vp-pump-shaft', '#8fa4b8'), shaftDark: gv('--vp-pump-shaft-dark', '#5b6f83'),
      impeller: gv('--vp-pump-impeller', '#b9c6d4'), impellerDark: gv('--vp-pump-impeller-dark', '#7a8aa0'),
      impellerRim: gv('--vp-pump-impeller-rim', '#e8eef5'),
      water: gv('--vp-pump-water', 'rgba(110,190,255,0.62)'), waterDark: gv('--vp-pump-water-dark', 'rgba(25,110,205,0.78)'),
      waterSurface: gv('--vp-pump-water-surface', 'rgba(230,248,255,0.5)'),
      bolt: gv('--vp-pump-bolt', '#4b5d70'), boltLight: gv('--vp-pump-bolt-light', '#c7d2dd'),
      gasket: gv('--vp-pump-gasket', '#7d93a8'), accent: gv('--vp-pump-accent', '#ff7a1a'),
      cavitation: gv('--vp-pump-cavitation', 'rgba(200,220,255,0.45)'),
    };
    // Variant colour overrides (applied on top of the CSS vars).
    const variant = this.pumpColor();
    const over: Partial<PumpPalette> = variant === 'navy' ? {
      casing: '#0f2b46', casingDark: '#071626', casingLight: '#2a4a6e',
      motor: '#142740', motorDark: '#081320', motorLight: '#2e4a6e',
    } : variant === 'mint' ? {
      casing: '#2e5f6b', casingDark: '#183239', casingLight: '#5e8f9c',
      motor: '#224752', motorDark: '#102228', motorLight: '#4a7a87',
      water: 'rgba(140,210,220,0.62)', waterDark: 'rgba(60,140,155,0.78)',
    } : variant === 'slate' ? {
      casing: '#3d4a5c', casingDark: '#232d3a', casingLight: '#6e7e92',
      motor: '#2d3746', motorDark: '#181e26', motorLight: '#5a6a7e',
      water: 'rgba(150,165,185,0.55)', waterDark: 'rgba(90,105,130,0.7)',
    } : variant === 'orange' ? {
      casing: '#5a3a1a', casingDark: '#2e1d0d', casingLight: '#8f5e2e',
      motor: '#422a12', motorDark: '#1e1308', motorLight: '#6a4a2a', accent: '#e8620a',
    } : {};
    this.pal = { ...base, ...over };
  }

  ngAfterViewInit(): void {
    // tick while ANY part of the section is visible (the riser runs to its top edge)
    this.off = this.ticker.register(this.sec.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  private fit(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
    // two section-sized canvases: keep the pixel budget modest
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  /** w/h = stage size; ox/oy = stage offset inside the section (canvas space). */
  private layout(w: number, h: number, ox: number, oy: number, sw: number, sh: number): void {
    const g = this.g;
    g.w = w; g.h = h; g.ox = ox; g.oy = oy;
    g.x = w / 2; g.y = h * 0.55;
    const feed = this.riserX();
    const narrow = w < 640;
    g.R = clamp(Math.min(w, h) * (narrow ? 0.1 : 0.13), 28, 88);
    g.pr = clamp(g.R * 0.7, narrow ? 24 : 30, 60);
    // Narrow screens: rounder orbits use the height instead of overlapping.
    g.q = clamp((h / w) * 0.62, 0.26, narrow ? 0.78 : 0.5);
    g.pipeR = clamp(g.R * 0.16, 6, 12);
    // Home: place the pump so its discharge nozzle sits right under the logo's J.
    const key = `${w}x${h}x${ox}x${oy}x${sw}x${sh}x${feed}`;
    if (key !== this.pipeKey) {
      this.pipeKey = key;
      // Discharge nozzle (tangential to the volute) → straight up out of the scene.
      // Rises from the nozzle, bends (L-elbow) and leaves the section sideways,
      // under the heading — the pump feeds the rest of the page.
      const nx = ox + g.x - g.R * 0.75;
      const ny = oy + g.y - g.R * 1.95;                // top of the reducer above the discharge flange
      if (feed !== null) {
        if (sw < 768) {
          // phones: short riser, stops under the (full-width) heading
          this.pipe = buildPath(nx, ny, [['L', nx, oy + 6] as Seg]);
          this.run = undefined;
        } else {
          // discharge header: up from the pump, long-radius elbow, a horizontal run
          // carrying the fittings, elbow, then up to the logo's J in the section above
          const rx = feed * sw, yRun = oy + 26, B = 36, d = rx < nx ? -1 : 1;
          this.pipe = buildPath(nx, ny, [
            ['L', nx, yRun + B] as Seg, ['Q', nx, yRun, nx + d * B, yRun] as Seg,
            ['L', rx - d * B, yRun] as Seg, ['Q', rx, yRun, rx, yRun - B] as Seg,
            ['L', rx, -40] as Seg
          ]);
          this.run = { x0: nx + d * B, x1: rx - d * B, y: yRun, d };
        }
      } else {
        const top = oy + 18, bend = Math.min(60, (ny - top) * 0.5);
        const rtl = document.documentElement.dir === 'rtl';
        const exitX = rtl ? ox + w + 2000 : -60;
        const dir = rtl ? 1 : -1;
        this.pipe = buildPath(nx, ny, [
          ['L', nx, top + bend] as Seg,
          ['Q', nx, top, nx + dir * bend, top] as Seg,
          ['L', exitX, top] as Seg
        ]);
      }
      // suction line: from the pump eye down into the wet well
      const wellTop = sh - this.wellH(sh);
      this.suction = this.source() ? buildPath(ox + g.x, oy + g.y + g.R * 1.42, [['L', ox + g.x, wellTop + this.wellH(sh) * 0.62] as Seg]) : undefined;
      this.stage.nativeElement.style.setProperty('--pr', g.pr.toFixed(1) + 'px');
      this.refreshPalette();
    }
  }

  /** Orbit of value i: tilted ellipse, Kepler angular speed. */
  private orbit(i: number) {
    const g = this.g;
    const n = this.values.length;
    const r0 = g.R * 1.9 + g.pr * 0.4;
    const rMax = Math.max(r0 + 10, g.w / 2 - g.pr * 1.05);
    const R = n > 1 ? r0 + ((rMax - r0) * i) / (n - 1) : r0;
    const om = 0.32 * Math.pow(r0 / R, 2);          // free vortex: v ~ 1/r, so omega ~ 1/r^2 (clockwise)
    const th = i * 2.1 + 0.6 + this.orbitT * om;
    const tilt = (i - (n - 1) / 2) * 0.05;
    const ex = R * Math.cos(th);
    const ey = R * Math.sin(th) * g.q;
    return {
      x: g.x + ex * Math.cos(tilt) - ey * Math.sin(tilt),
      y: g.y + ex * Math.sin(tilt) + ey * Math.cos(tilt),
      d: Math.sin(th), R, tilt, th
    };
  }

  /** motor + pump + check valve + column, integrated each frame */
  private machine(dt: number): void {
    const run = this.running() || this.reduced;
    const H0 = ValuesPumpComponent.H0;
    this.n += (run ? (1 - this.n) / 0.7 : -this.n / 2.4) * dt;
    this.n = clamp(this.n, 0, 1);
    // operating point: head left after the static lift drives the flow (H − H0 ∝ Q² friction)
    const qT = Math.sqrt(Math.max(0, (this.n * this.n - H0) / (1 - H0)));
    const prev = this.q;
    this.q += (qT - this.q) * Math.min(1, dt * 5);              // the column has inertia too
    if (this.q < 0.004) this.q = 0;
    // swing check valve: the disc follows the flow, and slams shut when the flow reverses
    const chkT = Math.sqrt(this.q);
    this.chk += (chkT - this.chk) * Math.min(1, dt * (chkT > this.chk ? 6 : 14));
    if (prev > 0 && this.q === 0 && this.hammer < 0) this.hammer = 0;   // Joukowsky surge on closure
    if (this.hammer >= 0) { this.hammer += dt; if (this.hammer > 3) this.hammer = -1; }
    this.flowPh += dt * this.q;
  }

  /** pressure downstream of the check valve, as a fraction of the gauge's range */
  private pressure(): number {
    const H0 = ValuesPumpComponent.H0;
    // running: pump head on its curve; stopped: the column above still stands on the closed disc
    let p = Math.max(H0, this.n * this.n * (1 - 0.18 * this.q * this.q));
    if (this.hammer >= 0) {                                      // damped pressure wave, period 4L/a
      const t = this.hammer;
      p += 0.32 * Math.exp(-t * 1.6) * Math.cos(t * 2 * Math.PI * 2.2);
    }
    return clamp(p, 0, 1.15);
  }

  private get reduced(): boolean { return this.ticker.reducedMotion; }

  private tick(dt: number): void {
    const rect = this.stage.nativeElement.getBoundingClientRect();
    const sr = this.sec.nativeElement.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    const ox = Math.round(rect.left - sr.left), oy = Math.round(rect.top - sr.top);
    this.layout(w, h, ox, oy, sr.width, sr.height);
    const reading = this.hover() >= 0;
    this.t += dt;
    this.machine(dt);
    const n = this.n;
    // the vortex outside the pump decays when it stops, but never quite freezes (values stay legible)
    this.orbitT += dt * (reading ? 0.2 : 1) * (0.3 + 0.7 * n);
    this.spin += dt * 2.6 * n * (reading ? 0.6 : 1);           // impeller ω = n · ω_rated (clockwise)

    const back = this.fit(this.back.nativeElement, sr.width, sr.height);
    const front = this.fit(this.front.nativeElement, sr.width, sr.height);
    const g = this.g;
    if (this.suction) this.drawSource(back, sr.width, sr.height);
    // Home: a coupling (manchette) where the rising main meets the section above
    const rings = this.riserX() !== null && this.pipe ? [60, 220, 380, this.pipe.length - 44] : [60, 220, 380, 540];
    if (this.pipe) drawGlassPipe(back, this.pipe, { r: g.pipeR, flow: 95, t: this.flowPh, rings });
    if (this.run) this.drawFittings(back, reading);
    // Orbits and pump are drawn in stage coordinates.
    back.translate(ox, oy);
    front.translate(ox, oy);
    const orbits = this.values.map((_, i) => this.orbit(i));

    // Orbit trails: far half behind the pump, near half in front.
    for (const [ctx, far] of [[back, true], [front, false]] as const) {
      ctx.save();
      for (const o of orbits) {
        for (const dr of [-4, 0, 4]) {
          ctx.beginPath();
          ctx.ellipse(g.x, g.y, o.R + dr, (o.R + dr) * g.q, o.tilt, far ? Math.PI : 0, far ? Math.PI * 2 : Math.PI);
          ctx.strokeStyle = `rgba(255,255,255,${dr === 0 ? 0.6 : 0.22})`;
          ctx.lineWidth = dr === 0 ? 1.2 : 0.8;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    this.drawStreamlines(back, orbits);
    this.drawPump(front);

    // Place the DOM bubbles.
    let best = 0;
    orbits.forEach((o, i) => { if (o.d > orbits[best].d) best = i; });
    const f = this.hover() >= 0 ? this.hover() : best;
    if (f !== this.focus()) this.focus.set(f);
    this.planetEls.forEach((el, i) => {
      const o = orbits[i];
      const s = (0.92 + 0.22 * o.d) * (this.hover() === i ? 1.15 : 1);
      const n = el.nativeElement;
      n.style.transform = `translate3d(${(o.x - g.pr).toFixed(1)}px, ${(o.y - g.pr).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      n.style.zIndex = String(3 + Math.round((o.d + 1) * 10));          // strict depth order: no label drawn over a nearer bubble
      n.style.opacity = (0.55 + 0.45 * (o.d + 1) / 2).toFixed(2);
      n.style.setProperty('--near', ((o.d + 1) / 2).toFixed(2));
    });
  }

  /**
   * Discharge fittings on the horizontal run, in flow order, as on a real
   * pumping-station header (ductile iron, blue epoxy, flanged PN16):
   *   swing CHECK VALVE (stops back-flow when the pump stops) →
   *   GATE VALVE with handwheel (isolation) →
   *   ELECTROMAGNETIC FLOW METER with converter display →
   *   PRESSURE GAUGE on a tee.
   */
  private drawFittings(ctx: CanvasRenderingContext2D, reading: boolean): void {
    const run = this.run!;
    const r = this.g.pipeR, y = run.y;
    const at = (f: number) => run.x0 + (run.x1 - run.x0) * f;
    const body = (x0: number, w: number, h: number) => {
      const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      g.addColorStop(0, '#5d9be0'); g.addColorStop(0.35, '#2a6fc4'); g.addColorStop(1, '#123f7a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0 - w / 2, y - h / 2, w, h, Math.min(6, h / 4)); ctx.fill();
      ctx.strokeStyle = 'rgba(8,30,60,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    };
    const flanges = (x: number, half: number) => {
      for (const fx of [x - half, x + half]) {
        ctx.fillStyle = '#8fa4b8'; ctx.fillRect(fx - r * 0.28, y - r * 1.55, r * 0.56, r * 3.1);
        ctx.fillStyle = '#4b5d70';
        for (const by of [y - r * 1.25, y + r * 1.25]) { ctx.beginPath(); ctx.arc(fx, by, Math.max(1.4, r * 0.14), 0, 7); ctx.fill(); }
      }
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // 1 · swing check valve
    let x = at(0.16);
    flanges(x, r * 1.7); body(x, r * 3.1, r * 2.3);
    ctx.fillStyle = '#1d4f8f'; ctx.beginPath(); ctx.roundRect(x - r * 1.1, y - r * 1.75, r * 2.2, r * 0.6, 3); ctx.fill();   // bolted cover
    // external lever + counterweight on the disc shaft: it shows the disc opening
    {
      const hx = x - run.d * r * 0.7, hy = y - r * 0.2, L = r * 2.4;
      const a = Math.PI / 2 - run.d * (0.12 + 1.0 * this.chk);         // hangs down when shut, swings downstream with the flow
      const ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L;
      ctx.strokeStyle = '#c7d2dd'; ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#d64545'; ctx.beginPath(); ctx.arc(ex, ey, Math.max(3, r * 0.45), 0, 7); ctx.fill();
      ctx.fillStyle = '#4b5d70'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.6, r * 0.18), 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;                                                   // flow arrow
    ctx.beginPath(); ctx.moveTo(x - run.d * r * 0.8, y); ctx.lineTo(x + run.d * r * 0.8, y);
    ctx.moveTo(x + run.d * r * 0.8, y); ctx.lineTo(x + run.d * r * 0.4, y - r * 0.35);
    ctx.moveTo(x + run.d * r * 0.8, y); ctx.lineTo(x + run.d * r * 0.4, y + r * 0.35); ctx.stroke();

    // 2 · gate valve with handwheel
    x = at(0.4);
    flanges(x, r * 1.5); body(x, r * 2.6, r * 2.6);
    ctx.fillStyle = '#245fae';
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 1.3); ctx.lineTo(x - r * 0.55, y - r * 3.1); ctx.lineTo(x + r * 0.55, y - r * 3.1); ctx.lineTo(x + r * 0.9, y - r * 1.3); ctx.closePath(); ctx.fill();   // bonnet
    ctx.strokeStyle = '#c7d2dd'; ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.beginPath(); ctx.moveTo(x, y - r * 3.1); ctx.lineTo(x, y - r * 4.2); ctx.stroke();                            // stem
    ctx.strokeStyle = '#d64545'; ctx.lineWidth = Math.max(2, r * 0.25);
    ctx.beginPath(); ctx.ellipse(x, y - r * 4.3, r * 1.5, r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();                  // handwheel (seen in perspective)
    ctx.beginPath(); ctx.moveTo(x - r * 1.5, y - r * 4.3); ctx.lineTo(x + r * 1.5, y - r * 4.3); ctx.stroke();

    // 3 · electromagnetic flow meter + converter
    x = at(0.64);
    flanges(x, r * 2.1); body(x, r * 3.8, r * 2.9);
    ctx.fillStyle = '#c9d3dc'; ctx.fillRect(x - r * 0.25, y - r * 2.1, r * 0.5, r * 0.7);
    const bw = r * 6.2, bh = r * 2.4, bx = x - bw / 2, byy = y - r * 2.1 - bh;
    const cg = ctx.createLinearGradient(0, byy, 0, byy + bh); cg.addColorStop(0, '#eef2f6'); cg.addColorStop(1, '#a9b6c3');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(bx, byy, bw, bh, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(30,50,70,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#0d2a1c'; ctx.fillRect(bx + bw * 0.1, byy + bh * 0.2, bw * 0.8, bh * 0.6);                         // LCD
    const q = this.q > 0 ? 42 * this.q + (Math.sin(this.t * 1.7) * 0.4 + Math.sin(this.t * 4.3) * 0.15) * this.q : 0;
    ctx.fillStyle = '#7dff9e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(8, Math.round(bh * 0.3))}px ui-monospace, Consolas, monospace`;
    ctx.fillText(`${q.toFixed(1)} m³/h`, x, byy + bh * 0.5);

    // 4 · pressure gauge on a tee
    x = at(0.87);
    ctx.fillStyle = '#8fa4b8'; ctx.fillRect(x - r * 0.3, y - r * 2.6, r * 0.6, r * 1.6);
    const gr = Math.max(9, r * 1.25), gy = y - r * 2.6 - gr;
    ctx.beginPath(); ctx.arc(x, gy, gr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#8fa4b8'; ctx.lineWidth = Math.max(2, gr * 0.18); ctx.stroke();
    ctx.strokeStyle = '#d64545'; ctx.lineWidth = Math.max(1, gr * 0.12);
    ctx.beginPath(); ctx.arc(x, gy, gr * 0.78, Math.PI * 0.2, Math.PI * 0.45); ctx.stroke();                          // red zone
    // needle sweeps 270°; blade-pass pulsation only while the impeller turns
    const ang = -Math.PI * 1.25 + this.pressure() * Math.PI * 1.25 + Math.sin(this.t * 9) * 0.02 * this.n;
    ctx.strokeStyle = '#1f3b57'; ctx.lineWidth = Math.max(1.2, gr * 0.1);
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + Math.cos(ang) * gr * 0.75, gy + Math.sin(ang) * gr * 0.75); ctx.stroke();
    ctx.fillStyle = '#1f3b57'; ctx.beginPath(); ctx.arc(x, gy, gr * 0.12, 0, 7); ctx.fill();
    ctx.restore();
  }

  private wellH(sh: number): number { return clamp(sh * 0.11, 60, 120); }

  /**
   * The source: a wet well (bâche) at the bottom of the scene. The suction
   * line dips into it; a foot valve with strainer keeps the line primed.
   * Water flows UP the suction line toward the pump eye.
   */
  private drawSource(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const top = sh - this.wellH(sh);
    const g = this.g;
    if (this.suction) drawGlassPipe(ctx, this.suction, { r: g.pipeR * 0.95, flow: -80, t: this.flowPh, rings: [40] });
    // foot valve + strainer at the bottom of the suction line
    const fx = g.ox + g.x, fy = top + this.wellH(sh) * 0.62;
    ctx.fillStyle = '#7d93a8';
    ctx.fillRect(fx - g.pipeR * 1.6, fy - 4, g.pipeR * 3.2, 8);
    ctx.fillStyle = '#5b6f83';
    ctx.fillRect(fx - g.pipeR * 1.3, fy + 4, g.pipeR * 2.6, g.pipeR * 2.2);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    for (let k = 1; k < 5; k++) { const x = fx - g.pipeR * 1.3 + (k * g.pipeR * 2.6) / 5; ctx.beginPath(); ctx.moveTo(x, fy + 6); ctx.lineTo(x, fy + 4 + g.pipeR * 2); ctx.stroke(); }
    // the well water (drawn over the pipe end: it is submerged)
    ctx.beginPath();
    for (let x = 0; x <= sw; x += 12) {
      const y = top + Math.sin(x * 0.012 + this.t * 1.4) * 3 + Math.sin(x * 0.031 - this.t * 2.1) * 1.5
        - (Math.abs(x - fx) < 40 ? 2.5 * this.q * Math.cos(((x - fx) / 40) * Math.PI / 2) : 0); // draw-down at the intake ∝ Q
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(sw, sh); ctx.lineTo(0, sh); ctx.closePath();
    const wg = ctx.createLinearGradient(0, top, 0, sh);
    wg.addColorStop(0, 'rgba(110,192,245,0.78)'); wg.addColorStop(1, 'rgba(21,101,192,0.95)');
    ctx.fillStyle = wg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= sw; x += 12) {
      const y = top + Math.sin(x * 0.012 + this.t * 1.4) * 3 + Math.sin(x * 0.031 - this.t * 2.1) * 1.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /*
   * OUR CENTRIFUGAL PUMP (front view, cut-away), R = impeller tip radius.
   * Rotation is CLOCKWISE: the discharge leaves vertically upward on the LEFT
   * of the casing, and in a volute the flow exits tangentially in the
   * direction of rotation, so the impeller, the casing flow, the swirl and
   * the values (free vortex outside) all turn clockwise.
   *  - volute: outer wall r(phi) = R(1.10 + 0.30u), phi from the cutwater (-80 deg)
   *    clockwise to 190 deg, then the passage turns up into the top nozzle;
   *  - impeller: 6 backward-curved blades theta(r) = theta0 - k ln(r/r1)
   *    (they lean against the rotation), hub, eye, shaft with keyway;
   *  - discharge: bolted flange + concentric reducer to the riser.
   */
  private static readonly PHI0 = (-80 * Math.PI) / 180;
  private static readonly PHI1 = (190 * Math.PI) / 180;

  /** Casing passage outline (closed): spiral wall -> nozzle -> tongue. */
  private casingPath(ctx: CanvasRenderingContext2D): void {
    const { x, y, R } = this.g;
    const P0 = ValuesPumpComponent.PHI0, P1 = ValuesPumpComponent.PHI1;
    ctx.beginPath();
    for (let k = 0; k <= 72; k++) {
      const u = k / 72, ph = P0 + (P1 - P0) * u, r = R * (1.1 + 0.3 * u);
      const px = x + Math.cos(ph) * r, py = y + Math.sin(ph) * r;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    // the passage turns up into the nozzle (outer wall at x - R)
    ctx.quadraticCurveTo(x - R * 1.42, y - R * 0.95, x - R, y - R * 1.25);
    ctx.lineTo(x - R, y - R * 1.55);
    ctx.lineTo(x - R * 0.5, y - R * 1.55);
    ctx.lineTo(x - R * 0.5, y - R * 1.2);
    // inner nozzle wall -> cutwater (tongue) at the start of the spiral
    ctx.quadraticCurveTo(x - R * 0.42, y - R * 1.02, x + Math.cos(P0) * R * 1.03, y + Math.sin(P0) * R * 1.03);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------ pump entry point (dispatcher) */
  private drawPump(ctx: CanvasRenderingContext2D): void {
    const { x, y, R } = this.g;
    const p = this.pal;
    const n = this.n;
    const q = this.q;
    const spin = this.spin;

    // Paint back → front so overlapping parts occlude correctly.
    this.drawBasePlate(ctx, x, y, R, p);
    this.drawMotor(ctx, x, y, R, p, spin, n);
    this.drawSuctionNozzle(ctx, x, y, R, p, q);
    this.drawWaterInCasing(ctx, x, y, R, p, q, n);
    this.drawCasingWall(ctx, x, y, R, p);
    this.drawWearRing(ctx, x, y, R, p);
    this.drawImpeller(ctx, x, y, R, p, spin, n);
    this.drawShaftSeal(ctx, x, y, R, p, n);
    this.drawDischargeNozzle(ctx, x, y, R, p, q);
    if (q > 0.5 && n > 0.25) this.drawCavitation(ctx, x, y, R, p, q, n);
  }

  /* concrete plinths (the suction passes between them) with anchor bolts; cast feet of the casing bolted on */
  private drawBasePlate(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette): void {
    const top = y + R * 1.32, h = R * 0.5, gap = R * 0.62, w = R * 1.25;
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? x - gap - w : x + gap;
      const g = ctx.createLinearGradient(0, top, 0, top + h);
      g.addColorStop(0, '#d3cfc6'); g.addColorStop(1, '#a9a399');
      ctx.fillStyle = g; ctx.fillRect(x0, top, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0, top + h - R * 0.06, w, R * 0.06);
      // cast foot of the casing, bolted to the plinth
      const fx = sx < 0 ? x - gap - R * 0.38 : x + gap + R * 0.02;
      ctx.beginPath(); ctx.moveTo(fx, top); ctx.lineTo(fx + R * 0.36, top); ctx.lineTo(fx + R * (sx < 0 ? 0.36 : 0.18), top - R * 0.24); ctx.lineTo(fx + R * (sx < 0 ? 0.18 : 0), top - R * 0.24); ctx.closePath();
      ctx.fillStyle = p.casingDark; ctx.fill();
      for (const bx of [fx + R * 0.08, fx + R * 0.28]) {
        ctx.fillStyle = p.boltLight; ctx.beginPath(); ctx.arc(bx, top - R * 0.03, R * 0.04, 0, Math.PI * 2); ctx.fill();
      }
      // anchor bolts of the motor feet on the outer end
      const ax = sx < 0 ? x0 + R * 0.2 : x0 + w - R * 0.2;
      ctx.fillStyle = p.bolt; ctx.fillRect(ax - R * 0.05, top - R * 0.05, R * 0.1, R * 0.05);
    }
  }
  /* suction nozzle: water enters from the bottom */
  private drawSuctionNozzle(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, q: number): void {
    const nr = R * 0.42, ny = y + R * 1.45, pipeW = R * 0.95;
    ctx.beginPath(); ctx.moveTo(x - pipeW / 2, y + R * 2.35); ctx.lineTo(x - pipeW / 2, ny - nr * 0.6);
    ctx.lineTo(x + pipeW / 2, ny - nr * 0.6); ctx.lineTo(x + pipeW / 2, y + R * 2.35); ctx.closePath();
    const pg = ctx.createLinearGradient(x - pipeW / 2, y + R * 1.2, x + pipeW / 2, y + R * 2.35);
    pg.addColorStop(0, p.casingDark); pg.addColorStop(0.5, p.casing); pg.addColorStop(1, p.casingDark);
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = p.bolt; ctx.lineWidth = Math.max(1, R * 0.05); ctx.stroke();
    this.drawFlange(ctx, x, ny, nr * 1.15, R * 0.14, p);
    if (q > 0.05) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, ny, nr * 0.72, Math.PI * 0.55, Math.PI * 1.45);
      ctx.strokeStyle = p.waterSurface; ctx.lineWidth = Math.max(1.5, R * 0.05); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    }
  }
  /* water inside the volute (cut-away) */
  private drawWaterInCasing(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, q: number, n: number): void {
    this.casingPath(ctx); ctx.save(); this.casingPath(ctx); ctx.clip();
    const fill = 0.32 + 0.5 * q, fy = y + R * 1.05 - fill * R * 1.6;
    const wg = ctx.createLinearGradient(x, fy - R * 0.4, x, fy + R * 0.4);
    wg.addColorStop(0, p.waterSurface); wg.addColorStop(0.5, p.water); wg.addColorStop(1, p.waterDark);
    ctx.fillStyle = wg; ctx.beginPath(); this.casingPath(ctx); ctx.clip(); ctx.rect(x - R * 1.7, fy, R * 3.4, R * 3); ctx.fill();
    const shine = (Math.sin(this.t * 4 * n + 1) * 0.5 + 0.5) * n * q;
    ctx.fillStyle = `rgba(255,255,255,${(0.18 * shine).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(x, fy - R * 0.15, R * 0.9, R * 0.18, 0, 0, Math.PI); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(x - R * 1.65, y); ctx.lineTo(x + R * 1.65, y);
    ctx.strokeStyle = `rgba(255,255,255,${(0.25 + 0.15 * n).toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();
  }
  /* volute casing wall (heavy cast iron) */
  private drawCasingWall(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette): void {
    this.casingPath(ctx);
    const cg = ctx.createLinearGradient(x - R * 1.6, y - R * 1.7, x + R * 1.6, y + R * 1.7);
    cg.addColorStop(0, p.casingLight); cg.addColorStop(0.35, p.casing); cg.addColorStop(0.65, p.casingDark); cg.addColorStop(1, p.motorDark);
    ctx.strokeStyle = cg; ctx.lineWidth = Math.max(4, R * 0.11); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = p.casingRim; ctx.lineWidth = Math.max(1.2, R * 0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - R * 1.55, y); ctx.lineTo(x + R * 1.55, y);
    ctx.strokeStyle = p.bolt; ctx.lineWidth = Math.max(1, R * 0.035); ctx.setLineDash([R * 0.12, R * 0.12]); ctx.stroke(); ctx.setLineDash([]);
  }
  /* stationary wear ring around the impeller eye */
  private drawWearRing(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette): void {
    const r1 = R * 0.3, r2 = R * 0.36;
    const gr = ctx.createRadialGradient(x, y, r1, x, y, r2);
    gr.addColorStop(0, p.shaftDark); gr.addColorStop(0.45, p.shaft); gr.addColorStop(1, p.motorDark);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r1, 0, Math.PI * 2); ctx.fillStyle = p.motorDark; ctx.fill();
    ctx.strokeStyle = p.boltLight; ctx.lineWidth = Math.max(1, R * 0.03);
    ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r1, 0, Math.PI * 2); ctx.stroke();
  }
  /* spinning metallic impeller */
  private drawImpeller(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, spin: number, n: number): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
    const r1 = R * 0.3, r2 = R * 0.95, k = 0.95, bladeW = R * 0.11;
    const sh = ctx.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.05, 0, 0, R);
    sh.addColorStop(0, p.impellerRim); sh.addColorStop(0.42, p.impeller); sh.addColorStop(1, p.impellerDark);
    ctx.beginPath(); ctx.arc(0, 0, r2 * 1.01, 0, Math.PI * 2); ctx.fillStyle = sh; ctx.fill();
    ctx.strokeStyle = p.impellerDark; ctx.lineWidth = Math.max(1.5, R * 0.03); ctx.stroke();
    const bg = ctx.createLinearGradient(-R, -R, R, R);
    bg.addColorStop(0, p.impellerRim); bg.addColorStop(0.35, p.impeller); bg.addColorStop(1, p.impellerDark);
    ctx.lineCap = 'round';
    for (let b = 0; b < 6; b++) {
      const th0 = (b * Math.PI) / 3;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 16; j++) {
        const r = r1 + ((r2 - r1) * j) / 16;
        const th = th0 - k * Math.log(r / r1);
        pts.push({ x: Math.cos(th) * r, y: Math.sin(th) * r });
      }
      for (let j = 0; j < pts.length - 1; j++) {
        const pt = pts[j], npt = pts[j + 1];
        const dx = npt.x - pt.x, dy = npt.y - pt.y, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        ctx.beginPath(); ctx.moveTo(pt.x + nx * bladeW * 0.5, pt.y + ny * bladeW * 0.5);
        ctx.lineTo(npt.x + nx * bladeW * 0.5, npt.y + ny * bladeW * 0.5);
        ctx.lineTo(npt.x - nx * bladeW * 0.5, npt.y - ny * bladeW * 0.5);
        ctx.lineTo(pt.x - nx * bladeW * 0.5, pt.y - ny * bladeW * 0.5); ctx.closePath();
        const g = ctx.createLinearGradient(pt.x, pt.y, npt.x, npt.y);
        g.addColorStop(0, p.impellerRim); g.addColorStop(0.5, p.impeller); g.addColorStop(1, p.impellerDark);
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = p.shaftDark; ctx.lineWidth = Math.max(1, R * 0.02); ctx.stroke();
      }
    }
    const hg = ctx.createRadialGradient(-R * 0.1, -R * 0.1, 1, 0, 0, R * 0.34);
    hg.addColorStop(0, p.impellerRim); hg.addColorStop(1, p.shaftDark);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = p.shaftDark; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2); ctx.fillStyle = p.motorDark; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.11, 0, Math.PI * 2); ctx.fillStyle = p.boltLight; ctx.fill();
    ctx.fillStyle = p.motorDark; ctx.fillRect(-R * 0.022, -R * 0.11, R * 0.044, R * 0.05);
    if (n > 0.5) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.12 * (n - 0.5)).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, R * 0.04); ctx.beginPath(); ctx.arc(0, 0, r2 * 1.03, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  /* shaft seal / stuffing box */
  private drawShaftSeal(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, n: number): void {
    const sx = x + R * 0.62, sy = y, gl = R * 0.14, gr = R * 0.11;
    ctx.fillStyle = p.shaftDark; ctx.fillRect(sx - gl, sy - gr * 1.4, gl * 1.5, gr * 2.8);
    ctx.strokeStyle = p.bolt; ctx.lineWidth = Math.max(1, R * 0.03); ctx.strokeRect(sx - gl, sy - gr * 1.4, gl * 1.5, gr * 2.8);
    for (const syb of [sy - gr * 0.8, sy + gr * 0.8]) {
      ctx.fillStyle = p.boltLight; ctx.beginPath(); ctx.arc(sx - gl * 0.35, syb, R * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = p.shaft; ctx.fillRect(sx - gl * 0.5, sy - R * 0.025, gl * 0.5, R * 0.05);
    const leak = Math.min(1, Math.max(0, (n - 0.6) * 3)) * Math.max(0, Math.sin(this.t * 2.2));
    if (leak > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${(0.35 * leak).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(sx, sy + gr * 1.5 + leak * 4, R * 0.025, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* discharge nozzle: vertical, upward pumping direction */
  private drawDischargeNozzle(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, q: number): void {
    const nx = x - R * 0.72, ny = y - R * 1.5, nr = R * 0.34;
    this.drawFlange(ctx, nx, ny - nr * 0.2, R * 0.52, R * 0.3, p);
    ctx.beginPath(); ctx.moveTo(nx - nr, ny - nr * 0.6); ctx.lineTo(nx - nr, ny - R * 1.05);
    ctx.lineTo(nx + nr, ny - R * 1.05); ctx.lineTo(nx + nr, ny - nr * 0.6); ctx.closePath();
    const pg = ctx.createLinearGradient(nx - nr, ny - R * 1.1, nx + nr, ny - nr * 0.6);
    pg.addColorStop(0, p.casingDark); pg.addColorStop(0.5, p.casing); pg.addColorStop(1, p.casingDark);
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = p.bolt; ctx.lineWidth = Math.max(1, R * 0.04); ctx.stroke();
    ctx.save(); ctx.beginPath();
    ctx.moveTo(nx - nr * 0.5, ny - nr * 0.6); ctx.lineTo(nx - nr * 0.5, ny - R * 1.05);
    ctx.moveTo(nx, ny - nr * 0.6); ctx.lineTo(nx, ny - R * 1.05);
    ctx.moveTo(nx + nr * 0.5, ny - nr * 0.6); ctx.lineTo(nx + nr * 0.5, ny - R * 1.05);
    ctx.setLineDash([R * 0.16, R * 0.2]); ctx.lineDashOffset = this.flowPh * R * 2.2;
    ctx.strokeStyle = `rgba(230,248,255,${(0.55 + 0.25 * q).toFixed(2)})`; ctx.lineWidth = Math.max(1.2, R * 0.04); ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  /* TEFC electric motor behind the casing, on the same shaft: seen end-on, offset up-right for depth —
     finned frame (fins are radial when seen along the shaft), feet on the plinths, terminal box, lifting eye */
  private drawMotor(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, spin: number, n: number): void {
    const mx = x + R * 0.55, my = y - R * 0.6, Rm = R * 1.28, fins = 36;
    // feet down to the plinths
    ctx.fillStyle = p.motorDark;
    for (const sx of [-1, 1]) {
      const fx = mx + sx * Rm * 0.72;
      ctx.beginPath(); ctx.moveTo(fx - R * 0.16, my + Rm * 0.6); ctx.lineTo(fx + R * 0.16, my + Rm * 0.6);
      ctx.lineTo(fx + R * 0.24, y + R * 1.32); ctx.lineTo(fx - R * 0.24, y + R * 1.32); ctx.closePath(); ctx.fill();
    }
    // fins
    ctx.save(); ctx.translate(mx, my);
    for (let i = 0; i < fins; i++) {
      ctx.save(); ctx.rotate((i / fins) * Math.PI * 2);
      ctx.fillStyle = p.motorDark;                                    // cast cooling fins: short, rounded
      ctx.beginPath(); ctx.roundRect(-R * 0.03, -Rm - R * 0.085, R * 0.06, R * 0.12, R * 0.03); ctx.fill();
      ctx.restore();
    }
    // frame
    const fg = ctx.createRadialGradient(-Rm * 0.35, -Rm * 0.35, Rm * 0.1, 0, 0, Rm);
    fg.addColorStop(0, p.motorLight); fg.addColorStop(0.55, p.motor); fg.addColorStop(1, p.motorDark);
    ctx.beginPath(); ctx.arc(0, 0, Rm, 0, Math.PI * 2); ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = p.motorFin; ctx.lineWidth = Math.max(1.2, R * 0.03); ctx.stroke();
    // end shield ring + bolts
    ctx.beginPath(); ctx.arc(0, 0, Rm * 0.82, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(1, R * 0.025); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; ctx.fillStyle = p.boltLight; ctx.beginPath(); ctx.arc(Math.cos(a) * Rm * 0.9, Math.sin(a) * Rm * 0.9, R * 0.035, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // terminal box and lifting eye on top
    const tbw = R * 0.62, tbh = R * 0.34, ty = my - Rm - R * 0.08;
    ctx.fillStyle = p.motorDark; ctx.beginPath(); ctx.roundRect(mx - tbw / 2, ty - tbh, tbw, tbh, R * 0.05); ctx.fill();
    ctx.strokeStyle = p.motorLight; ctx.lineWidth = Math.max(1, R * 0.02); ctx.stroke();
    ctx.fillStyle = p.bolt; ctx.fillRect(mx + tbw / 2, ty - tbh * 0.6, R * 0.14, R * 0.09);              // cable gland
    ctx.strokeStyle = p.motorLight; ctx.lineWidth = Math.max(1.5, R * 0.04);
    ctx.beginPath(); ctx.arc(mx - Rm * 0.55, my - Rm * 0.86, R * 0.09, Math.PI, 0); ctx.stroke();          // lifting eye
    // a soft hum glow when running
    if (n > 0.55) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.08 * (n - 0.55)).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, R * 0.03); ctx.beginPath(); ctx.arc(mx, my, Rm + R * 0.18, 0, Math.PI * 2); ctx.stroke();
    }
  }
  /* bolted flange helper */
  private drawFlange(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, thick: number, p: PumpPalette): void {
    const g = ctx.createLinearGradient(cx, cy - thick, cx, cy + thick);
    g.addColorStop(0, p.casingLight); g.addColorStop(0.5, p.casing); g.addColorStop(1, p.casingDark);
    ctx.fillStyle = g; ctx.fillRect(cx - half, cy - thick, half * 2, thick * 2);
    ctx.strokeStyle = p.shaftDark; ctx.lineWidth = Math.max(1, thick * 0.25); ctx.strokeRect(cx - half, cy - thick, half * 2, thick * 2);
    const boltR = half * 0.78, boltN = 8;
    for (let i = 0; i < boltN; i++) {
      const ang = (i / boltN) * Math.PI * 2;
      const bx = cx + Math.cos(ang) * boltR, by = cy + Math.sin(ang) * boltR;
      ctx.fillStyle = p.boltLight; ctx.beginPath(); ctx.arc(bx, by, thick * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.bolt; ctx.beginPath(); ctx.arc(bx, by, thick * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = p.gasket; ctx.lineWidth = Math.max(1, thick * 0.18);
    ctx.beginPath(); ctx.ellipse(cx, cy, half * 0.92, thick * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
  }
  /* cavitation bubbles near the impeller eye */
  private drawCavitation(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: PumpPalette, q: number, n: number): void {
    for (let i = 0; i < 8; i++) {
      const ang = this.t * 1.3 + (i / 8) * Math.PI * 2;
      const rr = R * (0.42 + 0.35 * Math.sin(this.t + i));
      const bx = x + Math.cos(ang) * rr, by = y + Math.sin(ang) * rr * 0.85;
      const rad = R * (0.015 + 0.03 * Math.abs(Math.sin(this.t * 3 + i)));
      ctx.fillStyle = p.cavitation; ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  /**
   * Streamlines from the pump to each value. In a source + free vortex the
   * streamlines are logarithmic spirals theta(r) = theta_b - c ln(Rb/r)
   * (clockwise swirl with outward flow). Drawn in the orbit projection;
   * water flows outward along them; the selected value's line is highlighted.
   */
  private drawStreamlines(ctx: CanvasRenderingContext2D, orbits: { R: number; th: number; tilt: number }[]): void {
    const g = this.g;
    const r0 = g.R * 1.45, c = 0.85;
    ctx.save();
    ctx.lineCap = 'round';
    orbits.forEach((o, i) => {
      if (o.R <= r0) return;
      const on = i === this.focus();
      ctx.beginPath();
      for (let j = 0; j <= 28; j++) {
        const r = r0 + ((o.R - r0) * j) / 28;
        const th = o.th - c * Math.log(o.R / r);
        const ex = r * Math.cos(th), ey = r * Math.sin(th) * g.q;
        const px = g.x + ex * Math.cos(o.tilt) - ey * Math.sin(o.tilt);
        const py = g.y + ex * Math.sin(o.tilt) + ey * Math.cos(o.tilt);
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.setLineDash(on ? [6, 9] : [3, 10]);
      ctx.lineDashOffset = -this.flowPh * (on ? 42 : 24);
      ctx.strokeStyle = on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = on ? 2.2 : 1.1;
      ctx.stroke();
    });
    ctx.restore();
  }
}
