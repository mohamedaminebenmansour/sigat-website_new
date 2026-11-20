import {
  AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChild, ViewChildren, inject, input, signal
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { HxRevealDirective } from '../../../shared/hydro/hx-reveal.directive';
import { Path, Seg, buildPath, clamp, drawGlassPipe } from '../../../shared/hydraulics/hydraulics-core';
import { COMPANY_VALUES } from './values.data';

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
        <h3 class="hx-display"><i [class]="values[focus()].icon" aria-hidden="true"></i> {{ values[focus()].titleKey | translate }}</h3>
        <p>{{ values[focus()].descriptionKey | translate }}</p>
        <small>{{ 'hx_pump_hint' | translate }}</small>
      </div>
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
      const s = (1 + 0.2 * o.d) * (this.hover() === i ? 1.15 : 1);
      const n = el.nativeElement;
      n.style.transform = `translate3d(${(o.x - g.pr).toFixed(1)}px, ${(o.y - g.pr).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      n.style.zIndex = o.d >= 0 ? '3' : '1';
      n.style.opacity = (0.78 + 0.22 * (o.d + 1) / 2).toFixed(2);
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

  private drawPump(ctx: CanvasRenderingContext2D): void {
    const { x, y, R } = this.g;
    const t = this.t;

    // 1. water in the casing (cut-away)
    this.casingPath(ctx);
    const wg = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 1.5);
    wg.addColorStop(0, 'rgba(120,200,250,0.55)'); wg.addColorStop(1, 'rgba(25,110,205,0.75)');
    ctx.fillStyle = wg; ctx.fill();

    // 2. flow streaks in the volute: clockwise, faster toward the outlet
    ctx.save();
    this.casingPath(ctx); ctx.clip();
    ctx.lineCap = 'round';
    for (const p of this.swirl) {
      const a = p.a + this.spin * (0.55 + p.r * 0.35);           // clockwise
      const rr = R * (1.02 + 0.32 * p.r);
      ctx.beginPath(); ctx.arc(x, y, rr, a, a + 0.22 + 0.2 * p.r);
      ctx.strokeStyle = `rgba(230,248,255,${(0.35 + 0.4 * p.r).toFixed(2)})`; ctx.lineWidth = 1.4; ctx.stroke();
    }
    // streaks rising in the discharge nozzle
    ctx.setLineDash([R * 0.18, R * 0.22]);
    ctx.lineDashOffset = this.flowPh * R * 2.2;
    ctx.strokeStyle = 'rgba(230,248,255,0.7)'; ctx.lineWidth = 1.4;
    for (const f of [0.35, 0.5, 0.65]) {
      ctx.beginPath(); ctx.moveTo(x - R + f * R * 0.5, y - R * 0.95); ctx.lineTo(x - R + f * R * 0.5, y - R * 1.55); ctx.stroke();
    }
    ctx.restore();

    // 3. impeller (rotating clockwise)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.spin);
    const sh = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    sh.addColorStop(0, 'rgba(225,235,245,0.55)'); sh.addColorStop(1, 'rgba(120,145,170,0.55)');
    ctx.beginPath(); ctx.arc(0, 0, R * 0.98, 0, Math.PI * 2); ctx.fillStyle = sh; ctx.fill();
    ctx.strokeStyle = 'rgba(70,90,110,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    const r1 = R * 0.3, r2 = R * 0.95, k = 0.95;
    const bg = ctx.createLinearGradient(-R, -R, R, R);
    bg.addColorStop(0, '#eef3f8'); bg.addColorStop(0.5, '#8a9db1'); bg.addColorStop(1, '#d5dee8');
    ctx.lineCap = 'round';
    for (let b = 0; b < 6; b++) {
      const th0 = (b * Math.PI) / 3;
      ctx.beginPath();
      for (let j = 0; j <= 14; j++) {
        const r = r1 + ((r2 - r1) * j) / 14;
        const th = th0 - k * Math.log(r / r1);                  // leans against the rotation
        const px = Math.cos(th) * r, py = Math.sin(th) * r;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = '#4b5d70'; ctx.lineWidth = R * 0.13; ctx.stroke();
      ctx.strokeStyle = bg; ctx.lineWidth = R * 0.09; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(-R * 0.1, -R * 0.1, 1, 0, 0, R * 0.32);
    hg.addColorStop(0, '#f3f6f9'); hg.addColorStop(1, '#7d90a3'); ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = '#4b5d70'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,60,110,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.11, 0, Math.PI * 2); ctx.fillStyle = '#c7d2dd'; ctx.fill();
    ctx.fillStyle = '#4b5d70'; ctx.fillRect(-R * 0.025, -R * 0.11, R * 0.05, R * 0.05);
    ctx.restore();

    // 4. casing wall (cast body, drawn over the water)
    this.casingPath(ctx);
    const cg = ctx.createLinearGradient(x - R * 1.5, y - R * 1.6, x + R * 1.5, y + R * 1.5);
    cg.addColorStop(0, '#dfe7ee'); cg.addColorStop(0.45, '#7f93a7'); cg.addColorStop(1, '#3f5163');
    ctx.strokeStyle = cg; ctx.lineWidth = Math.max(3, R * 0.09); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();

    // 5. discharge flange (bolted) + concentric reducer to the riser
    const fx0 = x - R * 1.12, fx1 = x - R * 0.38, fy = y - R * 1.55;
    ctx.fillStyle = '#8a9db1';
    ctx.fillRect(fx0, fy - R * 0.1, fx1 - fx0, R * 0.12);
    ctx.fillStyle = '#4b5d70';
    for (const bx of [fx0 + R * 0.08, fx1 - R * 0.08]) { ctx.beginPath(); ctx.arc(bx, fy - R * 0.04, R * 0.035, 0, Math.PI * 2); ctx.fill(); }
    const nx = x - R * 0.75, top = fy - R * 0.1, pr = this.g.pipeR;
    ctx.beginPath();
    ctx.moveTo(x - R, top); ctx.lineTo(nx - pr, top - R * 0.3); ctx.lineTo(nx + pr, top - R * 0.3); ctx.lineTo(x - R * 0.5, top); ctx.closePath();
    const rg = ctx.createLinearGradient(x - R, 0, x - R * 0.5, 0);
    rg.addColorStop(0, '#6f8398'); rg.addColorStop(0.5, '#dfe7ee'); rg.addColorStop(1, '#6f8398');
    ctx.fillStyle = rg; ctx.fill();
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
