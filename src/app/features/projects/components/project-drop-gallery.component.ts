import {
  AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, input, signal
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HydroTicker } from '../../../shared/hydro/hydro-ticker.service';
import { HxWaveEdgeComponent } from '../../../shared/hydro/hx-wave-edge.component';
import { GRAVITY, clamp } from '../../../shared/hydro/hydro-physics';

interface Transition { from: number; to: number; x: number; y: number; t: number; phase: 'fall' | 'ripple'; }

/**
 * PROJECT GALLERY — "the drop reveals".
 *
 * Changing photo is a water event: a drop falls under gravity onto the
 * picture, and the next photo appears inside the ripple that spreads from
 * the impact at constant wave speed. The wave front refracts the image
 * (a ring of magnified pixels), trailing capillary rings fade as their
 * amplitude decays (~1/√r). Click / tap anywhere on the photo to drop the
 * water yourself — the ripple starts where you touched.
 *
 * Controls: prev / next, thumbnails, autoplay (progress = a filling pipe),
 * keyboard arrows, swipe, fullscreen. Reduced motion = instant change.
 */
@Component({
  selector: 'app-project-drop-gallery',
  standalone: true,
  imports: [TranslatePipe, HxWaveEdgeComponent],
  template: `
    <section class="dg" [attr.aria-label]="'project_gallery' | translate">
      <!-- the reading (white) goes under the surface into the deep gallery, and rises again into the light dossier -->
      <app-hx-wave-edge color="#ffffff" back="#2f8fe0" [flip]="true" />
      <app-hx-wave-edge color="#eaf5fd" back="#2f8fe0" />
      <div class="hx-container">
        <header class="hx-head dg__head">
          <p class="hx-eyebrow hx-eyebrow--light">{{ 'project_gallery' | translate }}</p>
          <h2 class="hx-h2 hx-display">{{ 'pd_gallery_title' | translate }}</h2>
        </header>

        <div #frame class="dg__frame" tabindex="0" (keydown)="onKey($event)"
             [attr.aria-roledescription]="'carousel'" [attr.aria-label]="title()">
          <canvas #cv class="dg__cv" (pointerdown)="onDown($event)" (pointerup)="onUp($event)"></canvas>
          <p class="dg__count" aria-live="polite">{{ pad(active() + 1) }} / {{ pad(images().length) }}</p>
          <button type="button" class="dg__nav dg__nav--prev" (click)="go(active() - 1)" [attr.aria-label]="'project_prev' | translate">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          </button>
          <button type="button" class="dg__nav dg__nav--next" (click)="go(active() + 1)" [attr.aria-label]="'project_next' | translate">
            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
          <div class="dg__bar">
            <button type="button" class="dg__ctrl" (click)="playing.set(!playing())" [attr.aria-label]="(playing() ? 'pd_gallery_pause' : 'pd_gallery_play') | translate">
              <i [class]="playing() ? 'fa-solid fa-pause' : 'fa-solid fa-play'" aria-hidden="true"></i>
            </button>
            <span class="dg__pipe" aria-hidden="true"><span #fill class="dg__pipe-fill"></span></span>
            <button type="button" class="dg__ctrl" (click)="fullscreen()" [attr.aria-label]="'pd_gallery_full' | translate">
              <i class="fa-solid fa-expand" aria-hidden="true"></i>
            </button>
          </div>
          <p class="dg__hint">{{ 'pd_gallery_hint' | translate }}</p>
        </div>

        <ol class="dg__thumbs">
          @for (src of images(); track src; let i = $index) {
            <li>
              <button type="button" class="dg__thumb" [class.is-on]="i === active()" (click)="go(i)"
                      [attr.aria-label]="title() + ' — ' + (i + 1)" [attr.aria-current]="i === active()">
                <img [src]="src" alt="" loading="lazy" decoding="async" />
                <span class="dg__thumb-water" aria-hidden="true"></span>
              </button>
            </li>
          }
        </ol>
      </div>
    </section>
  `
})
export class ProjectDropGalleryComponent implements AfterViewInit, OnDestroy {
  private readonly ticker = inject(HydroTicker);
  readonly sources = input.required<string[]>();
  readonly title = input('');
  @ViewChild('frame', { static: true }) frame!: ElementRef<HTMLElement>;
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fill', { static: true }) fill!: ElementRef<HTMLElement>;

  /** Local SIGAT photos have responsive variants: use the 1280 px one. */
  readonly images = computed(() =>
    this.sources().map(s => (/^assets\/.*\.webp$/i.test(s) && !/-\d+\.webp$/i.test(s) ? s.replace(/\.webp$/i, '-1280.webp') : s))
  );
  readonly active = signal(0);
  readonly playing = signal(true);

  private imgs: HTMLImageElement[] = [];
  private shown = 0;               // image currently fully on screen
  private tr: Transition | null = null;
  private clock = 0;               // autoplay timer (s)
  private time = 0;
  private down: { x: number; y: number } | null = null;
  private off?: () => void;
  private static readonly HOLD = 6;      // s per photo in autoplay
  private static readonly WAVE = 900;    // ripple front speed (px/s)

  private loadedKey = '';

  constructor() {
    // (Re)load only when the photo list really changes (not on a new array
    // with the same content), then restart from the first photo.
    effect(() => {
      const list = this.images();
      const key = list.join('|');
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      this.imgs = list.map(src => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; });
      this.shown = 0; this.tr = null; this.active.set(0);
    }, { allowSignalWrites: true });
  }

  ngAfterViewInit(): void {
    this.off = this.ticker.register(this.frame.nativeElement, dt => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.off?.();
  }

  pad(n: number): string { return String(n).padStart(2, '0'); }

  /** Change photo; the drop falls at (x, y) in canvas px (default: centre). */
  go(i: number, at?: { x: number; y: number }): void {
    const n = this.images().length;
    if (!n) return;
    const to = ((i % n) + n) % n;
    if (to === this.shown && !this.tr) return;
    const r = this.cv.nativeElement.getBoundingClientRect();
    const x = at?.x ?? r.width / 2, y = at?.y ?? r.height * 0.45;
    this.active.set(to);
    this.clock = 0;
    if (this.ticker.reducedMotion) { this.shown = to; this.tr = null; return; }
    // a transition already running finishes instantly so the new one starts clean
    if (this.tr) this.shown = this.tr.to;
    this.tr = { from: this.shown, to, x, y, t: 0, phase: 'fall' };
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') { this.go(this.active() + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { this.go(this.active() - 1); e.preventDefault(); }
  }

  onDown(e: PointerEvent): void {
    const r = this.cv.nativeElement.getBoundingClientRect();
    this.down = { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onUp(e: PointerEvent): void {
    if (!this.down) return;
    const r = this.cv.nativeElement.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = x - this.down.x;
    this.down = null;
    this.playing.set(false);
    if (Math.abs(dx) > 50) this.go(this.active() + (dx < 0 ? 1 : -1));   // swipe
    else this.go(this.active() + 1, { x, y });                           // drop where touched
  }

  fullscreen(): void {
    const el = this.frame.nativeElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => undefined);
  }

  // ------------------------------------------------------------------ render

  private tick(dt: number): void {
    const c = this.cv.nativeElement;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.time += dt;

    // autoplay
    if (this.playing() && !this.tr && dt > 0 && this.images().length > 1) {
      this.clock += dt;
      if (this.clock >= ProjectDropGalleryComponent.HOLD) this.go(this.active() + 1);
    }
    this.fill.nativeElement.style.transform = `scaleX(${clamp(this.clock / ProjectDropGalleryComponent.HOLD, 0, 1).toFixed(3)})`;

    this.drawImage(ctx, this.shown, w, h, 1);
    const tr = this.tr;
    if (!tr) return;
    tr.t += dt;

    if (tr.phase === 'fall') {
      // the drop falls from above the frame: y = ½·g·t²
      const y0 = -30, H = tr.y - y0;
      const fallT = Math.sqrt((2 * H) / GRAVITY);
      const k = Math.min(1, tr.t / fallT);
      const y = y0 + H * k * k;
      const v = GRAVITY * tr.t;
      this.drawDrop(ctx, tr.x, y, 9, Math.min(1.8, v / 900));
      if (k >= 1) { tr.phase = 'ripple'; tr.t = 0; }
      return;
    }

    // ripple: new photo inside the front, refraction ring at the front
    const R = tr.t * ProjectDropGalleryComponent.WAVE;
    const maxR = Math.hypot(Math.max(tr.x, w - tr.x), Math.max(tr.y, h - tr.y));
    ctx.save();
    ctx.beginPath(); ctx.arc(tr.x, tr.y, R, 0, Math.PI * 2); ctx.clip();
    this.drawImage(ctx, tr.to, w, h, 1);
    ctx.restore();

    // refraction band: the crest acts as a lens (magnify the new photo)
    const band = clamp(R * 0.22, 10, 46);
    if (R > 4) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, R, 0, Math.PI * 2);
      ctx.arc(tr.x, tr.y, Math.max(0, R - band), 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(tr.x, tr.y); ctx.scale(1.06, 1.06); ctx.translate(-tr.x, -tr.y);
      this.drawImage(ctx, tr.to, w, h, 1);
      ctx.restore();
    }

    // crest highlight + trailing capillary rings (amplitude ~ 1/√r)
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const rr = R - k * band * 0.9;
      if (rr <= 2) continue;
      const a = (0.75 / Math.sqrt(1 + rr / 120)) * (1 - k * 0.22) * (1 - R / (maxR * 1.25));
      if (a <= 0.02) continue;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.lineWidth = k === 0 ? 3 : 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(tr.x, tr.y, Math.max(0, rr - 3), 0, Math.PI * 2); // radius must never be negative
      ctx.strokeStyle = `rgba(0,40,90,${(a * 0.35).toFixed(3)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    // splash crown at the impact for the first instants
    if (tr.t < 0.35) {
      const s = tr.t / 0.35;
      ctx.fillStyle = `rgba(255,255,255,${(0.9 * (1 - s)).toFixed(3)})`;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const d = 8 + s * 40;
        ctx.beginPath();
        ctx.arc(tr.x + Math.cos(a) * d, tr.y + Math.sin(a) * d * 0.6 - s * (1 - s) * 50, 2.4 * (1 - s) + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    if (R >= maxR) { this.shown = tr.to; this.tr = null; }
  }

  /** cover-fit with a slow Ken Burns drift */
  private drawImage(ctx: CanvasRenderingContext2D, i: number, w: number, h: number, alpha: number): void {
    const im = this.imgs[i];
    if (!im || !im.complete || !im.naturalWidth) {
      ctx.fillStyle = '#0a3d73'; ctx.fillRect(0, 0, w, h);
      return;
    }
    const zoom = 1.04 + 0.03 * Math.sin(this.time * 0.08 + i);
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom;
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    const ox = (w - dw) / 2 + Math.sin(this.time * 0.05 + i * 2) * (dw - w) * 0.3;
    const oy = (h - dh) / 2 + Math.cos(this.time * 0.04 + i) * (dh - h) * 0.3;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, ox, oy, dw, dh);
    ctx.globalAlpha = 1;
  }

  /** falling drop, stretched along its velocity */
  private drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / Math.sqrt(1 + stretch * 0.4), 1 + stretch * 0.4);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.8);
    ctx.bezierCurveTo(r * 0.5, -r * 0.8, r, -r * 0.2, r, r * 0.3);
    ctx.arc(0, r * 0.3, r, 0, Math.PI);
    ctx.bezierCurveTo(-r, -r * 0.2, -r * 0.5, -r * 0.8, 0, -r * 1.8);
    const g = ctx.createRadialGradient(-r * 0.3, 0, 1, 0, r * 0.2, r * 1.4);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(90,180,250,0.75)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
}
