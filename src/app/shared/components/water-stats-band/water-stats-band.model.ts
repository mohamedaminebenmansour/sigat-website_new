import { CompanyStat } from '../../../features/media-showcase/models/company-stat.model';

/**
 * WaterStatsBand — configuration model.
 *
 * Single source of truth for every visual/geometric parameter of the
 * reusable water transition band: wave geometry, colours, motion timing
 * and statistics spacing. The component binds these values to CSS custom
 * properties, so the stylesheet contains no magic numbers.
 */

/** Placement of the band: after the hero video ("hero") or above the footer. */
export type WaterStatsBandVariant = 'hero' | 'footer';

/** One control point of the wave centre line, in SVG viewBox user units. */
export interface WavePoint {
  readonly x: number;
  readonly y: number;
}

/** Shared SVG viewBox for every top wave (user units). */
export const WAVE_VIEW = { width: 1440, height: 160 } as const;

/**
 * THE wave centre line — the single authoritative geometry, shared by the
 * hero and footer variants (placement tuning happens via amplitude/height).
 * Asymmetric rhythm (high crest left, deep trough, mid crest, shallow dip,
 * tallest crest right) giving large smooth curves with subtle irregularity.
 * The list wraps periodically — the curve continues from the last point
 * back to the first to close one period of 1440 units.
 */
export const WAVE_POINTS: readonly WavePoint[] = [
  { x: 0, y: 94 },
  { x: 250, y: 36 },
  { x: 520, y: 104 },
  { x: 780, y: 56 },
  { x: 1030, y: 92 },
  { x: 1250, y: 40 },
];

/** Visual + motion knobs for one band variant. */
export interface WaterStatsBandVariantConfig {
  /** Top wave svg height, desktop (px). */
  readonly waveHeight: number;
  /** Top wave svg height, mobile ≤ 767px (px). */
  readonly waveHeightSm: number;
  /** Overlap of the previous section (px) — negative top margin. */
  readonly overlap: number;
  readonly overlapSm: number;
  /** Vertical scale of the wave centre line (1 = base geometry). */
  readonly amplitude: number;
  readonly amplitudeSm: number;
  /** One full horizontal drift cycle of the wave (ms) — very slow. */
  readonly driftMs: number;
  /** One complete horizontal sweep of the water highlight (ms, 10–18 s). */
  readonly sheenMs: number;
  /** Opacity of the specular crest highlight (0–1). */
  readonly highlightOpacity: number;
  /**
   * Water surface gradient, top → bottom of the wave fill (lighter near the
   * upper surface, stronger blue with depth). SIGAT blue palette only.
   */
  readonly surfaceStops: readonly [string, string, string, string];
  /**
   * Water body background gradient. Its FIRST stop must equal the LAST
   * surfaceStop so the seam between svg and body stays invisible.
   */
  readonly bodyGradient: string;
  /** SVG turbulence deformation — desktop + motion-allowed only. */
  readonly useRipple: boolean;
  /** Statistics grid spacing (CSS lengths). */
  readonly statsGapX: string;
  readonly statsGapY: string;
  readonly bodyPaddingY: string;
  /** Statistics typography (CSS lengths). */
  readonly valueSize: string;
  readonly labelSize: string;
}

export interface WaterStatsBandConfig {
  /** Count-up duration when the band enters the viewport (ms). */
  readonly countUpDurationMs: number;
  /** Delay between each statistic's count-up start (ms). */
  readonly countUpStaggerMs: number;
  /** IntersectionObserver visibility ratio that starts the count-up. */
  readonly countUpThreshold: number;
  readonly hero: WaterStatsBandVariantConfig;
  readonly footer: WaterStatsBandVariantConfig;
}

/**
 * All tunable parameters of the water transition.
 * Wave height / amplitude / speed / colours / statistics spacing live here.
 */
export const WATER_STATS_BAND_CONFIG: WaterStatsBandConfig = {
  countUpDurationMs: 1700,
  countUpStaggerMs: 110,
  countUpThreshold: 0.3,

  hero: {
    waveHeight: 148,
    waveHeightSm: 96,
    overlap: 116,
    overlapSm: 56,
    amplitude: 1,
    amplitudeSm: 0.78,
    driftMs: 64000,
    sheenMs: 14000,
    highlightOpacity: 0.55,
    // Light attenuation with depth, SIGAT blues only: lighter at the
    // surface → stronger blue through the body → deeper toward the bottom.
    surfaceStops: ['#2a63c8', '#124bab', '#0a3c86', '#07316f'],
    // First stop equals the last surfaceStop (invisible svg → body seam).
    bodyGradient:
      'linear-gradient(180deg, #07316f 0%, #052d6b 28%, #032665 58%, #021b43 100%)',
    useRipple: true,
    statsGapX: 'clamp(1.1rem, 3vw, 2.75rem)',
    statsGapY: 'clamp(1.4rem, 3vw, 2.4rem)',
    bodyPaddingY: 'clamp(2rem, 3.6vw, 3.4rem)',
    valueSize: 'clamp(1.7rem, 3.3vw, 2.7rem)',
    labelSize: 'clamp(0.62rem, 1.1vw, 0.8rem)',
  },

  footer: {
    waveHeight: 88,
    waveHeightSm: 64,
    overlap: 72,
    overlapSm: 52,
    amplitude: 0.88,
    amplitudeSm: 0.72,
    driftMs: 84000,
    sheenMs: 16000,
    highlightOpacity: 0.4,
    surfaceStops: ['#2159b8', '#10459e', '#093879', '#062f6b'],
    // Ends exactly at --footer-bg (#032665): invisible seam into the footer.
    bodyGradient:
      'linear-gradient(180deg, #062f6b 0%, #042a63 35%, #032665 70%, #032665 100%)',
    useRipple: false,
    statsGapX: 'clamp(0.9rem, 2.4vw, 2rem)',
    statsGapY: 'clamp(1rem, 2vw, 1.5rem)',
    bodyPaddingY: 'clamp(1.1rem, 2vw, 1.6rem)',
    valueSize: 'clamp(1.3rem, 2.2vw, 1.85rem)',
    labelSize: 'clamp(0.56rem, 0.9vw, 0.7rem)',
  },
};

/**
 * Builds a seamless, C1-continuous wave path (periodic Catmull-Rom converted
 * to cubic Béziers) covering `cycles` full periods, then closes down to
 * `bottomY` for filling.
 *
 * Because the curve is mathematically periodic, translating the path by
 * exactly one period (-1440 user units) produces a seamless infinite drift —
 * no visible loop seam, no extra assets.
 *
 * @param points Centre-line control points of ONE period (first x must be 0).
 * @param periodWidth Period length in user units (WAVE_VIEW.width).
 * @param bottomY y of the fill's bottom edge (WAVE_VIEW.height).
 * @param cycles How many periods to emit (≥2 so the drift never runs out).
 */
export function buildWavePath(
  points: readonly WavePoint[],
  periodWidth: number,
  bottomY: number,
  cycles = 3,
): string {
  const count = points.length;

  /** Point of the infinite periodic sequence at global index i. */
  const at = (i: number): WavePoint => {
    const index = ((i % count) + count) % count;
    const wraps = Math.floor(i / count);
    return {
      x: points[index].x + wraps * periodWidth,
      y: points[index].y,
    };
  };

  const start = at(0);
  let d = `M 0,${bottomY} L ${start.x},${start.y}`;

  for (let s = 0; s < cycles * count; s++) {
    const p0 = at(s);
    const p1 = at(s + 1);
    const pm = at(s - 1);
    const pp = at(s + 2);
    // Uniform Catmull-Rom → cubic Bézier (tangent = neighbour difference / 6).
    const c1x = p0.x + (p1.x - pm.x) / 6;
    const c1y = p0.y + (p1.y - pm.y) / 6;
    const c2x = p1.x - (pp.x - p0.x) / 6;
    const c2y = p1.y - (pp.y - p0.y) / 6;
    d +=
      ` C ${c1x.toFixed(2)},${c1y.toFixed(2)}` +
      ` ${c2x.toFixed(2)},${c2y.toFixed(2)}` +
      ` ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }

  d += ` L ${(cycles * periodWidth).toFixed(2)},${bottomY} Z`;
  return d;
}

/** Re-exported for consumers of the band (single stats data contract). */
export type { CompanyStat };


