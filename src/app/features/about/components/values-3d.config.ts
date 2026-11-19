/**
 * Hydraulic visualization design configuration.
 * Intentional design parameters only. Derived positions, depths, paths
 * remain calculated by values-3d.geometry.ts and the component.
 */
export type HydraulicNodeType = 'valve' | 'chamber' | 'droplet';

export interface HydraulicNodeConfig {
  /** Node identity (matches COMPANY_VALUES order). */
  readonly id: string;
  /** Display label key (kept for compatibility; UI text unchanged). */
  readonly labelKey: string;
  /** Visual type of the hydraulic element. */
  readonly type: HydraulicNodeType;
  /** Initial orbital angle in radians. */
  readonly initialAngle: number;
  /** Orbital speed multiplier relative to base cycle (1.0 = in sync). */
  readonly orbitalSpeedMultiplier: number;
  /** Orbital direction (positive = same as global). */
  readonly orbitalDirection: 1 | -1;
  /** Optional depth emphasis (0-1) to bias layering feel if needed. */
  readonly depthEmphasis?: number;
  /** Visual accent color. */
  readonly accentColor: string;
  /** Secondary accent for glass/metal surfaces. */
  readonly accentSecondary?: string;
  /** Surface treatment hint (metal/glass/water). */
  readonly surface: 'metal' | 'glass' | 'water';
}

export interface HydraulicImpellerConfig {
  /** Visual radius multiplier relative to V3D_SUN_RADIUS baseline. */
  readonly radiusMultiplier: number;
  /** Rotation direction (positive = CW as seen). */
  readonly rotationDirection: 1 | -1;
  /** Rotation speed in degrees per second. */
  readonly rotationDegPerSec: number;
  /** Number of impeller blades. */
  readonly bladeCount: number;
  /** Hub radius relative to impeller radius. */
  readonly hubRadiusFrac: number;
  /** Blade curvature factor (0-1). */
  readonly bladeCurvature: number;
  /** Opacity/strength of cyan highlights. */
  readonly highlightOpacity: number;
  /** Glow intensity factor applied to halo. */
  readonly glowIntensity: number;
}

export interface HydraulicFlowConfig {
  /** Global hydraulic flow animation speed multiplier. */
  readonly flowSpeedMultiplier: number;
  /** Water highlight opacity (0-1). */
  readonly waterHighlightOpacity: number;
  /** Water glow intensity (0-1). */
  readonly waterGlowIntensity: number;
}

export interface HydraulicResponsiveSpacingConfig {
  /** Optional overrides per category if needed; geometry still owns defaults. */
  readonly spacingScaleByCategory?: readonly [number, number, number, number];
}

export interface HydraulicVisualizationConfig {
  readonly impeller: HydraulicImpellerConfig;
  readonly flow: HydraulicFlowConfig;
  readonly nodes: readonly HydraulicNodeConfig[];
  readonly responsive: HydraulicResponsiveSpacingConfig;
}

/**
 * Centralized hydraulic design parameters. Only intentional design values;
 * positions/depths/traces remain derived.
 */
export const HYDRAULIC_VISUALIZATION_CONFIG: HydraulicVisualizationConfig = {
  impeller: {
    radiusMultiplier: 1.0,
    rotationDirection: 1,
    rotationDegPerSec: 18,
    bladeCount: 6,
    hubRadiusFrac: 0.22,
    bladeCurvature: 0.28,
    highlightOpacity: 0.45,
    glowIntensity: 1.0,
  },
  flow: {
    flowSpeedMultiplier: 1.0,
    waterHighlightOpacity: 0.6,
    waterGlowIntensity: 0.4,
  },
  nodes: [
    {
      id: 'quality',
      labelKey: 'about.values.quality',
      type: 'valve',
      initialAngle: 0.053,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'metal',
      accentColor: '#0ea5e9',
      accentSecondary: '#0284c7',
    },
    {
      id: 'engagement',
      labelKey: 'about.values.engagement',
      type: 'chamber',
      initialAngle: 2.593,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'glass',
      accentColor: '#2563eb',
      accentSecondary: '#1d4ed8',
    },
    {
      id: 'responsibility',
      labelKey: 'about.values.responsibility',
      type: 'valve',
      initialAngle: 3.182,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'metal',
      accentColor: '#38bdf8',
      accentSecondary: '#0ea5e9',
    },
    {
      id: 'safety',
      labelKey: 'about.values.safety',
      type: 'chamber',
      initialAngle: 5.642,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'glass',
      accentColor: '#1d4ed8',
      accentSecondary: '#1e3a8a',
    },
    {
      id: 'sustainability',
      labelKey: 'about.values.sustainability',
      type: 'droplet',
      initialAngle: 4.143,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'water',
      accentColor: '#06b6d4',
      accentSecondary: '#22d3ee',
    },
    {
      id: 'environment',
      labelKey: 'about.values.environment',
      type: 'droplet',
      initialAngle: 0.82,
      orbitalSpeedMultiplier: 1.0,
      orbitalDirection: 1,
      surface: 'water',
      accentColor: '#38bdf8',
      accentSecondary: '#7dd3fc',
    },
  ],
  responsive: {
    spacingScaleByCategory: [0.3, 0.3, 0.4, 0.45],
  },
};

/** Returns node config by index (COMPANY_VALUES order). */
export function getHydraulicNodeConfig(index: number): HydraulicNodeConfig {
  return HYDRAULIC_VISUALIZATION_CONFIG.nodes[index] ?? HYDRAULIC_VISUALIZATION_CONFIG.nodes[0];
}
