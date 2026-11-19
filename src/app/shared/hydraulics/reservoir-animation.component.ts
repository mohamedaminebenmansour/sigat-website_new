import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  PLATFORM_ID, inject, input, signal, viewChild,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { PumpMode, ReservoirEngine, ReservoirLabelKey, ReservoirLabels, ReservoirStats } from './reservoir-engine';

const LABEL_KEYS: Record<ReservoirLabelKey, string> = {
  reservoir: 'res_lbl_reservoir', riser: 'res_lbl_riser', pump: 'res_lbl_pump', borehole: 'res_lbl_borehole',
  aquifer: 'res_lbl_aquifer', waterTable: 'res_lbl_water_table', checkValve: 'res_lbl_check_valve',
  coupling: 'res_lbl_coupling', gauge: 'res_lbl_gauge', wallSleeve: 'res_lbl_wall_sleeve',
  drainValve: 'res_lbl_drain_valve', flowMeter: 'res_lbl_flow_meter', butterfly: 'res_lbl_butterfly',
  distribution: 'res_lbl_distribution', flange: 'res_lbl_flange', manhole: 'res_lbl_manhole',
  staffGauge: 'res_lbl_staff_gauge', inlet: 'res_lbl_inlet',
};

/**
 * <app-reservoir-animation> — interactive, physics-based SIGAT reservoir (logo-shaped).
 *  [controls]  show the HUD + operator panel (default true)
 *  [labels]    show equipment call-outs (default true)
 *  [height]    CSS height of the scene (default '90vh')
 */
@Component({
  selector: 'app-reservoir-animation',
  standalone: true,
  imports: [TranslatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full overflow-hidden rounded-2xl bg-sky-100 shadow-xl ring-1 ring-blue-900/10" [style.height]="height()">
      <canvas #canvas class="absolute inset-0 h-full w-full touch-none"
              role="img" [attr.aria-label]="'res_aria' | translate"></canvas>

      @if (controls()) {
        @let s = stats();
        <!-- HUD -->
        <div class="absolute left-3 top-3 hidden w-60 rounded-xl sm:block border border-blue-700/15 bg-white/80 p-3 text-xs text-blue-950 shadow-lg backdrop-blur-md">
          <h3 class="mb-2 text-[13px] font-bold uppercase tracking-wide text-blue-700">{{ 'res_hud_title' | translate }}</h3>
          @if (s) {
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_level' | translate }}</span><b class="tabular-nums">{{ s.level | number:'1.2-2' }} m</b></div>
            <div class="my-1.5 h-1.5 overflow-hidden rounded bg-blue-100">
              <div class="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-[width] duration-200" [style.width.%]="s.levelPct"></div>
            </div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_volume' | translate }}</span><b class="tabular-nums">{{ s.volume | number:'1.0-0' }} m³</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_pump' | translate }}</span>
              <span class="rounded-full px-2 text-[11px] font-bold"
                    [class]="s.pumpOn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                {{ (s.pumpOn ? 'res_on' : 'res_off') | translate }}</span></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_qin' | translate }}</span><b class="tabular-nums">{{ s.qIn | number:'1.0-0' }} L/s</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_qout' | translate }}</span><b class="tabular-nums">{{ s.qOut | number:'1.0-0' }} L/s</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_qdrain' | translate }}</span><b class="tabular-nums">{{ s.qDrain | number:'1.0-0' }} L/s</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_pressure' | translate }}</span><b class="tabular-nums">{{ s.pressure | number:'1.2-2' }} bar</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_velocity' | translate }}</span><b class="tabular-nums">{{ s.velocity | number:'1.2-2' }} m/s · {{ s.reynolds / 100000 | number:'1.1-1' }}·10⁵</b></div>
            <div class="flex justify-between py-0.5"><span>{{ 'res_hud_drawdown' | translate }}</span><b class="tabular-nums">{{ s.drawdown | number:'1.2-2' }} m</b></div>
            <p class="mt-1.5 text-[10.5px] leading-snug text-slate-500">{{ 'res_hud_note' | translate:{ x: s.timeScale } }}</p>
          }
        </div>

        <!-- Operator panel -->
        <div class="absolute inset-x-3 bottom-3 flex flex-col gap-2.5 rounded-xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-56 border border-blue-700/15 bg-white/80 p-3 text-xs text-blue-950 shadow-lg backdrop-blur-md">
          <span class="font-semibold">{{ 'res_ctrl_pump' | translate }}</span>
          <div class="flex overflow-hidden rounded-lg border border-blue-200">
            @for (m of modes; track m) {
              <button type="button" (click)="setMode(m)"
                      class="flex-1 px-2 py-1.5 font-semibold transition-colors"
                      [class]="mode() === m ? 'bg-blue-700 text-white' : 'bg-white hover:bg-blue-50'">
                {{ 'res_mode_' + m | translate }}
              </button>
            }
          </div>
          <label class="flex flex-col gap-1">
            <span class="font-semibold">{{ 'res_ctrl_valve' | translate }} — {{ valve() }} %</span>
            <input type="range" min="0" max="100" [value]="valve()" (input)="setValve($event)" class="accent-orange-500">
          </label>
          <button type="button" (click)="toggleDrain()"
                  class="rounded-lg px-3 py-2 font-bold transition-colors"
                  [class]="drain() ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'">
            {{ (drain() ? 'res_ctrl_drain_close' : 'res_ctrl_drain_open') | translate }}
          </button>
          <button type="button" (click)="toggleLabels()"
                  class="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-900 hover:bg-blue-100">
            {{ (showLabels() ? 'res_ctrl_labels_hide' : 'res_ctrl_labels_show') | translate }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ReservoirAnimationComponent implements AfterViewInit, OnDestroy {
  readonly controls = input(true);
  readonly labels = input(true);
  readonly height = input('90vh');

  readonly stats = signal<ReservoirStats | null>(null);
  readonly mode = signal<PumpMode>('auto');
  readonly valve = signal(60);
  readonly drain = signal(false);
  readonly showLabels = signal(true);
  readonly modes: PumpMode[] = ['auto', 'on', 'off'];

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly translate = inject(TranslateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private engine?: ReservoirEngine;
  private resizeObs?: ResizeObserver;
  private visObs?: IntersectionObserver;
  private sub?: Subscription;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef().nativeElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // call-outs are unreadable on narrow phones: start hidden there (user can still toggle)
    this.showLabels.set(this.labels() && window.innerWidth >= 640);

    this.zone.runOutsideAngular(() => {
      this.engine = new ReservoirEngine(canvas, {
        showLabels: this.showLabels(),
        onStats: s => this.zone.run(() => this.stats.set(s)),
      });
      this.engine.setDistributionOpening(this.valve() / 100);
      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(canvas);
      // only animate while visible (saves battery / CPU)
      this.visObs = new IntersectionObserver(([e]) => {
        if (!this.engine) return;
        if (e.isIntersecting && !reduced) this.engine.start(); else this.engine.stop();
      }, { threshold: 0.05 });
      this.visObs.observe(canvas);
      if (reduced) this.engine.renderOnce();
    });

    this.sub = this.translate.stream(Object.values(LABEL_KEYS)).subscribe((t: Record<string, string>) => {
      const labels: ReservoirLabels = {};
      for (const k of Object.keys(LABEL_KEYS) as ReservoirLabelKey[]) {
        const v = t[LABEL_KEYS[k]];
        if (v && v !== LABEL_KEYS[k]) labels[k] = v;
      }
      this.engine?.setLabels(labels);
    });
  }

  setMode(m: PumpMode) { this.mode.set(m); this.engine?.setPumpMode(m); }
  setValve(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    this.valve.set(v); this.engine?.setDistributionOpening(v / 100);
  }
  toggleDrain() { this.drain.update(d => !d); this.engine?.setDrainOpen(this.drain()); }
  toggleLabels() { this.showLabels.update(v => !v); this.engine?.setShowLabels(this.showLabels()); }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.resizeObs?.disconnect();
    this.visObs?.disconnect();
    this.engine?.destroy();
  }
}
