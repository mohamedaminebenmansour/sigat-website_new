import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Subscription } from 'rxjs';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';
import { COMPANY_VALUES } from './values.data';
import {
  V3D_BAND_VISUAL_GAP_RATIO,
  V3D_MAX_SCALE,
  V3D_MIN_SCALE,
  V3D_ORBIT_PLANE_ANGLE_DEG,
  V3D_ORBIT_PLANE_TILT,
  V3D_PLANET_VISUAL_HEADROOM,
  V3D_SUN_DOMINANCE,
  V3D_SUN_HALO_FACTOR,
  V3D_SUN_OFFSET_X,
  V3D_SUN_OFFSET_Y,
  V3D_SUN_TO_FIRST_PLANET_GAP,
  V3D_SUN_VISUAL_HEADROOM,
  V3D_SPACING_MIN_SCALE,
  V3D_SPACING_SCALE_BY_CATEGORY,
  Values3dGeometry,
  designHalfExtent,
  stagePadding,
  sunClearanceFactor,
  type OrbitTrace,
} from './values-3d.geometry';

/* ============================================================
   3D VALUES — MANUAL VISUAL TUNING (TypeScript side)

   The component is split in TWO independent layers:

   1. POSITION (locked) — where a body is on screen:
      orbit angles + speeds (V3D_ORBITS), the ONE inclined orbital plane
      (V3D_ORBIT_PLANE_ANGLE_DEG: the common plane rotates around the
      horizontal X axis through the centre, so the screen position AND the
      depth of every planet come from the same circle), the z-band, the
      self-rotation and the autoplay. NOTHING in the
      VISUAL SIZE CONTROLS block can move a body: resizing a sphere
      never changes its x, y, angle, orbit radius or orbit centre.
      It always stays centred on exactly the same orbital point.

   2. VISUAL SIZE + CONTENT — see the "VISUAL SIZE CONTROLS" block
      below: V3D_SUN_RADIUS (Sun size), V3D_PLANET_RADII (one size per
      planet), V3D_PLANET_CONTENT (per-planet padding / text scale /
      text width) and the ORBITAL SPACING rules of values-3d.geometry.ts
      (V3D_SUN_TO_FIRST_PLANET_GAP / V3D_BAND_VISUAL_GAP_RATIO /
      V3D_SPACING_SCALE_BY_CATEGORY - geometric distances, not CSS). The whole
      composition is authored once and uniformly scaled to the
      MEASURED scene (--v3d-fit), so these values are RELATIVE
      weights: their ratios are what you see on screen.

   CONTENT-FIRST SIZING (fitContentToPlanets, init + resize only):
   the real text of every planet (icon + title + description, in the
   active language FR / EN / AR) is measured, and a planet is grown
   when its content needs more room than the configured radius gives:
       final radius = max(configured radius, radius needed by content)
   Growth is capped (V3D_CONTENT_FIT_MAX_GROWTH) and, if even the
   grown planet cannot hold the text, that planet's text is scaled
   down by the exact shortfall. Content is NEVER clipped.

   ORBITAL GEOMETRY (single source of truth) - values-3d.geometry.ts:
   the pure Values3dGeometry module owns the ONE origin
   (centerX / centerY = the exact centre of the Sun), the six orbit
   radii, and the uniform fit scale. STEP 1 movement uses the local
   V3D_ORBIT_PLANE_ANGLE_DEG below (45°) with calculateOrbitPoint() in
   this component: the planet orbital movement is the ONLY trajectory,
   in absolute stage coordinates around that one origin, so a planet can
   never drift out of the component bounds. The engine publishes exactly
   two custom properties: --v3d-fit (the uniform stage zoom) and
   --v3d-scene-aspect (the composition's own width / height ratio).

   ORBIT TRACES - STEP 1 left no visible traces by design. STEP 2 does not
   recreate them: it only changes orbital radii. A radius change flows
   through geometry.radii[] into calculateOrbitPoint() below, so planet
   trajectory + front/back depth + responsive containment follow it, and
   STEP 3 traces sampled from the same function will follow as well.

   3D CONTENT (sphere "printed text") controls:
   - PLANET_SELF_ROTATION_DEG_PER_SEC  axial spin (deg/s)
   - V3D_CONTENT_MIN_OPACITY  how faint the back-facing content gets
   - V3D_CONTENT_MIN_SCALE    how much the back-facing content shrinks
   Corresponding CSS variables live in the .v3d-section styles:
   --v3d-content-curve     convex bow of the spherical content (6deg)
   --v3d-content-z         surface offset depth (fraction of body size)
   --v3d-content-scale     content scale relative to the surface cap
   ============================================================ */

/** Dwell time between automatic active-value steps (autoplay). */
const V3D_AUTOPLAY_MS = 4000;
/** Planets (= COMPANY_VALUES length). */
const V3D_SLOTS = 6;
/** Autoplay proceeds 0..n-1 then wraps. */
const V3D_STEP = 1;
const V3D_DEG = Math.PI / 180;

/* NOTE: the orbital-plane angle is NOT defined here any more. It is the ONE
   knob V3D_ORBIT_PLANE_ANGLE_DEG in values-3d.geometry.ts (imported above), so
   the component's distance checks (spacingTilt) and the geometry's scene
   bounds can never disagree about the plane. */
/** Near/far opacity range (far planets stay clearly readable). */
const V3D_MIN_OPACITY = 0.78;
const V3D_MAX_OPACITY = 1;
/** Depth -> z-index band. 200..300 renders BEHIND the sun (z:300),
    300..400 renders IN FRONT of it - planets visibly orbit around it. */
const V3D_Z_BASE = 200;
const V3D_Z_SPAN = 200;
/** The Sun's own z-index - MUST match .v3d-sun { z-index: 300 } in the styles.
    It is the exact middle of the band, so a planet renders in front exactly
    where its depth is positive and behind where it is negative: the front/back
    switch happens at theta = 0 / 180 deg, where the depth is 0. The order is
    therefore decided by the 3D model - never by an angle comparison and never
    by a per-half special case. */
const V3D_Z_SUN = V3D_Z_BASE + V3D_Z_SPAN / 2;
/** Fixed planet accent colors (SIGAT identity: warm gold + cool blues). */
const V3D_COLORS = ['#f59e0b', '#2563eb', '#0ea5e9', '#6366f1', '#1d4ed8', '#0f766e'];

/* ============================================================
   ORBITAL SYSTEM — POSITION MODEL (locked geometry)
   Positions are DERIVED at init/resize from the MEASURED scene
   (never hand-picked, no hard-coded max width):

     R1      = ( sunRadius * (1 + 2*V3D_SUN_TO_FIRST_PLANET_GAP)
                * V3D_SUN_VISUAL_HEADROOM
                + planetRadius_1 * V3D_MAX_SCALE * V3D_PLANET_VISUAL_HEADROOM )
                / V3D_ORBIT_PLANE_TILT   (holds at EVERY orbital angle)
     gap_i   = spacingScale * (1 + V3D_BAND_VISUAL_GAP_RATIO)
               * V3D_PLANET_VISUAL_HEADROOM * (p_i + p_i+1)
     R_i+1   = R_i + gap_i                       (rendered-size radii)
     tilt    = cos(V3D_ORBIT_PLANE_ANGLE_DEG)   (exactly the ONE knob)
     depth   = sin(V3D_ORBIT_PLANE_ANGLE_DEG)   (the SAME angle)
     fit     = ONE uniform scale that makes the whole composition fit
               the measured scene on BOTH axes (containment, nothing else)

   The radii above are the VISUAL radii of the VISUAL SIZE CONTROLS
   block (plus the content-driven growth). STEP 2 changes ONLY these
   geometric distances (R1 + the five band gaps); the 45° plane angle,
   speeds, self-rotation and animation are untouched. Movement is ONE
   inclined orbital plane (V3D_ORBIT_PLANE_ANGLE_DEG = 45°) rotating
   around the horizontal X axis through the ONE origin (centerX /
   centerY = the Sun centre):
     orbitalX = cos(theta) * R        orbitalY = sin(theta) * R
     x        = centerX + orbitalX
     y        = centerY + orbitalY * cos(angleRad)
     depth    = orbitalY * sin(angleRad)     (front/back from the same
                                              theta - the ONLY layering
                                              input, never a 2nd value)
    STEP 1 movement source: calculateOrbitPoint() below.
   ============================================================ */

// =====================================================
// VISUAL SIZE CONTROLS
// These values change VISUAL SIZE only.
// They NEVER change a planet's position: not its x / y, not its
// orbit radius, not its orbit centre, not its orbital angle.
// A sphere can be resized freely - it always stays centred on
// exactly the same point of exactly the same orbit.
// =====================================================

/** =============================================================
     POSITION BASELINE — LOCKED. DO NOT EDIT.
     These values (and only these) drive the orbit radii, the ONE
     origin, the tilt and the fit scale. They reproduce the
     approved composition EXACTLY. Visual size knobs below never
     influence them.
   ============================================================= */
const V3D_POSITION_BASELINE_SUN_RADIUS = 125;
const V3D_POSITION_BASELINE_PLANET_RADII = [
  66, // Planet 1 - quality
  70, // Planet 2 - commitment
  75, // Planet 3 - responsibility
  62, // Planet 4 - safety
  69, // Planet 5 - sustainability
  65, // Planet 6 - environment
];

// =====================================================
// VISUAL SIZE CONTROLS — size only, position never changes.
// A bigger value makes a body LOOK bigger; it stays centred on
// exactly the same point of exactly the same (frozen) orbit.
// =====================================================

// =====================================================
// MANUAL PLANET TUNING - size / content / motion ONLY.
// Screen categories: 0 mobile, 1 tablet, 2 PC (901-1919px), 3 large (>=1920px).
// Nothing in this block can move a body: a planet always stays centred on
// exactly the same point of exactly the same orbit.
// =====================================================

/** SUN - visual radius, in the same units as the baseline above.
    The engine never lets the Sun become smaller than 1.25x the
    largest planet, and never larger than planet 1's orbit clearance
    (so planet 1 is never hidden behind the Sun). */
const V3D_SUN_RADIUS = 200;

/** PLANETS 1..6 - MINIMUM visual radius, ONE ROW PER SCREEN CATEGORY
    (mobile / tablet / PC / large desktop), in the same units as
    V3D_SUN_RADIUS. This is a floor only: CONTENT-FIRST SIZING grows a
    planet beyond it whenever its text needs more room. Sphere size only -
    orbital radius, angle and centre are untouched. */
const V3D_PLANET_RADII_BY_CATEGORY = [
  [140, 155, 145, 170, 150, 165], // 0 mobile  - unchanged
  [140, 155, 145, 170, 150, 165], // 1 tablet  - unchanged
  [150, 165, 150, 175, 155, 170], // 2 PC      - larger planets for readable content
  [145, 155, 145, 165, 150, 160], // 3 large   - comfortable; the CONTENT gets bigger
];

/** Per-planet CONTENT tuning (one entry per planet, COMPANY_VALUES order). */
interface V3DPlanetContentConfig {
  /** Overall content size multiplier (1 = the category reference size).
      Bigger = bigger text AND a bigger planet (the planet grows to keep
      the text fully visible). */
  scale: number;
  /** Inner padding of the text area, in % of the planet DIAMETER, applied
      on BOTH sides. 11% is the current value (24-28px on a PC planet).
      Bigger = airier, but the planet then needs to be larger. */
  padding: number;
  /** Extra multiplier for the TITLE only (1 = unchanged). */
  titleScale: number;
  /** Extra multiplier for the DESCRIPTION only (1 = unchanged). */
  descriptionScale: number;
  /** Optional max width of the text column, in % of the planet
      diameter (100 = the full cap width). */
  maxWidth?: number;
}

const V3D_PLANET_CONTENT: readonly V3DPlanetContentConfig[] = [
  { scale: 1.10, padding: 11, titleScale: 1.0, descriptionScale: 1.0 }, // P1 quality
  { scale: 1.15, padding: 11, titleScale: 1.05, descriptionScale: 1.0 }, // P2 commitment
  { scale: 1.05, padding: 11, titleScale: 1.0, descriptionScale: 1.0 }, // P3 responsibility
  { scale: 1.15, padding: 11, titleScale: 1.05, descriptionScale: 1.0 }, // P4 safety
  { scale: 1.10, padding: 11, titleScale: 1.0, descriptionScale: 1.0 }, // P5 sustainability
  { scale: 1.15, padding: 11, titleScale: 1.05, descriptionScale: 1.0 }, // P6 environment
];

/** LARGE SCREEN (>= 1920px): the planets already have enough room, so the
    CONTENT grows instead of the spheres. Multiplies V3D_PLANET_CONTENT[i].scale. */
const V3D_LARGE_CONTENT_SCALE = 1.25;
const V3D_LARGE_PLANET_CONTENT_SCALE = [1.25, 1.30, 1.22, 1.32, 1.25, 1.30];

// ============================================================
// ORBITAL POSITION CONSTANTS (band spacing, stage padding, the ONE
// manual plane angle V3D_ORBIT_PLANE_ANGLE_DEG, its projected
// tilt/depth, the trace sampling step and the uniform fit scale) live
// in values-3d.geometry.ts - pure, DOM-free, the single source the
// planet movement AND the orbit traces derive from.
// ============================================================

// -----------------------------------------------------
// CONTENT-FIRST TEXT SIZE + CONTENT FIT
// The text size is CHOSEN for readability (per screen category), and
// the planet is then grown to hold it completely:
//     content -> required space -> planet size
// never the opposite. If a planet cannot grow any further (scene edge
// or orbit-1 clearance), THAT planet's text is scaled down by the
// exact shortfall - it is never clipped, hidden or ellipsised.
// -----------------------------------------------------

/** Title px per screen category (mobile / tablet / PC / large desktop).
    THE main "make the content readable" knob: raise it and every planet
    grows to keep its text fully visible. */
const V3D_CONTENT_TITLE_PX = [9, 11, 13, 16];
/** Minimum readable TITLE px per screen category (mobile / tablet / PC /
    large). The last-resort text shrink below never goes below these:
    body growth + padding relief come first; shrinking stops here and warns
    instead of producing tiny unreadable titles. Titles stay >= descriptions
    so the value name remains visually prominent. */
const V3D_CONTENT_TITLE_MIN_PX = [8, 9, 11, 13];
/** Minimum readable DESCRIPTION px per screen category. Same floor logic as
    titles: descriptions are never shrunk into an unreadable tiny area. */
const V3D_CONTENT_DESC_MIN_PX = [7, 8, 9, 11];
/** Minimum readable SUN title px per screen category. The Sun is the focal
    point and stays the largest body; its shrink loop respects this floor. */
const V3D_SUN_TITLE_MIN_PX = [10, 12, 14, 18];
/** When a capped planet still cannot hold its content, first relieve the
    inner padding down to this floor (% of diameter) before shrinking any
    text: more column width = fewer wrapped lines = less required height.
    Comfortable default stays 11% (V3D_PLANET_CONTENT); 8% is the tightest
    that still keeps icon/title/desc off the spherical edge. */
const V3D_CONTENT_PAD_MIN_PCT = 8;
/** Description px = title px x this ratio. */
const V3D_DESC_PER_TITLE = 0.78;
/** Icon px = title px x this ratio. */
const V3D_ICON_PER_TITLE = 1.7;
/** The Sun carries the active value, so its text is bigger than any
    planet's: sun title px = Sun visual diameter x this ratio. */
const V3D_SUN_TITLE_PER_DIAMETER = 1 / 13;
/** The Sun must stay at least this factor bigger than the largest
    planet (visual sizes). The constant itself lives in
    values-3d.geometry.ts (V3D_SUN_DOMINANCE) so the geometry's orbit caps
    and this component's size caps can never disagree about it. */

// Internal to the POSITION layer (baseline geometry): the ratio model the
// frozen orbit computation was calibrated with. Do not edit - it keeps the
// approved orbit/centre positions byte-identical.
/** Title px = body diameter x this ratio (position layer only). */
const V3D_TITLE_PER_DIAMETER = 1 / 16;
/** Absolute upper bound (design px) of the title, per screen category
    (position layer only). */
const V3D_TITLE_MAX_PX = [11, 13, 16, 20];
/** Text size per screen category (position layer only). */
const V3D_CONTENT_TYPE_SCALE_BY_CATEGORY = [0.9, 0.95, 1, 1];

/** Max automatic growth (x) of a planet whose content needs more room
    than the configured radius provides. */
const V3D_CONTENT_FIT_MAX_GROWTH = 1.35;
/** Safety margin applied to the measured content when sizing a planet. */
const V3D_CONTENT_FIT_SAFETY = 1.06;
/** Measured passes of the content fit (converges in 1-2; 3 = hard stop). */
const V3D_CONTENT_FIT_PASSES = 3;
/** Bounded passes of the last-resort TEXT shrink. Each pass re-measures the
    REAL block, because the text, the icon, the wrapping and the fixed gaps do
    not shrink in exactly the same proportion - a single proportional shrink
    would leave the content slightly too big. */
const V3D_TEXT_FIT_PASSES = 6;
/** Sphere "surface cap" radius as a fraction of the body diameter
    (matches .v3d-planet-surface { inset: 8% }). */
const V3D_CAP_RADIUS_FRAC = 0.42;
/** Content layer scale - must match the --v3d-content-scale CSS default. */
const V3D_CONTENT_SCALE_BASE = 1;
/** Horizontal padding of the Sun's content box, as a fraction of the Sun
    diameter. MUST match .v3d-sun-content { padding: 5% 13% } in the styles. */
const V3D_SUN_CONTENT_PAD_X = 0.13;
/** Vertical padding of that very same box (fraction of the Sun diameter).
    MUST match the 5% of .v3d-sun-content { padding: 5% 13% }. Together with
    V3D_SUN_CONTENT_PAD_X it defines the Sun's READABLE CONTENT ZONE - the
    area the dev-time overlap audit protects (validateSunContentOverlap). */
const V3D_SUN_CONTENT_PAD_Y = 0.05;
/** Font weights used by the content (only for the off-screen measurement). */
const V3D_FONT_WEIGHT_TITLE = 700;
const V3D_FONT_WEIGHT_DESC = 400;
/** Line heights of the content (must match the CSS) - used to turn a measured
    line count into a block height for the worst-case Sun check. */
const V3D_LINE_HEIGHT_TITLE = 1.14;
const V3D_LINE_HEIGHT_DESC = 1.45;

/**
 * MOTION - ONE common cycle duration for all six planets, exactly like the
 * planets of a clock face: angularVelocity = (2*PI) / V3D_ORBIT_CYCLE_MS.
 * Every planet completes one full revolution in the SAME time, so the
 * relative angular configuration never changes and the initial phases
 * determine the overlaps permanently. 48000ms matches the average of the
 * previous per-planet periods (33/39/45/52/60/70s), so the movement keeps
 * the pace you already liked. Change this ONE value to change the pace.
 */
const V3D_ORBIT_CYCLE_MS = 48000;
/**
 * Optional tiny per-planet speed correction (default 1.00 = perfectly in
 * sync). Keep the values very close to 1 (0.98 / 1.02) so the synchronized
 * cycle is preserved; this exists only to fine-tune a local conflict.
 */
const V3D_SPEED_MULTIPLIERS = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
/**
 * Start phase of each planet in radians (order = COMPANY_VALUES). Screen
 * coords: x = cos(angle) * radius, y = sin(angle) * radius * ratio.
 * Measured conflict-minimising set: every pair stays at least 34 degrees
 * apart, the worst disc overlap is 135px (vs 182px median / 249px p90 /
 * 294px max with the previous differential speeds) and planet 1 keeps the
 * smallest possible clearance from the Sun. Deterministic - no Math.random.
 */
const V3D_INITIAL_ANGLES = [0.053, 2.593, 3.182, 5.642, 4.143, 0.820];
/**
 * UX TUNING: PLANET SELF-ROTATION (degrees per second).
 * Lower = easier to read.  Higher = more dynamic.
 * Recommended: 3–7 degrees/second.
 *
 * This drives ONLY the planet's slow axial spin around its own axis (the
 * sphere + its icon / value name / description all rotate together). It is
 * fully independent of the orbital movement around the sun (V3D_ORBITS speeds) and
 * is time-based, so it feels the same on 60/120/144 Hz screens, on large
 * monitors, laptops and tablets.
 */
const PLANET_SELF_ROTATION_DEG_PER_SEC = 5;
/**
  * Content visibility model - each planet carries FOUR identical content
  * faces (0/90/180/270 degrees around the Y axis), so at least one face
  * is always facing the camera. backface-visibility (CSS) hard-culls each
  * face when it points away, while the per-face `--v3d-face` factor
  * (see applyAnimation) adds a narrow soft crossfade around the 45-degree
  * handover midpoint: the outgoing face fades as the incoming face rises,
  * so the swap reads as one face turning into the next - never a flash,
  * pop, gap, or two fully-opaque overlapping faces.
  */

/** Per-planet visual geometry, recomputed every frame from the orbit angle. */
interface PlanetGeometry {
  x: number;
  y: number;
  depth: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * "SIGAT Values Solar System" - company values as a premium orbital system.
 *
 * Geometry model (single mathematical source of truth):
 *   SIZES first: applyVisualSizes() resolves the Sun radius and the six
 *   planet radii from the VISUAL SIZE CONTROLS block (manual values, plus the
 *   automatic content-driven growth of fitContentToPlanets()).
 *   POSITIONS second: updateOrbitGeometry() feeds those radii + the measured
 *   scene into Values3dGeometry.compute() (values-3d.geometry.ts), which
 *   returns the uniform fit scale (--v3d-fit) + the composition aspect
 *   (--v3d-scene-aspect, published so the scene is given the height this
 *   composition needs for its measured width) + the six sampled orbit traces
 *   for the ONE origin
 *   (centerX / centerY = the Sun), the six radii and the projection of the ONE
 *   plane angle. The planet position is the single projected orbit:
 *     x      = centerX + cos(theta) * radius
 *     y      = centerY + sin(theta) * radius * cos(planeAngle)
 *     depth  = sin(theta) * radius * sin(planeAngle)  (same theta -> layering)
 *   The orbit traces are SAMPLED from exactly this formula (in the same pass),
 *   so a trace can never disagree with the movement, whatever the visual size
 *   of a planet. Overlap while two planets cross is tuned by the GEOMETRIC
 *   spacing rules of values-3d.geometry.ts (V3D_BAND_VISUAL_GAP_RATIO +
 *   the responsive V3D_SPACING_SCALE_BY_CATEGORY) - there is
 *   no per-frame physics and no collision system.
 *
 * Transform layers (one job per element):
 *   button.v3d-planet        -> orbital position + depth scale (owned by rAF,
 *                               NO CSS transition may touch this transform);
 *                               also the static sphere BODY visuals + perspective
 *   span.v3d-planet-sphere   -> AXIAL rotation: rotateY(selfAngle) written by
 *                               the same rAF loop; preserve-3d
 *   span.v3d-planet-surface  -> front cap of the sphere (inset 8%); rotates
 *                               with the sphere; culled past 90deg via
 *                               backface-visibility (sphere body stays visible)
 *   span.v3d-planet-content  -> icon / title / description, mounted on the cap
 *                               with a diameter-proportional translateZ, so the
 *                               text reads as printed on the curved surface
 *
 * The orbital loop (A) and the active-value autoplay (B) are independent;
 * hover NEVER pauses the motion. One rAF loop runs inside
 * Zone.runOutsideAngular and writes per-frame transforms straight to the DOM
 * (no change detection). A ResizeObserver keeps sceneWidth (and therefore
 * every orbit radius) in sync with the measured scene box.
 */
@Component({
  selector: 'app-values-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, SectionHeaderComponent],
  styles: [`
      :host { display: block; }

      /* ============================================================
         3D VALUES — MANUAL VISUAL TUNING (CSS side)
         Body sizes (Sun, planets) and all text sizes are written by the
         TypeScript engine (see VISUAL SIZE CONTROLS) in px, so tune them
         there - not here. This side owns only the LOOK: the shading, the
         depth/curve of the printed content and the responsive section
         layout. Every size variable below has a safe fallback for the
         very first paint, before the engine runs.
         ============================================================ */
              .v3d-section {
         /* Real fixed navbar height (header.component.ts: h-20 md:h-24). */
         --v3d-navbar: 5rem;
         --v3d-bottom-gap: 0.5rem;
         --v3d-edge-padding: clamp(0.5rem, 1.2vw, 1.25rem);
         --v3d-sun: 240px;
         --v3d-pd: 140px;
         --v3d-content-z: 0.35;
         --v3d-content-scale: 1;
         --v3d-content-curve: 6deg;
         position: relative;
         background: linear-gradient(180deg, #ffffff 0%, #f4f7fc 100%);
         overflow: hidden;
         width: 100%;
         /* Natural height: the page scrolls (Section A intro + Section B scene).
            The two sections below own their own heights independently. */
         display: block;
         padding-inline: 1rem;
         margin-bottom: 0;
         box-sizing: border-box;
       }
       /* The fixed navbar is taller from 768px (Tailwind md:h-24). */
       @media (min-width: 768px) {
         .v3d-section { --v3d-navbar: 6rem; }
       }

       /* ============================================================
          SECTION A - INTRODUCTION (own natural height; never fixed).
          Title + subtitle come from the shared SectionHeaderComponent and
          the paragraph from the i18n files - nothing is hardcoded here.
          ============================================================ */
       .v3d-intro {
         width: 100%;
         display: flex;
         flex-direction: column;
         align-items: center;
         text-align: center;
         /* Clear the fixed navbar, then breathe (height stays natural). */
         padding-top: var(--v3d-navbar);
         padding-bottom: clamp(1rem, 2vw + 0.5rem, 2rem);
       }
       /* Instance-scoped tightening of the shared header - the same pattern
          already used by values.component.ts. */
       .v3d-intro ::ng-deep app-section-header > div {
         margin-bottom: 1.75rem;
       }
       .v3d-intro-text {
         margin: 0;
         max-width: 46rem;
         font-size: 1rem;
         line-height: 1.75;
         color: #475569;
         overflow-wrap: break-word;
       }
       @media (min-width: 1024px) {
         .v3d-intro-text { font-size: 1.0625rem; }
       }

       /* ============================================================
          SECTION B - SOLAR SYSTEM (own controlled height, independent
          from the introduction). One viewport tall; its top band reserves
          the real navbar height, so the scene can NEVER sit underneath the
          fixed header. The engine's uniform fit still guarantees that all
          seven bodies stay inside the measured .v3d-scene box.
          ============================================================ */
       .v3d-scene-section {
         box-sizing: border-box;
         width: 100%;
         height: 100vh;   /* fallback for older engines */
         height: 100dvh;
         padding-top: var(--v3d-navbar);
         padding-bottom: var(--v3d-bottom-gap);
         display: flex;
         align-items: center;
         justify-content: center;
       }

      /* Scene - the MEASURED coordinate system. Everything inside it lives
         on .v3d-stage, which is authored in a fixed LOGICAL design space
         (large Sun, large planets, generous manual orbit gaps) and then
         uniformly scaled with --v3d-fit so the full composition always
         fits the real scene: the manual gap is never clamped, no planet
         is ever clipped, and the Sun + the planets share ONE coordinate
         space whose origin is the Sun's centre.

         DEBUG LAYOUT (disabled): uncomment to verify the coordinate space.
         .v3d-scene { outline: 1px dashed red; }
         .v3d-stage { outline: 1px dashed blue; } */
      .v3d-scene {
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        /* Default before the TS geometry engine runs; at init/resize the
           engine overwrites it with the measured fit scale (--v3d-fit). */
        --v3d-fit: 1;
        /* OPTIONAL composition offset (V3D_SUN_OFFSET_X / _Y in the geometry):
           the whole system - Sun, halo, planets, orbit traces - is anchored at
           the stage centre PLUS these two values, so ONE pair of constants can
           move it without touching a single radius or size. The engine
           publishes the real values at init; 0px is the plain 50% / 50%
           anchoring of the shipped composition. */
        --v3d-offset-x: 0px;
        --v3d-offset-y: 0px;
        /* THE REAL SCENE BOX - measured, never derived from the composition.
           It fills the Section B content area: the width minus the edge
           padding, the FULL available height. So the bounding box / fit can
           never depend on the box they define - compute() converges in ONE
           pass and fit always matches this measured rectangle. (The old
           --v3d-scene-aspect feedback loop is gone.) */
        width: calc(100% - (2 * var(--v3d-edge-padding)));
        max-width: 100%;
        height: 100%;
        container-type: inline-size;
        position: relative;
        margin-inline: auto;
      }
      /* The design-space surface: the Sun, the planets and the dots are
         children of this ONE element and are scaled TOGETHER, so every
         planet keeps its exact relation to the one origin (the Sun). */
      .v3d-stage {
        position: absolute;
        inset: 0;
        transform: scale(var(--v3d-fit));
        transform-origin: 50% 50%;
      }

      /* Orbit traces: projected paths sampled from the exact same trajectory
         the planets move on (calculateOrbitPoint / geometry.radii / the ONE
         plane angle), so a trace and its planet are the same curve. Rendered
         behind the planets, non-interactive, constant screen-pixel weight. */
      .v3d-orbit-traces {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
        z-index: 1;
      }

      /* Planets - LAYER 1 (orbit wrapper + sphere BODY). Centered at 50/50
         like the Sun itself; the rAF loop writes ONLY this element's
         transform + zIndex + opacity. No CSS transition touches transform
         here. The sphere BODY visuals live on this static element: a real
         sphere's silhouette never changes while it spins, and its shading
         comes from a fixed light (the camera), so the gradient must NOT
         rotate. */
      .v3d-planet {
        --v3d-pc: #0ea5e9;
        position: absolute;
        /* Anchored on the ONE origin: the stage centre (50%) plus the optional
           composition offset. The rAF loop still owns the orbital translate
           alone, so the orbit centre and the Sun can never drift apart. */
        left: calc(50% + var(--v3d-offset-x, 0px));
        top: calc(50% + var(--v3d-offset-y, 0px));
        /* VISUAL SIZE - written on this element by the engine from
           V3D_PLANET_RADII[i] (+ content-driven growth). This is the ONLY
           thing a size change touches: the position (left/top 50% + the
           rAF-owned translate) and the orbit radius are independent. */
        width: var(--v3d-pd, 140px);
        height: var(--v3d-pd, 140px);
        border-radius: 50%;
        padding: 0;
        margin: 0;
        font: inherit;
        cursor: pointer;
        /* Perspective for the rotating sphere layer (parent of the rotated
           element must carry it). */
        perspective: 700px;
        /* Layered spherical shading: top-left specular highlight, soft
           mid-tone wrap to base color, lower-right core shadow, plus an
           ambient rim — reads as a stylized sphere, not a plastic button. */
        background:
          radial-gradient(circle at 26% 22%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 26%),
          radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 46%),
          radial-gradient(circle at 67% 72%, color-mix(in srgb, var(--v3d-pc) 45%, #000 55%) 0%, color-mix(in srgb, var(--v3d-pc) 70%, #000 30%) 46%, transparent 74%),
          var(--v3d-pc);
        border: 2px solid rgba(255, 255, 255, 0.5);
        box-shadow:
          0 8px 20px rgba(15, 23, 42, 0.25),
          inset 0 -12px 22px rgba(0, 0, 0, 0.3),
          inset 5px 8px 14px rgba(255, 255, 255, 0.28),
          inset -6px -8px 16px color-mix(in srgb, var(--v3d-pc) 45%, #000 55%);
        /* NO transform here beyond the rAF-owned one; only paint props may
           transition (never the orbital transform). */
        transition: box-shadow 250ms ease, border-color 250ms ease, filter 250ms ease;
        transform: translate(-50%, -50%);
        will-change: transform;
        -webkit-tap-highlight-color: transparent;
      }
      .v3d-planet:focus-visible {
        outline: 3px solid #1e3a8a;
        outline-offset: 3px;
        border-radius: 50%;
      }

      /* LAYER 2 (sphere): SELF-ROTATION. The rAF loop writes rotateY(angle)
         to THIS element; icon/title/description are its physical children,
         so they inherit the exact same angle, speed and animation clock.
         No CSS animation, no second loop, no separate text animation. */
      .v3d-planet-sphere {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        transform-style: preserve-3d;
        will-change: transform;
      }

      /* LAYER 3 (surface cap): the front-facing REGION of the sphere, not a
         full-bleed card. inset: 8% shrinks it to the visible front cap so
         the content occupies the sphere surface, exactly like print on a
         globe. It rotates WITH the sphere (child of LAYER 2).

         FOUR-FACE CONTENT: every planet has FOUR of these caps
         (.face-0/.face-90/.face-180/.face-270), all inside the rotating
         sphere, all carrying the very same translated icon/title/description
         (the template renders the same bound value four times - no duplicated
         data, no new translation keys). Each cap is hard-culled by
         backface-visibility as soon as its surface points away from the
         camera, and the per-face --v3d-face factor (written per frame by the
         existing rAF loop) adds a narrow soft crossfade around the handover
         midpoint, so at least ONE cap is always readable: no duplicated text,
         no mirrored text, no popping, no all-faces-invisible gap. Because a
         cap at 180deg of sphere rotation is geometrically identical to a cap
         at 0deg (R(180)*R(180) = identity), the face that takes over is
         exactly as close to the camera and exactly as large as the first.
         The sphere body on the static button is never affected and stays
         fully visible. No overflow:hidden either - it would flatten
         preserve-3d and kill the depth effect; containment is guaranteed
         geometrically (a centered plane under Y-rotation never projects past
         the disc) plus the internal clipping on the content layer below. */
      .v3d-planet-surface {
        position: absolute;
        inset: 8%;
        border-radius: 50%;
        transform-style: preserve-3d;
        /* Cull the cap whose printed surface faces away from the viewer. */
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      /* The back cap: the same content mounted on the opposite side of the
         sphere. The rotateY(180deg) lives on this CONTAINER - never on the
         text - so when the sphere itself has rotated 180deg the composed
         rotation is the identity: Latin and Arabic (RTL) text are rendered
         exactly as upright and as readable as on the front cap. */
      .v3d-planet-surface.face-0 { transform: rotateY(0deg); }
      .v3d-planet-surface.face-90 { transform: rotateY(90deg); }
      .v3d-planet-surface.face-180 { transform: rotateY(180deg); }
      .v3d-planet-surface.face-270 { transform: rotateY(270deg); }
      /* In reduced motion the sphere never rotates, so only the face-0 cap is
         ever presented; the other faces are removed outright (deterministic -
         it does not rely on backface culling). */
      @media (prefers-reduced-motion: reduce) {
        .v3d-planet-surface.face-90,
        .v3d-planet-surface.face-180,
        .v3d-planet-surface.face-270 { display: none; }
      }

      /* LAYER 4 (content): printed on the cap; inherits sphere spin; the
         per-face --v3d-face factor (0..1, written per frame by the existing
         rAF loop from the face's angular distance to the camera) fades +
         slightly scales the whole icon+title+desc as one surface group:
         the face closest to the camera stays at opacity ~1 / scale ~1,
         neighbours crossfade narrowly around the handover midpoint, and a
         faint floor keeps the cycle continuous. Applied PER FACE - never to
         the whole planet - so one face is always readable. Convex radial
         mask + circular clip. The larger diameter is used for a comfortable
         internal area so the icon / wrapping title / full wrapping
         description sit well inside the disc and never touch the spherical
         edge. Content stays centered (justify-content: center) so a long
         description does not push the icon+title toward the top.
         overflow:hidden only serves the circular clip - it is never used
         to hide text (no ellipsis / clamp). */
      .v3d-planet-content {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.24rem;
        /* Per-planet inner padding (% of the planet diameter) - written by
           the engine from V3D_PLANET_CONTENT[i].padding. Smaller = more room
           for the text, bigger = airier but tighter for long descriptions. */
        padding: var(--v3d-content-pad, 9%);
        text-align: center;
        color: #ffffff;
        background:
          radial-gradient(circle at 42% 34%, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 56%),
          radial-gradient(circle at 66% 78%, rgba(0, 0, 0, 0.22) 0%, rgba(0, 0, 0, 0) 64%);
        text-shadow: 0 1px 3px rgba(15, 23, 42, 0.55), 0 1px 0 rgba(255, 255, 255, 0.14);
        user-select: none;
        --v3d-face: 1;
        opacity: calc(0.06 + 0.94 * var(--v3d-face));
        transform:
          translateZ(calc(var(--v3d-pd, 140px) * var(--v3d-content-z)))
          rotateX(var(--v3d-content-curve))
          scale(calc(var(--v3d-content-scale) * (0.86 + 0.14 * var(--v3d-face))));
      }
      /* Active planet: glow + brightness emphasis ONLY - never a transform
         (the orbital + self-rotation transforms are owned by the rAF loop),
         so the emphasis can never move the planet off its orbit or stop
         its rotation. */
      .v3d-planet.active {
        border-color: #ffffff;
        filter: brightness(1.08);
      }
      /* Hover: beaming emphasis ONLY - it NEVER pauses orbital motion. */
      .v3d-planet:hover {
        border-color: rgba(255, 255, 255, 0.95);
        filter: brightness(1.12);
        box-shadow:
          0 14px 36px rgba(15, 23, 42, 0.34),
          0 0 0 3px color-mix(in srgb, var(--v3d-pc) 55%, transparent),
          0 0 30px color-mix(in srgb, var(--v3d-pc) 60%, transparent);
      }
      .v3d-planet.active::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: 0 0 16px 3px color-mix(in srgb, var(--v3d-pc) 70%, transparent);
        pointer-events: none;
      }

      /* LAYER 4 (content): icon / title / description, clipped to the circle
         so nothing escapes the planet surface. This is the SELF-ROTATION
         layer: the rAF loop writes rotateY(selfAngle) + cos-based opacity
         here. The planet disc itself is NEVER hidden.
         Typography is CONTENT-FIRST: the engine writes the real px sizes per
         planet (--v3d-title-size / --v3d-desc-size / --v3d-icon-size) from
         the planet's diameter, so a bigger planet always gets bigger, fully
         readable text. The title and the description wrap freely with NO
         line-clamp / text-overflow / ellipsis, so the complete value is
         always visible in every language (FR / EN / AR, including RTL).
         inline-block on the icon: lets the engine measure it reliably. */
      .v3d-planet i {
        font-size: var(--v3d-icon-size, 1.1rem);
        line-height: 1;
        display: inline-block;
      }
      .v3d-planet-title {
        font-size: var(--v3d-title-size, 0.95rem);
        font-weight: 700;
        line-height: 1.12;
        letter-spacing: 0.01em;
        max-width: var(--v3d-content-maxw, 100%);
        display: block;
        overflow-wrap: break-word;
      }
      .v3d-planet-desc {
        font-size: var(--v3d-desc-size, 0.75rem);
        line-height: 1.35;
        opacity: 0.92;
        max-width: var(--v3d-content-maxw, 100%);
        display: block;
        overflow-wrap: break-word;
      }

      /* ================= Central sun ================= */
      .v3d-sun {
        position: absolute;
        /* Same anchor as the planets - 50% + the optional composition offset -
           so the Sun stays the exact mathematical origin (centerX / centerY)
           of the orbital system. */
        left: calc(50% + var(--v3d-offset-x, 0px));
        top: calc(50% + var(--v3d-offset-y, 0px));
        width: var(--v3d-sun);
        height: var(--v3d-sun);
        /* Between the far (200) and near (400) planet z-band so planets
           genuinely pass behind AND in front of the sun. MUST stay in sync
           with V3D_Z_SUN in the TS engine - the depth decides the order. */
        z-index: 300;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.65);
        background: radial-gradient(
          circle at 30% 28%,
          #fffdf4 0%,
          #fff2cd 30%,
          #ffe58a 58%,
          #ffc44d 82%,
          #f59e0b 100%
        );
        box-shadow:
          0 0 34px rgba(255, 191, 87, 0.42),
          0 0 96px rgba(255, 150, 30, 0.2),
          inset 0 0 0 8px rgba(255, 247, 208, 0.55),
          inset 0 -16px 30px rgba(230, 92, 16, 0.32),
          inset 4px 6px 12px rgba(255, 255, 240, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: v3d-sun-pulse 3.2s ease-in-out infinite;
      }
      @keyframes v3d-sun-pulse {
        0%, 100% { box-shadow: 0 0 34px rgba(255, 191, 87, 0.42), 0 0 96px rgba(255, 150, 30, 0.2), inset 0 0 0 8px rgba(255, 247, 208, 0.55), inset 0 -16px 30px rgba(230, 92, 16, 0.32), inset 4px 6px 12px rgba(255, 255, 240, 0.5); }
        50%      { box-shadow: 0 0 54px rgba(255, 191, 87, 0.56), 0 0 132px rgba(255, 150, 30, 0.28), inset 0 0 0 8px rgba(255, 247, 208, 0.64), inset 0 -16px 30px rgba(230, 92, 16, 0.32), inset 4px 6px 12px rgba(255, 255, 240, 0.5); }
      }
      .v3d-sun-halo {
        position: absolute;
        left: calc(50% + var(--v3d-offset-x, 0px));
        top: calc(50% + var(--v3d-offset-y, 0px));
        width: calc(var(--v3d-sun) * 1.6);
        height: calc(var(--v3d-sun) * 1.6);
        z-index: 80;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 179, 71, 0.35) 0%, rgba(255, 179, 71, 0.12) 48%, transparent 72%);
        filter: blur(2px);
        pointer-events: none;
      }
      /* Sun content: on the sphere surface, not a flat card - convex lighting. */
      .v3d-sun-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        padding: 5% 13%;
        text-align: center;
        color: #78350f;
        perspective: 480px;
        background:
          radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 52%),
          radial-gradient(circle at 62% 78%, rgba(124, 45, 18, 0.22) 0%, rgba(124, 45, 18, 0) 62%);
        animation: v3d-swap 300ms var(--v3d-ease) both;
      }
      .v3d-sun-content i,
      .v3d-sun-content h3,
      .v3d-sun-content p {
        text-shadow:
          0 1px 0 rgba(255, 251, 235, 0.55),
          0 -1px 2px rgba(124, 45, 18, 0.28);
      }
      .v3d-sun-content i { font-size: var(--v3d-sun-icon-size, 2rem); line-height: 1; }
      .v3d-sun-content h3 {
        margin: 0;
        font-size: var(--v3d-sun-title-size, 1.25rem);
        font-weight: 800;
        line-height: 1.14;
        overflow-wrap: break-word;
      }
      .v3d-sun-content p {
        margin: 0;
        font-size: var(--v3d-sun-desc-size, 0.95rem);
        line-height: 1.45;
        color: #92400e;
        display: block;
        overflow-wrap: break-word;
      }
      @keyframes v3d-swap {
        0%   { opacity: 0; transform: scale(0.94); }
        60%  { opacity: 1; transform: scale(1.03); }
        100% { opacity: 1; transform: scale(1); }
      }

      /* ================= Pagination dots ================= */
      .v3d-dots {
        position: absolute;
        left: 50%;
        top: calc(50% + var(--v3d-sun) / 2 + 0.7rem);
        transform: translateX(-50%);
        z-index: 500;
        display: flex;
        gap: 0.45rem;
      }
      .v3d-dot {
        width: 0.55rem;
        height: 0.55rem;
        padding: 0;
        border-radius: 9999px;
        border: 1px solid rgba(30, 58, 138, 0.45);
        background: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        transition: background 250ms ease, transform 250ms ease;
      }
      .v3d-dot.active { background: #f59e0b; transform: scale(1.3); }
      .v3d-dot:focus-visible { outline: 2px solid #1e3a8a; outline-offset: 2px; }

      /* ================= Responsive geometry =================
         The design-space fit scale and the logical body sizes are written
         by the TS geometry engine on every resize; only the section
         layout variables remain responsive here. */
      @media (max-width: 560px) {
        .v3d-section { --v3d-bottom-gap: 3rem; }
      }

      /* ================= Reduced motion =================
         The rAF loop never starts, so no orbital OR self-rotation happens;
         content stays fully visible and readable. */
      @media (prefers-reduced-motion: reduce) {
        .v3d-sun-content { animation: none; }
        .v3d-sun { animation: none; }
        .v3d-planet, .v3d-planet-surface, .v3d-dot { transition: none; }
        .v3d-planet-sphere { transform: none; }
        /* !important overrides any inline value already written by the
           rAF loop before the preference changed - content stays readable. */
        .v3d-planet-content { opacity: 1 !important; --v3d-face: 1 !important; }
        .v3d-planet.active { filter: none; }
        .v3d-planet.active::after { box-shadow: none; }
      }
    `,
  ],
  template: `
    <section class="v3d-section">
      <div class="v3d-intro">
        <app-section-header
          [title]="'values_title' | translate"
          [subtitle]="'values_subtitle' | translate"
        />
        <p class="v3d-intro-text">{{ 'values_intro' | translate }}</p>
      </div>

      <!-- Section B - the solar system owns its own height, independent
           from the introduction above (.v3d-scene-section). -->
      <div class="v3d-scene-section">
        <div class="v3d-scene">
        <!-- The whole orbital system lives on ONE design-space surface that
             is uniformly scaled to fit the real scene (--v3d-fit): the Sun
             and every planet share this single coordinate system, whose
             origin is the Sun's centre (centerX / centerY). -->
        <div class="v3d-stage">
        <!-- Orbit traces are sampled from the exact same trajectory the planets
             move on (calculateOrbitPoint / geometry.radii / the ONE plane angle),
             so a trace can never disagree with the planet that rides it. -->
        @if (traces().length > 0) {
          <svg class="v3d-orbit-traces" aria-hidden="true">
            @for (trace of traces(); track trace.index) {
              <path [attr.d]="trace.d"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.35)"
                    stroke-width="1.5"
                    vector-effect="non-scaling-stroke" />
            }
          </svg>
        }

        <!-- Soft halo shield keeps the sun visually dominant. -->
        <div class="v3d-sun-halo" aria-hidden="true"></div>

        <!-- Central sun - always shows the active value. The @for over a
             single item keyed by activeIndex() re-creates the content node
             on every change so the swap animation restarts cleanly. -->
        <div class="v3d-sun">
          @for (value of [activeValue()]; track activeIndex()) {
            <div class="v3d-sun-content">
              <i [class]="value.icon" aria-hidden="true"></i>
              <h3>{{ value.titleKey | translate }}</h3>
              <p>{{ value.descriptionKey | translate }}</p>
            </div>
          }

          <div class="v3d-dots" role="group" aria-label="Company values">
            @for (value of values; track value.id; let i = $index) {
              <button
                type="button"
                class="v3d-dot"
                [class.active]="i === activeIndex()"
                (click)="selectPlanet(i)"
                [attr.aria-label]="value.titleKey | translate"
                [attr.aria-current]="i === activeIndex() ? 'true' : null"
              ></button>
            }
          </div>
        </div>

        <!-- Orbiting planets - exactly six, positioned by the rAF loop.
             LAYER 1 = button (orbit position) / LAYER 2 = sphere (self
             rotation) / LAYER 3 = TWO content caps (front + back) with the
             same bound value, so one of them is always facing the viewer. -->
        <div class="v3d-planets">
          @for (value of values; track value.id; let i = $index) {
            <button
              type="button"
              class="v3d-planet"
              [class.active]="i === activeIndex()"
              [style.--v3d-pc]="planetColor(i)"
              (click)="selectPlanet(i)"
              [attr.aria-label]="value.titleKey | translate"
              [attr.aria-current]="i === activeIndex() ? 'true' : null"
            >
              <span class="v3d-planet-sphere">
                <span class="v3d-planet-surface face-0">
                  <span class="v3d-planet-content">
                    <i [class]="value.icon" aria-hidden="true"></i>
                    <span class="v3d-planet-title">{{ value.titleKey | translate }}</span>
                    <span class="v3d-planet-desc">{{ value.descriptionKey | translate }}</span>
                  </span>
                </span>
                <span class="v3d-planet-surface face-90" aria-hidden="true">
                  <span class="v3d-planet-content">
                    <i [class]="value.icon" aria-hidden="true"></i>
                    <span class="v3d-planet-title">{{ value.titleKey | translate }}</span>
                    <span class="v3d-planet-desc">{{ value.descriptionKey | translate }}</span>
                  </span>
                </span>
                <span class="v3d-planet-surface face-180" aria-hidden="true">
                  <span class="v3d-planet-content">
                    <i [class]="value.icon" aria-hidden="true"></i>
                    <span class="v3d-planet-title">{{ value.titleKey | translate }}</span>
                    <span class="v3d-planet-desc">{{ value.descriptionKey | translate }}</span>
                  </span>
                </span>
                <span class="v3d-planet-surface face-270" aria-hidden="true">
                  <span class="v3d-planet-content">
                    <i [class]="value.icon" aria-hidden="true"></i>
                    <span class="v3d-planet-title">{{ value.titleKey | translate }}</span>
                    <span class="v3d-planet-desc">{{ value.descriptionKey | translate }}</span>
                  </span>
                </span>
              </span>
            </button>
          }
        </div>
        </div>
      </div>
      </div>
    </section>
  `,
})

export class Values3dComponent {
  /** Shared data - the ONLY source of truth (never copied, never reordered). */
  readonly values = COMPANY_VALUES;

  readonly activeIndex = signal(0);
  readonly activeValue = computed(() => this.values[this.activeIndex()]);

  /** Per-planet current orbital angle (radians) - advanced by the rAF loop. */
  private readonly angles = new Float64Array(V3D_SLOTS);
  /**
   * Per-planet SELF-rotation angle (radians) - a SECOND, independent angle
   * system. It never influences orbitRadius()/calculatePlanetGeometry(); it
   * only drives the local rotateY of the planet's content layer and the
   * cos-based content visibility.
   */
  private readonly selfAngles = new Float64Array(V3D_SLOTS);

  private readonly zone = inject(NgZone);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Used only to re-fit the content sizes when the language changes. */
  private readonly translate = inject(TranslateService);
  private translateSub: Subscription | null = null;
  private readonly reduceMotion: boolean =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private sceneWidth = 0;
  /** Scene height in px (vertical containment of the outermost orbit). */
  private sceneHeightPx = 0;
  /**
   * THE ORBITAL GEOMETRY (values-3d.geometry.ts): the ONE origin
   * (centerX / centerY = the Sun centre), the orbit radii, the projected
   * tilt + depth factor, the fit scale, calculateOrbitPoint() - the single
   * mathematical source the planet movement reads every frame - and the six
   * traces SAMPLED from that same function. Written by updateOrbitGeometry()
   * at init + on every resize; the planet transform subtracts that origin
   * because the DOM pins every planet at 50% / 50% of the stage.
   */
   private readonly geometry = new Values3dGeometry();
  /** The bounding box (design px) compute() last fitted - dev audit only. */
  private lastBox = { halfW: 0, halfH: 0 };
  /** Reactive orbit traces - sampled from the SAME calculateOrbitPoint() the
      planets move on, so a trace and its planet are the same curve. Updated
      at init/resize only. */
  private readonly tracesSig = signal<readonly OrbitTrace[]>([]);
  readonly traces = this.tracesSig.asReadonly();
  /**
   * POSITION LAYER - Sun radius that feeds the frozen orbit geometry
   * (baseline values only). Never written to the DOM directly.
   */
  private sunRadiusPx = 0;
  /**
   * POSITION LAYER - planet radii that feed the frozen orbit geometry
   * (baseline values + the internal growth the geometry was calibrated
   * with). Never written to the DOM directly.
   */
  private readonly planetRadiiPx = new Float64Array(V3D_SLOTS);
  /**
   * VISUAL LAYER - the Sun radius actually rendered (--v3d-sun). Grows
   * around the fixed centre so the Sun stays the largest body.
   */
  private visualSunRadiusPx = 0;
  /**
   * VISUAL LAYER - the planet radii actually rendered (--v3d-pd):
   * max(baseline radius, manual minimum, radius required by the content),
   * capped by the scene edge and orbit-1 clearance. Positions never move.
   */
  private readonly visualRadiiPx = new Float64Array(V3D_SLOTS);
  /** Configured (manual) radius per planet, before the content fit. */
  private readonly manualRadiiPx = new Float64Array(V3D_SLOTS);
  /** Per-planet content box config, resolved once per geometry pass. */
  private readonly contentPadPct = new Float64Array(V3D_SLOTS);
  private readonly contentMaxWPct = new Float64Array(V3D_SLOTS);
  /** Per-planet title size in px (the icon derives from it). */
  private readonly contentTitlePx = new Float64Array(V3D_SLOTS);
  /** Per-planet DESCRIPTION size in px (independent from the title, so
      V3D_PLANET_CONTENT[i].descriptionScale can tune it alone). */
  private readonly contentDescPx = new Float64Array(V3D_SLOTS);
  /** Sun content title size in px. */
  private sunTitlePx = 0;
  /** Content layer scale - kept in sync with --v3d-content-scale in CSS. */
  private readonly contentScale = V3D_CONTENT_SCALE_BASE;
  /** Gap between the content children in px (read once from the live CSS). */
  private contentGapPx = 0;
  /** Gap between the SUN's content children in px (live CSS, re-read). */
  private sunContentGapPx = 0;
  /** Real font family used by the content (canvas measurement). */
  private measureFontFamily = 'sans-serif';
  /**
   * The REAL text of every planet, read from the live DOM (so it is the
   * translated string of the active language, FR / EN / AR). Used to measure
   * every value against the SUN's font sizes: the Sun cycles through all six
   * values, so the longest one decides the Sun's size.
   */
  private readonly planetTitleText: string[] = ['', '', '', '', '', ''];
  private readonly planetDescText: string[] = ['', '', '', '', '', ''];
  /** Screen category of the current pass (0 mobile ... 3 large desktop). */
  private category = 2;
  /** Off-screen 2D context used to measure the real text (FR / EN / AR). */
  private measureCtx: CanvasRenderingContext2D | null = null;

  private scene: HTMLElement | null = null;
  private planets: HTMLElement[] = [];
  /** Cached self-rotation layers (one per planet) - written by the rAF loop. */
  private spheres: HTMLElement[] = [];
  /**
   * Cached FOUR content layers per planet (face-0/90/180/270): face-0 is
   * used for measurement; all four receive their own per-face `--v3d-face`
   * factor per frame. All four share the same content and styling.
   */
  private contents: HTMLElement[] = [];
  private faceContents: HTMLElement[][] = [];
  /** Cached Sun content block - measured once, never per frame. */
  private sunContent: HTMLElement | null = null;
  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** Re-runs the size pipeline when the language changes (FR / EN / AR). */
  private langSubscription: { unsubscribe(): void } | null = null;

  constructor() {
    // DETERMINISTIC start positions (V3D_INITIAL_ANGLES) - no Math.random.
    // Every planet starts at its own configured, intentionally distributed
    // phase, stable across reloads. Self-rotation angles are also seeded
    // deterministically (staggered) so no two planets spin in phase.
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.angles[i] = V3D_INITIAL_ANGLES[i % V3D_INITIAL_ANGLES.length];
      this.selfAngles[i] = i * 0.9;
    }
    inject(DestroyRef).onDestroy(() => this.onDestroy());

    afterNextRender(() => {
      this.applyStaticGeometry();
      this.observeSceneResizes();
      this.observeLanguageChanges();
      if (this.reduceMotion) return; // planets placed once and stay
      this.startAnimation();
      this.scheduleAutoplay(V3D_AUTOPLAY_MS);
    });
  }

  /** Fixed accent color per planet (exposed to the template). */
  planetColor(i: number): string {
    return V3D_COLORS[i % V3D_COLORS.length];
  }

  /**
   * Angular speed (rad/s) of planet i: ONE shared cycle duration for all six
   * planets times the optional tiny per-planet correction. This is the ONLY
   * speed input of the orbital loop - the motion equation itself
   * (x = cos(angle) * radius, y = sin(angle) * radius * ratio) is untouched.
   */
  private orbitSpeed(i: number): number {
    const seconds = Math.max(1, V3D_ORBIT_CYCLE_MS) / 1000;
    const mult = V3D_SPEED_MULTIPLIERS[i % V3D_SPEED_MULTIPLIERS.length] || 1;
    return ((2 * Math.PI) / seconds) * mult;
  }

  /**
   * VISUAL SIZE PASS (init + resize ONLY, never per frame).
   * Turns the manual VISUAL SIZE CONTROLS into real px:
   *   - the Sun radius,
   *   - one visual radius per planet (independent per planet),
   *   - the per-planet content box (padding + text width),
   *   - the content-first type scale (title px = body diameter * ratio).
   * Positions are NOT touched here: they are derived from these radii
   * afterwards (updateOrbitGeometry), so a size can never move a body.
   */
  private applyVisualSizes(): void {
    // Refresh the measured text (live DOM = active language) on every pass.
    this.readContentText(this.elementRef.nativeElement);
    const cat = this.selectCategory(this.sceneWidth);
    this.category = cat;
    const typeScale =
      V3D_CONTENT_TYPE_SCALE_BY_CATEGORY[cat % V3D_CONTENT_TYPE_SCALE_BY_CATEGORY.length];
    const maxTitle = V3D_TITLE_MAX_PX[cat % V3D_TITLE_MAX_PX.length];

    // POSITION LAYER: the frozen baseline values (never the visual knobs).
    this.sunRadiusPx = V3D_POSITION_BASELINE_SUN_RADIUS;

    for (let i = 0; i < V3D_SLOTS; i++) {
      const cfg = V3D_PLANET_CONTENT[i % V3D_PLANET_CONTENT.length];
      this.contentPadPct[i] = cfg.padding;
      this.contentMaxWPct[i] = cfg.maxWidth ?? 100;
      // Always restart from the RAW manual weights: this pass must be
      // stateless, otherwise a previous pass's growth would feed back into
      // the normalization and the sizes could drift or collapse.
      this.manualRadiiPx[i] =
        V3D_POSITION_BASELINE_PLANET_RADII[i % V3D_POSITION_BASELINE_PLANET_RADII.length];
      this.planetRadiiPx[i] = this.manualRadiiPx[i];
    }

    // SCENE NORMALIZATION: the manual radii are RELATIVE weights, so Sun and
    // planets are scaled TOGETHER until the design exactly fills the measured
    // scene width. The composition then always uses the full available width
    // (no empty side margins) at every screen size - while keeping every
    // manual ratio (Sun vs planets, planets vs each other) untouched.
    this.normalizeToSceneWidth();
    // VISUAL LAYER starts as an exact copy of the baseline; the content-first
    // pass (growVisualBodies, after the geometry) grows it from here.
    this.visualSunRadiusPx = this.sunRadiusPx;
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.visualRadiiPx[i] = this.planetRadiiPx[i];
    }
    this.applySunContentScale();

    for (let i = 0; i < V3D_SLOTS; i++) {
      // POSITION LAYER text reference: a FIXED ratio (never the visual tuning
      // knobs of V3D_PLANET_CONTENT), so the content-driven growth that feeds
      // the frozen orbit geometry stays byte-identical to the approved build.
      // The readability tuning happens in the visual layer (growVisualBodies).
      this.contentTitlePx[i] = Math.min(
        this.planetRadiiPx[i] * 2 * V3D_TITLE_PER_DIAMETER * typeScale,
        maxTitle,
      );
      // Position-layer description reference (the previous title/desc ratio).
      this.contentDescPx[i] = this.contentTitlePx[i] * V3D_DESC_PER_TITLE;
    }
  }

  /**
   * Scales Sun + planets TOGETHER until the composition's half extent
   * exactly fills the measured scene width. State-less: it always works
   * from the current radii, so it can never drift between two passes.
   */
  private normalizeToSceneWidth(): void {
    if (this.sceneWidth <= 0) return;
    const available = this.sceneWidth / 2 - stagePadding(this.sceneWidth);
    // The SAME responsive spacing scale the geometry pass uses: one
    // composition, normalized against the measured scene exactly once.
    const extent = designHalfExtent(
      this.sunRadiusPx,
      this.planetRadiiPx,
      this.spacingScale(),
      this.sceneWidth,
    );
    if (!(extent > 0)) return;
    const normalize = available / extent;
    if (!(normalize > 0) || !isFinite(normalize)) return;
    this.sunRadiusPx *= normalize;
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.manualRadiiPx[i] *= normalize;
      this.planetRadiiPx[i] = this.manualRadiiPx[i];
    }
  }

  /**
   * Re-absorbs the content-driven planet growth into the Sun's radius, so
   * the composition keeps filling the scene width exactly (fit scale 1)
   * while every planet keeps exactly the size its content needs.
   */
  private absorbGrowthIntoSun(): void {
    if (this.sceneWidth <= 0) return;
    const available = this.sceneWidth / 2 - stagePadding(this.sceneWidth);
    const extent = designHalfExtent(
      this.sunRadiusPx,
      this.planetRadiiPx,
      this.spacingScale(),
      this.sceneWidth,
    );
    if (!(extent > available)) return;
    // The Sun's own share of R1 - ONE expression, shared with the geometry
    // (sunClearanceFactor mirrors firstOrbitRadius()'s Sun term exactly).
    const sunFactor = sunClearanceFactor();
    const planetsExtent = extent - this.sunRadiusPx * sunFactor;
    if (planetsExtent >= available) return; // planets alone fill the scene
    const wantedSun = (available - planetsExtent) / sunFactor;
    // The Sun must stay clearly the largest body in the system.
    const maxPlanetR = Math.max(...Array.from(this.planetRadiiPx));
    this.sunRadiusPx = Math.max(wantedSun, maxPlanetR * V3D_SUN_DOMINANCE);
  }

  /** Content-first type scale of the Sun: its title is a FRACTION OF ITS OWN
      VISUAL DIAMETER (V3D_SUN_TITLE_PER_DIAMETER), so the Sun's icon, title
      and description SCALE WITH the Sun - enlarging the Sun enlarges its
      content instead of leaving it at a tiny absolute size. The old absolute
      cap (V3D_CONTENT_TITLE_PX[cat] * 1.2) is gone for exactly that reason: it
      froze the Sun's text while the Sun grew.
      Containment is still guaranteed: the Sun's own fit loop right after this
      pass (requiredSunRadius + V3D_TEXT_FIT_PASSES) shrinks the text by the
      exact shortfall whenever a long FR / EN / AR value cannot fit its disc -
      the content is never clipped and never ellipsised. */
  private applySunContentScale(): void {
    this.sunTitlePx = this.visualSunRadiusPx * 2 * V3D_SUN_TITLE_PER_DIAMETER;
  }

  /**
   * CONTENT-FIRST VISUAL PASS (init + resize ONLY, AFTER the frozen
   * geometry). Determines how much room every planet's REAL content needs
   * and sizes the sphere to hold it - WITHOUT moving anything:
   *
   *   visualRadius = clamp( max(baseline radius, manual minimum,
   *                             radius required by the content),
   *                        … , min(scene-edge cap, orbit-1 cap) )
   *
   * The caps are the "adjust the size, never the position" rule: a planet
   * grows until it would touch the scene edge or outgrow the Sun, and only
   * then is its text scaled down by the exact shortfall (never clipped).
   * The text size is CHOSEN first (per screen category), so the measurement
   * converges in 1-2 passes with no feedback loop.
   */
  private growVisualBodies(): void {
    // 1. Text size FIRST: chosen for readability, never derived from the body.
    //    reference px (per screen category) x per-planet scale x the large
    //    screen content boost, with the title and the description tunable
    //    independently. On large screens this is what grows - not the sphere.
    const cat = this.category % V3D_CONTENT_TITLE_PX.length;
    const isLarge = this.category === 3;
    for (let i = 0; i < V3D_SLOTS; i++) {
      const cfg = V3D_PLANET_CONTENT[i % V3D_PLANET_CONTENT.length];
      const large = isLarge
        ? V3D_LARGE_CONTENT_SCALE *
          V3D_LARGE_PLANET_CONTENT_SCALE[i % V3D_LARGE_PLANET_CONTENT_SCALE.length]
        : 1;
      const base = V3D_CONTENT_TITLE_PX[cat] * Math.max(0.5, cfg.scale) * large;
      this.contentTitlePx[i] = base * Math.max(0.5, cfg.titleScale);
      this.contentDescPx[i] = base * Math.max(0.5, cfg.descriptionScale) * V3D_DESC_PER_TITLE;
    }

    // 2. Sun size: the manual wish, capped by STEP-2 orbit-1 clearance so
    //    the Sun can never swallow planet 1's path (position is frozen).
    //    The rendered Sun may never exceed (a) the rendered/position budget
    //    the STEP-2 FIRST ORBIT was sized with and (b) what orbit 1 can
    //    afford by itself at the 45° projection - both are DISTANCE
    //    invariants, so Sun -> Planet 1 keeps holding whatever the size
    //    knobs say. Content/typography/speeds/angle/animation untouched.
    const sunWishCap = Math.min(
      V3D_SUN_VISUAL_HEADROOM * this.sunRadiusPx,
      this.step2MaxSunRadius(this.geometry.radii[0]),
    );
    this.visualSunRadiusPx = Math.max(
      this.sunRadiusPx,
      Math.min(
        (V3D_SUN_RADIUS / V3D_POSITION_BASELINE_SUN_RADIUS) * this.sunRadiusPx,
        sunWishCap,
      ),
    );
    this.applySunContentScale();

    // 2b. The configured per-planet sizes (V3D_PLANET_RADII_BY_CATEGORY) are a
    //     DESIGN INTENT that must survive the caps: when a cap binds, EVERY
    //     planet is scaled by the SAME factor instead of each one being clamped
    //     to the same radius (which would erase the relationship and make the
    //     six spheres identical). One factor = all the configured size ratios
    //     stay exactly as configured. Computed HERE (right after the Sun size
    //     is known) because a wish IS a ratio of the Sun, and clamped to
    //     [0.1, 1] so it can only ever trim an over-large wish, never enlarge.
    let rowFactor = 1;
    for (let i = 0; i < V3D_SLOTS; i++) {
      const wish = this.manualVisualMinRadius(i);
      const cap = this.planetVisualCap(i);
      if (wish > 0) rowFactor = Math.min(rowFactor, cap / wish);
    }
    rowFactor = Math.min(1, Math.max(0.1, rowFactor));

    // 3. Planets: content-first, bounded by the edge and the Sun dominance.
    for (let pass = 0; pass < V3D_CONTENT_FIT_PASSES; pass++) {
      this.writeBodySizes();
      let changed = false;
      for (let i = 0; i < V3D_SLOTS; i++) {
        const baseline = this.planetRadiiPx[i];
        const need = this.requiredRadius(i);
        const min = Math.max(baseline, this.manualVisualMinRadius(i) * rowFactor);
        const cap = this.planetVisualCap(i);
        const next = Math.min(Math.max(min, need), cap);
        if (Math.abs(next - this.visualRadiiPx[i]) > 0.25) {
          this.visualRadiiPx[i] = next;
          changed = true;
        }
      }
      if (!changed) break;
    }

    // 3b. The caps are hard: after the growth pass every radius is clamped to
    //     max(baseline, min(scene-edge cap, orbit-1 cap)) so a planet can never
    //     outgrow the Sun or leave the scene - the size gives way, never the
    //     position. Clamping happens BEFORE the text shrink below, so the
    //     shrink always works against the radius that will really be rendered.
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.visualRadiiPx[i] = Math.min(this.visualRadiiPx[i], this.planetVisualCap(i));
    }

    // 4. READABILITY FIT (content-first, minima-guarded). Order per spec:
    //    (1) bodies already grew to `need` above within caps; (2) relieve
    //    inner padding down to V3D_CONTENT_PAD_MIN_PCT for a wider column
    //    (fewer wrapped lines, centered flex keeps icon/title/desc clear of
    //    each other and of the edge); (3) only then shrink text, and never
    //    below per-category minima. No scale-transform hiding, no ellipsis,
    //    no truncation - FR/EN/AR strings stay complete on all four faces.
    //    Orbital math/angle/speeds/animation/self-rotation untouched.
    const titleMin = V3D_CONTENT_TITLE_MIN_PX[cat % V3D_CONTENT_TITLE_MIN_PX.length];
    const descMin = V3D_CONTENT_DESC_MIN_PX[cat % V3D_CONTENT_DESC_MIN_PX.length];
    for (let i = 0; i < V3D_SLOTS; i++) {
      // Padding relief first (re-measured, bounded): widen the text column.
      for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
        if (!(this.requiredRadius(i) > this.visualRadiiPx[i] + 0.5)) break;
        if (!(this.contentPadPct[i] > V3D_CONTENT_PAD_MIN_PCT + 0.25)) break;
        this.contentPadPct[i] = Math.max(
          V3D_CONTENT_PAD_MIN_PCT,
          this.contentPadPct[i] - 1,
        );
        this.writeBodySizes();
      }
      // Controlled shrink with readable floors: title + desc together so the
      // title stays >= desc and visually prominent; icon follows the title.
      for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
        const need = this.requiredRadius(i);
        if (!(need > this.visualRadiiPx[i] + 0.5)) break;
        if (!(need > 0)) break;
        const nextTitle = Math.max(
          titleMin,
          this.contentTitlePx[i] * (this.visualRadiiPx[i] / need),
        );
        const nextDesc = Math.max(
          descMin,
          this.contentDescPx[i] * (this.visualRadiiPx[i] / need),
        );
        // Floors reached: body + padding relief are exhausted, stop here and
        // warn below instead of making text unreadable.
        if (
          nextTitle >= this.contentTitlePx[i] - 1e-9 &&
          nextDesc >= this.contentDescPx[i] - 1e-9
        ) {
          break;
        }
        // Keep the hierarchy: title never drops below the description size.
        this.contentTitlePx[i] = Math.max(nextTitle, nextDesc);
        this.contentDescPx[i] = nextDesc;
        this.writeBodySizes();
      }
      const remaining = this.requiredRadius(i);
      if (remaining > this.visualRadiiPx[i] + 0.5 && isDevMode()) {
        console.warn(
          `[values-3d] Planet ${i + 1} (${this.values[i]?.id ?? i}): content still needs Ø${(remaining * 2).toFixed(0)}px, capped at Ø${(this.visualRadiiPx[i] * 2).toFixed(0)}px, text floored at title ${this.contentTitlePx[i].toFixed(1)}px / desc ${this.contentDescPx[i].toFixed(1)}px (scene edge / orbit clearance).`,
        );
      }
    }

    // 5. SUN readability: the focal point stays the largest body AND holds
    //    the LONGEST of the six translated values (FR/EN/AR measured in
    //    requiredSunRadius). Shrink respects the Sun title floor so icon +
    //    title + desc stay comfortable and centered; never clipped, never
    //    ellipsised, never moved. Orbital math/angle/speeds untouched.
    const largestPlanet = Math.max(...Array.from(this.visualRadiiPx));
    this.visualSunRadiusPx = Math.max(
      this.visualSunRadiusPx,
      V3D_SUN_DOMINANCE * V3D_MAX_SCALE * largestPlanet,
    );
    this.applySunContentScale();
    this.writeBodySizes();
    const sunMin = V3D_SUN_TITLE_MIN_PX[cat % V3D_SUN_TITLE_MIN_PX.length];
    for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
      const need = this.requiredSunRadius();
      if (!(need > this.visualSunRadiusPx + 0.5)) break;
      if (!(need > 0)) break;
      const next = Math.max(sunMin, this.sunTitlePx * (this.visualSunRadiusPx / need));
      if (next >= this.sunTitlePx - 1e-9) break; // floor reached: warn, don't shrink
      this.sunTitlePx = next;
      this.writeBodySizes();
    }
    if (isDevMode() && this.requiredSunRadius() > this.visualSunRadiusPx + 0.5) {
      console.warn(`[values-3d] Sun content still needs Ø${(this.requiredSunRadius() * 2).toFixed(0)}px, Sun has Ø${(this.visualSunRadiusPx * 2).toFixed(0)}px, title floored at ${this.sunTitlePx.toFixed(1)}px (longest FR/EN/AR value decides).`);
    }
    this.writeBodySizes();
  }

  /**
   * Radius the Sun needs so that EVERY value stays inside its disc - the Sun
   * cycles through all six, so the longest one is the authority, not the one
   * displayed right now. Each value's own title / description text is wrapped
   * with the SUN's font sizes on the off-screen canvas (no DOM change, no
   * per-frame cost) and the live block is measured exactly as well. Purely a
   * size decision: the Sun never moves.
   */
  private requiredSunRadius(): number {
    if (this.visualSunRadiusPx <= 0) return 0;
    const boxWidth = this.visualSunRadiusPx * 2 * (1 - 2 * V3D_SUN_CONTENT_PAD_X);
    const titleFont = this.sunFont(V3D_FONT_WEIGHT_TITLE, this.sunTitlePx);
    const descFont = this.sunFont(V3D_FONT_WEIGHT_DESC, this.sunTitlePx * V3D_DESC_PER_TITLE);
    const iconPx = this.sunTitlePx * V3D_ICON_PER_TITLE;
    const gap = this.sunContentGapPx;

    let need = 0;
    for (let i = 0; i < V3D_SLOTS; i++) {
      const title = this.wrapBlock(this.planetTitleText[i], titleFont, boxWidth, V3D_LINE_HEIGHT_TITLE);
      const desc = this.wrapBlock(this.planetDescText[i], descFont, boxWidth, V3D_LINE_HEIGHT_DESC);
      const blockWidth = Math.max(title.w, desc.w);
      const blockHeight = iconPx + title.h + desc.h + 2 * gap;
      if (blockWidth > 0 && blockHeight > 0) {
        need = Math.max(need, (Math.hypot(blockWidth, blockHeight) / 2) * V3D_CONTENT_FIT_SAFETY);
      }
    }

    // Exact check of the block actually laid out in the DOM (the visible
    // value), so a real layout is always at least as strong as the estimate.
    const content = this.sunContent;
    if (content && content.children.length > 0) {
      let blockWidth = 0;
      let blockHeight = 0;
      for (let k = 0; k < content.children.length; k++) {
        const el = content.children[k] as HTMLElement;
        blockHeight += el.offsetHeight;
        blockWidth = Math.max(blockWidth, this.contentLineWidth(el, boxWidth));
      }
      blockHeight += gap * (content.children.length - 1);
      if (blockWidth > 0 && blockHeight > 0) {
        need = Math.max(need, (Math.hypot(blockWidth, blockHeight) / 2) * V3D_CONTENT_FIT_SAFETY);
      }
    }
    return need;
  }

  /** A CSS font shorthand for the measurement canvas. */
  private sunFont(weight: number, sizePx: number): string {
    return `${weight} ${sizePx.toFixed(2)}px ${this.measureFontFamily}`;
  }

  /**
   * Wrapped size of a text block at a given font inside maxWidth: the height
   * is the line count x line-height (word wrapping, greedy - the same rule the
   * browser uses) and the width is the widest resulting line. Canvas only.
   */
  private wrapBlock(
    text: string,
    font: string,
    maxWidth: number,
    lineHeight: number,
  ): { w: number; h: number } {
    const ctx = this.measureCtx;
    const words = (text ?? '').trim().split(/\s+/).filter((w) => w.length > 0);
    if (!ctx || words.length === 0 || !(maxWidth > 0)) return { w: 0, h: 0 };
    ctx.font = font;
    const sizePx = parseFloat(font.split(' ')[1]) || 1;
    let lines = 1;
    let lineWidth = 0;
    let widest = 0;
    for (const word of words) {
      const wordWidth = ctx.measureText(word).width;
      if (lineWidth > 0 && lineWidth + sizePx * 0.32 + wordWidth > maxWidth) {
        widest = Math.max(widest, lineWidth);
        lines++;
        lineWidth = wordWidth;
      } else {
        lineWidth = lineWidth === 0 ? wordWidth : lineWidth + sizePx * 0.32 + wordWidth;
      }
    }
    widest = Math.max(widest, lineWidth);
    return { w: Math.min(widest, maxWidth), h: lines * sizePx * lineHeight };
  }

  /** Manual minimum visual radius of planet i for the CURRENT screen
      category, read relative to the rendered Sun so
      V3D_PLANET_RADII_BY_CATEGORY / V3D_SUN_RADIUS keep the ratio you
      configured. Sphere size only - never a position. */
  private manualVisualMinRadius(i: number): number {
    const row =
      V3D_PLANET_RADII_BY_CATEGORY[
        this.category % V3D_PLANET_RADII_BY_CATEGORY.length
      ];
    return (row[i % row.length] / V3D_SUN_RADIUS) * this.visualSunRadiusPx;
  }

  /**
   * STEP 2 — Sun -> first-planet distance (GEOMETRY, not CSS).
   *
   * Minimum visual gap between the Sun's outer edge and the first
   * planet's orbital path/body.
   *
   * Increase this value to move the first orbit farther from the Sun.
   *
   * This controls DISTANCE only. It does not change Sun or planet size.
   *
   * Geometric meaning (same origin + same plane as the movement):
   *   tilt * R1 >= visSun * (1 + 2 * GAP) + V3D_MAX_SCALE * visPlanet1
   * so the gap holds at EVERY orbital angle (front / behind / side),
   * at every responsive size (visual radii via planetVisualCap), using
   * the STEP-2 plane projection below - never a second centre and never
   * a CSS margin.
   */
  private sunToFirstPlanetGap(): number {
    return V3D_SUN_TO_FIRST_PLANET_GAP;
  }

  /**
   * STEP-2 plane projection used for DISTANCE checks only.
   * cos(45°) of the UNCHANGED V3D_ORBIT_PLANE_ANGLE_DEG: the vertical
   * semi-axis of a projected orbit (screen Y), while the movement's
   * calculateOrbitPoint() below remains the runtime source of truth.
   * Geometry/orientation only - never a size, speed or content knob.
   */
  private spacingTilt(): number {
    // ONE angle source: the geometry's V3D_ORBIT_PLANE_TILT (= cos of the ONE
    // V3D_ORBIT_PLANE_ANGLE_DEG). Never a second copy of the knob.
    return V3D_ORBIT_PLANE_TILT;
  }

  /**
   * STEP-2 first-orbit radius from the CURRENT position-layer sizes:
   *   R1 = (sun * (1 + 2*GAP) * SUN_HEADROOM
   *         + planet1 * V3D_MAX_SCALE * PLANET_HEADROOM) / tilt
   * Sun radius + planet-1 radius + minimum visual gap, divided by the
   * projection so the clearance holds at every angle. Radii stay
   * R1 < R2 < ... (bandGap() below only adds positive steps).
   */
  private step2FirstOrbitRadius(): number {
    if (!(this.sunRadiusPx > 0)) return 0.2 * this.sceneWidth;
    return (
      (this.sunRadiusPx * (1 + 2 * this.sunToFirstPlanetGap()) * V3D_SUN_VISUAL_HEADROOM +
        this.planetRadiiPx[0] * V3D_MAX_SCALE * V3D_PLANET_VISUAL_HEADROOM) /
      this.spacingTilt()
    );
  }

  /**
   * STEP-2 radial step R(i) -> R(i+1) from the CURRENT position-layer
   * sizes (geometric distance, never a CSS margin):
   *   gap_i = spacingScale * (1 + BAND_RATIO) * HEADROOM * (p_i + p_i+1)
   * i.e. R(next) >= R(current) + planet_i + planet_next + visual gap.
   * Per-planet size relationships are preserved: every band adapts
   * around its two bodies instead of forcing equal spheres.
   */
  private step2BandGap(index: number): number {
    const scale = Math.min(
      1,
      Math.max(V3D_SPACING_MIN_SCALE, this.spacingScale()),
    );
    return (
      scale *
      (1 + V3D_BAND_VISUAL_GAP_RATIO) *
      V3D_PLANET_VISUAL_HEADROOM *
      (this.planetRadiiPx[index] + this.planetRadiiPx[index + 1])
    );
  }

  /**
   * STEP-2 expected radii R1 < R2 < ... < R6 laid out from the same
   * origin (Sun centre) with the Sun -> R1 + band gaps above. Used to
   * verify the geometry pass stayed on the STEP-2 distances; the
   * movement itself reads geometry.radii[] every frame, so a radius
   * change flows to trajectory + depth + containment together.
   */
  private step2ExpectedRadii(): Float64Array {
    const out = new Float64Array(V3D_SLOTS);
    let radius = this.step2FirstOrbitRadius();
    for (let i = 0; i < V3D_SLOTS; i++) {
      out[i] = radius;
      if (i < V3D_SLOTS - 1) radius += this.step2BandGap(i);
    }
    return out;
  }

  /* NOTE: edgeCapRadius() has been REMOVED. It used to shrink an individual
     planet to keep it off the scene edge, which is exactly what must not be
     done: the single uniform fit scale now guarantees that the COMPLETE drawn
     composition stays inside the scene, so a body is never resized on its own
     to avoid clipping (values-3d.geometry.ts compute() bounding box). */

  /**
   * STEP-2 orbit-1 affordability cap (rendered sizes): largest ANY planet
   * may render while orbit 1 can still afford the Sun -> planet-1 gap at
   * the 45° projection:
   *   - projection + gap: TILT45 * R1 >= visSun * (1 + 2*GAP)
   *                                    + V3D_MAX_SCALE * visPlanet
   *   - dominance:        visSun >= V3D_SUN_DOMINANCE * visPlanet.
   * Same inequalities as firstOrbitRadius(); size gives way, position
   * never moves. Planets keep their relative sizes (rowFactor trims the
   * whole wish row uniformly instead of equalizing spheres).
   */
  private orbitCapRadius(): number {
    const gap = this.sunToFirstPlanetGap();
    const denominator =
      V3D_MAX_SCALE * (V3D_SUN_DOMINANCE * (1 + 2 * gap) + 1);
    return Math.max(0, (this.geometry.radii[0] * this.spacingTilt()) / denominator - 4);
  }

  /**
   * STEP-2 Sun wish cap (rendered size): largest the Sun may render while
   * orbit 1 can still afford it at the 45° projection - same derivation
   * solved for the Sun. Keeps the Sun dominant without swallowing
   * planet 1's path in front / behind / at the side.
   */
  private step2MaxSunRadius(r1: number): number {
    const gap = this.sunToFirstPlanetGap();
    const denominator = 1 + 2 * gap + 1 / V3D_SUN_DOMINANCE;
    return Math.max(0, (r1 * this.spacingTilt()) / denominator);
  }

  /**
   * Rendered-size ceiling of planet i (design px) - the ONE place the two
   * remaining distance invariants of this step meet, so they can never drift
   * apart:
   *   - what orbit 1 can afford (projection/gap)  -> orbitCapRadius(),
   *   - the rendered/position budget that firstOrbitRadius() sized R1 with
   *     (V3D_PLANET_VISUAL_HEADROOM x the position radius), which is what
   *     makes the Sun -> Planet 1 clearance a guarantee for the DRAWN body.
   * SCENE-EDGE CONTAINMENT IS NOT A SIZE CAP ANY MORE: it is owned by the ONE
   * uniform fit scale (see the bounding box in values-3d.geometry.ts), so a
   * planet is never shrunk on its own to avoid clipping.
   * Never below the position baseline (a planet always renders at least its
   * design anchor). Size only - this never moves a body.
   */
  private planetVisualCap(i: number): number {
    // CONTAINMENT IS OWNED BY THE ONE UNIFORM FIT SCALE - never by shrinking a
    // single planet: compute() fits the WHOLE drawn composition (Sun, halo,
    // every orbit, every drawn body, glow margin) inside the measured scene.
    // The drawn size is therefore limited only by its own rendered/position
    // budget and by what orbit 1 can afford at the projection (Sun dominance).
    // The old per-planet scene-edge cap is gone on purpose.
    const baseline = this.planetRadiiPx[i];
    const budget = V3D_PLANET_VISUAL_HEADROOM * baseline;
    return Math.max(baseline, Math.min(this.orbitCapRadius(), budget));
  }

  /**
   * CONTENT-FIRST FIT (init + resize ONLY, never per frame, no physics).
   * Measures the REAL content of every planet - icon + title + description
   * exactly as laid out right now, in layout px, so neither the stage zoom
   * nor the sphere transforms can distort the measurement - and grows the
   * planet whenever its content needs more room than the configured radius
   * gives:
   *     final radius = max(configured radius, radius required by content)
   * Growth is capped (V3D_CONTENT_FIT_MAX_GROWTH). If even the grown planet
   * cannot hold the text, THAT planet's text is scaled down by the exact
   * shortfall - content is never clipped, never ellipsised and never hidden
   * behind the sphere edge. Converges in 1-2 measured passes.
   */
  private fitContentToPlanets(): void {
    for (let pass = 0; pass < V3D_CONTENT_FIT_PASSES; pass++) {
      this.writeBodySizes();
      let grew = false;
      for (let i = 0; i < V3D_SLOTS; i++) {
        const need = this.requiredRadius(i);
        const ceiling = this.manualRadiiPx[i] * V3D_CONTENT_FIT_MAX_GROWTH;
        // More content -> bigger planet (never smaller text).
        if (need > this.planetRadiiPx[i] + 0.5 && need <= ceiling) {
          this.planetRadiiPx[i] = need;
          grew = true;
        }
      }
      if (!grew) break;
    }
    this.writeBodySizes();

    // Last resort, so that nothing is ever clipped: shrink the text of a
    // planet that still cannot hold its content. Iterative and re-measured
    // (bounded), because the icon, the wrapping and the fixed gaps do not
    // shrink in exactly the same proportion as the text.
    for (let i = 0; i < V3D_SLOTS; i++) {
      for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
        const need = this.requiredRadius(i);
        if (!(need > this.planetRadiiPx[i] + 0.5)) break;
        if (!(need > 0)) break;
        this.contentTitlePx[i] *= this.planetRadiiPx[i] / need;
        this.writeBodySizes();
      }
      const remaining = this.requiredRadius(i);
      if (remaining > this.planetRadiiPx[i] + 0.5 && isDevMode()) {
        console.warn(
          `[values-3d] Planet ${i + 1}: content still needs Ø${(remaining * 2).toFixed(0)}px, planet has Ø${(this.planetRadiiPx[i] * 2).toFixed(0)}px.`,
        );
      }
    }
    // Re-absorb the growth into the Sun so the fit scale stays at 1 (the
    // composition keeps filling the scene width) and every planet keeps
    // exactly the size its content needs.
    this.absorbGrowthIntoSun();
    this.applySunContentScale();
    this.writeBodySizes();
  }

  /**
   * Radius (px) a planet needs so its measured content stays completely
   * inside the sphere's front cap:
   *   - block height = the REAL laid-out height of icon + title + description
   *     (line wrapping included, so a longer FR/AR text needs a bigger planet)
   *   - block width  = the widest real line, measured with the same font
   *   - the half-diagonal of that block must stay inside the cap circle.
   */
  private requiredRadius(i: number): number {
    const content = this.contents[i];
    if (!content) return 0;
    const kids = content.children;
    if (kids.length === 0) return 0;

    const boxWidth = this.contentBoxWidth(i);
    let blockWidth = 0;
    let blockHeight = 0;
    for (let k = 0; k < kids.length; k++) {
      const el = kids[k] as HTMLElement;
      blockHeight += el.offsetHeight;
      blockWidth = Math.max(blockWidth, this.contentLineWidth(el, boxWidth));
    }
    blockHeight += this.contentGapPx * (kids.length - 1);
    if (blockWidth <= 0 || blockHeight <= 0) return 0;

    const halfDiagonal = Math.hypot(blockWidth, blockHeight) / 2;
    return (halfDiagonal * V3D_CONTENT_FIT_SAFETY * this.contentScale) / (2 * V3D_CAP_RADIUS_FRAC);
  }

  /** Usable text width (px) inside a planet: surface cap minus its padding.
      Uses the VISUAL radius, so a grown planet automatically gives its text
      a wider column (fewer lines -> less required height). */
  private contentBoxWidth(i: number): number {
    const diameter = this.visualRadiiPx[i] * 2;
    const pad = Math.min(30, Math.max(0, this.contentPadPct[i])) / 100;
    return diameter * (2 * V3D_CAP_RADIUS_FRAC) * (1 - 2 * pad);
  }

  /**
   * Widest line of one content child, measured with the child's OWN font.
   * Canvas metrics = no layout thrash, no dependence on the stage zoom, and
   * the same result for every language. Non-text children (the icon) fall
   * back to their laid-out width.
   */
  private contentLineWidth(el: HTMLElement, boxWidth: number): number {
    const text = (el.textContent ?? '').trim();
    if (!text) return Math.min(el.offsetWidth, boxWidth) || el.offsetHeight;
    const ctx = this.measureCtx;
    if (!ctx) return Math.min(el.offsetWidth, boxWidth);
    const style = getComputedStyle(el);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let widestWord = 0;
    for (const word of text.split(/\s+/)) {
      widestWord = Math.max(widestWord, ctx.measureText(word).width);
    }
    // A wrapped paragraph fills its box; a single long word can overflow it,
    // and that word is then what the planet must be big enough to hold.
    const natural = ctx.measureText(text).width;
    return Math.max(widestWord, Math.min(natural, boxWidth));
  }

  /** Writes the rendered SIZES of every body into the DOM (init + resize).
      Size only - the position of every body stays owned by the rAF loop. */
  private writeBodySizes(): void {
    if (this.scene) {
      this.scene.style.setProperty('--v3d-sun', `${(this.visualSunRadiusPx * 2).toFixed(1)}px`);
      this.scene.style.setProperty('--v3d-sun-title-size', `${this.sunTitlePx.toFixed(2)}px`);
      this.scene.style.setProperty('--v3d-sun-desc-size', `${(this.sunTitlePx * V3D_DESC_PER_TITLE).toFixed(2)}px`);
      this.scene.style.setProperty('--v3d-sun-icon-size', `${(this.sunTitlePx * V3D_ICON_PER_TITLE).toFixed(2)}px`);
    }
    for (let i = 0; i < this.planets.length; i++) {
      const el = this.planets[i];
      if (!el) continue;
      const title = this.contentTitlePx[i];
      el.style.setProperty('--v3d-pd', `${(this.visualRadiiPx[i] * 2).toFixed(1)}px`);
      el.style.setProperty('--v3d-title-size', `${title.toFixed(2)}px`);
      // The description has its OWN size (V3D_PLANET_CONTENT[i].descriptionScale),
      // so it can be tuned without touching the title.
      el.style.setProperty('--v3d-desc-size', `${this.contentDescPx[i].toFixed(2)}px`);
      el.style.setProperty('--v3d-icon-size', `${(title * V3D_ICON_PER_TITLE).toFixed(2)}px`);
      el.style.setProperty('--v3d-content-pad', `${this.contentPadPct[i]}%`);
      el.style.setProperty('--v3d-content-maxw', `${this.contentMaxWPct[i]}%`);
    }
  }


  /**
   * Degrees per second for the planet's own axial rotation (planet i).
   * Outer planets rotate slightly slower so the smaller text stays readable,
   * but never below ~3°/s. Controlled by the single UX knob
   * PLANET_SELF_ROTATION_DEG_PER_SEC. Time-based (see startAnimation), so
   * the speed is identical on every screen / device / frame rate.
   *
   *   i: 0 -> 5.00 °/s (~72s per 360°)   ... fast inner
   *   i: 5 -> 3.50 °/s (~103s per 360°)  ... calm outer
   */
  private selfRotationSpeed(i: number): number {
    return PLANET_SELF_ROTATION_DEG_PER_SEC * Math.max(0.65, 1 - i * 0.06);
  }

  selectPlanet(index: number): void {
    const i = ((index % V3D_SLOTS) + V3D_SLOTS) % V3D_SLOTS;
    this.activeIndex.set(i);
    // Orbital position is untouched - the planet keeps moving from where it is.
    this.scheduleAutoplay(V3D_AUTOPLAY_MS);
  }

  /**
   * ORBITAL GEOMETRY + SPACING PASS (STEP 2) - init + resize ONLY.
   * Thin component-side wrapper around Values3dGeometry.compute()
   * (values-3d.geometry.ts): the geometry derives the ONE origin
   * (centerX / centerY = the Sun centre), the six orbit radii and the
   * uniform fit scale from the measured scene and the position-layer
   * body sizes. STEP 2 tunes ONLY the geometric distances:
   *   Sun -> R1 (V3D_SUN_TO_FIRST_PLANET_GAP: Sun edge + planet-1 body
   *     + visual gap, / tilt so it holds at EVERY orbital angle, in
   *     front / behind / at the side);
   *   R1 -> R2 -> ... -> R6 (bandGap: R(next) >= R(current) + p_current
   *     + p_next + visual gap, x spacingScale for mobile / tablet /
   *     desktop / large). Geometric distances, never CSS margins; one
   *   common origin; containment (fit) has priority over spacing.
   * Movement projects those radii with V3D_ORBIT_PLANE_ANGLE_DEG (45°,
   * unchanged) in calculateOrbitPoint() below. No traces are drawn in
   * STEP 1/2; result.traces is ignored until STEP 3.
   */
  private updateOrbitGeometry(drawBounds = false): void {
    const result = this.geometry.compute({
      width: this.sceneWidth,
      height: this.sceneHeightPx,
      sunRadius: this.sunRadiusPx,
      planetRadii: this.planetRadiiPx,
      // Responsive spacing dial (same value the normalization used) - the
      // SIX radii and the containment follow it together.
      spacingScale: this.spacingScale(),
      // PASS 2 ONLY: hand over the DRAWN radii so the ONE uniform fit is
      // derived from what is ACTUALLY PAINTED - Sun + halo + every orbit +
      // every drawn body + the glow margin. The orbit radii above still come
      // from the POSITION inputs, so no locked distance can move.
      ...(drawBounds
        ? {
            visualSunRadius: this.visualSunRadiusPx,
            visualPlanetRadii: this.visualRadiiPx,
          }
        : {}),
    });
    if (!result) return; // scene not measured yet - keep the previous geometry
    this.writeFitScale(result.fit);
    if (!drawBounds) this.tracesSig.set(result.traces); // radii are pass-1 only
    this.lastBox = result.box;
  }

  /** Screen category from the MEASURED scene width: 0 mobile, 1 tablet,
      2 PC/laptop, 3 large desktop. */
  private selectCategory(sceneWidth: number): number {
    if (sceneWidth <= 560) return 0;
    if (sceneWidth <= 900) return 1;
    if (sceneWidth <= 1919) return 2;
    return 3;
  }

  /**
   * Responsive spacing scale (STEP 2) of the CURRENT screen category -
   * THE single degradation dial for the geometric orbital distances
   * (V3D_SPACING_SCALE_BY_CATEGORY in values-3d.geometry.ts):
   *   0 mobile (<=560px):  compact, readable content + visible Sun/planets,
   *     no clipping;
   *   1 tablet (<=900px):  more radial separation than mobile;
   *   2 desktop (<=1919px): larger orbital bands;
   *   3 large (>=1920px):  uses the available width, no empty margins.
   * The SAME value is handed to the normalization (designHalfExtent) and to
   * the geometry pass (compute: R1 -> ... -> R6), so both see one identical
   * composition - no per-breakpoint math, no CSS margins, one origin.
   * Containment wins: clamped to [floor, 1], and the uniform fit scale
   * shrinks the composition before anything clips, leaves the component,
   * breaks Sun dominance or hurts readability.
   */
  private spacingScale(): number {
    const table = V3D_SPACING_SCALE_BY_CATEGORY;
    const raw = table[this.category % table.length];
    return Math.min(1, Math.max(V3D_SPACING_MIN_SCALE, raw));
  }

  /**
   * Publishes the OPTIONAL composition offset (V3D_SUN_OFFSET_X / _Y in
   * values-3d.geometry.ts) to the DOM anchors pinned at 50% / 50% of the
   * design-space stage: the Sun, its halo and the six planet wrappers. The
   * geometry's ONE origin (centerX / centerY) applies the very same values,
   * so the orbits keep orbiting the Sun exactly and the traces stay on the
   * planets. With the shipped 0 / 0 this is a no-op (the CSS fallback is 0px
   * too), and the uniform fit scale keeps the composition contained whatever
   * the offset is. Init + resize ONLY.
   */
  private writeLayoutOffset(): void {
    if (!this.scene) return;
    this.scene.style.setProperty('--v3d-offset-x', `${V3D_SUN_OFFSET_X}px`);
    this.scene.style.setProperty('--v3d-offset-y', `${V3D_SUN_OFFSET_Y}px`);
  }

  /* NOTE: --v3d-scene-aspect is GONE. The scene height is no longer derived
     from the composition: .v3d-scene is given the REAL Section-B box by CSS
     (edge-padded width x the full available height), so the bounding box / fit
     can never depend on the box they define. compute() thus converges in ONE
     pass and the fit always matches the measured scene rectangle. */

  /** Writes the uniform fit scale into --v3d-fit, the one custom property
      the engine still publishes (.v3d-stage consumes it to scale the whole
      design space). Init + resize ONLY. Body sizes are written by
      writeBodySizes(). */
  private writeFitScale(fit: number): void {
    if (!this.scene) return;
    this.scene.style.setProperty('--v3d-fit', fit.toFixed(4));
  }

  /**
   * PLANET geometry from ONE theta: the projected screen position plus the
   * depth of that very same orbital point. geometry.orbitPoint() is the only
   * place the orbital mathematics exists; depth01 is the ONLY input of the
   * near/far model (scale, opacity, z-index), so the front/back ordering
   * comes from the same theta - there is no second front/back calculation
   * and nothing here can move a body off the plane.
   */
  private calculatePlanetGeometry(index: number, angle: number): PlanetGeometry {
    const point = this.geometry.orbitPoint(index, angle);
    const { x, y, depth01 } = point;
    const scale = V3D_MIN_SCALE + depth01 * (V3D_MAX_SCALE - V3D_MIN_SCALE);
    const opacity = V3D_MIN_OPACITY + depth01 * (V3D_MAX_OPACITY - V3D_MIN_OPACITY);
    // Far half renders behind the sun (z 200..300), near half in front (300..400).
    const zIndex = Math.round(V3D_Z_BASE + depth01 * V3D_Z_SPAN);
    return { x, y, depth: depth01, scale, opacity, zIndex };
  }

  /** A. ORBITAL POSITION transform (never mixes with the self-rotation
      angle). Position + depth scale only. calculateOrbitPoint() hands out
      ABSOLUTE stage coordinates; the planet is pinned at 50% / 50% of the
      stage, so the DOM adds the ONE origin (the Sun centre) back - subtract
      it here and the rendered offset is exactly the mathematical one. */
  private composeOrbitTransform(g: PlanetGeometry): string {
    return `translate3d(${(g.x - this.geometry.centerX).toFixed(2)}px, ${(g.y - this.geometry.centerY).toFixed(2)}px, 0) translate(-50%, -50%) scale(${g.scale.toFixed(4)})`;
  }

  /** B. SELF-ROTATION transform - the planet spinning around its own local
      vertical axis. Applied ONLY to .v3d-planet-sphere, which physically
      contains the icon/title/description. */
  private composeSelfRotationTransform(angle: number): string {
    return `rotateY(${(angle / V3D_DEG).toFixed(2)}deg)`;
  }

  /**
   * Reads the REAL rendered text of every planet (the translated string of
   * the active language) plus the content font family - init/resize only.
   * Scoped to the face-0 caps: every face carries the identical string, so
   * measuring it four times would be pure waste. Sizes only - nothing here
   * can move a body.
   */
  private readContentText(host: HTMLElement): void {
    const titles = host.querySelectorAll<HTMLElement>('.v3d-planet-surface.face-0 .v3d-planet-title');
    const descs = host.querySelectorAll<HTMLElement>('.v3d-planet-surface.face-0 .v3d-planet-desc');
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.planetTitleText[i] = (titles[i]?.textContent ?? '').trim();
      this.planetDescText[i] = (descs[i]?.textContent ?? '').trim();
    }
    if (titles.length > 0) {
      const family = getComputedStyle(titles[0]).fontFamily;
      if (family) this.measureFontFamily = family;
    }
  }

  /** Reads the scene size once and caches the planet/content nodes for the
      rAF loop (no DOM queries inside the animation frames). */
  private applyStaticGeometry(): void {
    const host = this.elementRef.nativeElement;
    this.scene = host.querySelector<HTMLElement>('.v3d-scene');
    this.sceneWidth = this.scene ? this.scene.getBoundingClientRect().width : 0;
    this.sceneHeightPx = this.scene ? this.scene.getBoundingClientRect().height : 0;

    this.planets = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet'));
    this.spheres = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-sphere'));
    // The FOUR content faces are cached per planet: face-0 is the one
    // that is measured and sized, and every face receives its OWN
    // per-face facing factor (`--v3d-face`) per frame from the existing
    // rAF loop - no new loop, timer, or signal.
    this.contents = Array.from(
      host.querySelectorAll<HTMLElement>('.v3d-planet-surface.face-0 > .v3d-planet-content'),
    );
    this.faceContents = this.planets.map((planet) => [
      planet.querySelector<HTMLElement>('.v3d-planet-surface.face-0 > .v3d-planet-content'),
      planet.querySelector<HTMLElement>('.v3d-planet-surface.face-90 > .v3d-planet-content'),
      planet.querySelector<HTMLElement>('.v3d-planet-surface.face-180 > .v3d-planet-content'),
      planet.querySelector<HTMLElement>('.v3d-planet-surface.face-270 > .v3d-planet-content'),
    ].filter((el): el is HTMLElement => el !== null));

    // Text measurement context (one 2D canvas reused for every planet; the
    // real text is measured with the real font so FR / EN / AR all fit).
    this.measureCtx =
      typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    // Gap between the content children (px) - read from the live CSS once.
    this.contentGapPx = this.contents.length > 0
      ? parseFloat(getComputedStyle(this.contents[0]).rowGap) || 0
      : 0;
    this.sunContent = host.querySelector<HTMLElement>('.v3d-sun-content');
    this.sunContentGapPx = this.sunContent
      ? parseFloat(getComputedStyle(this.sunContent).rowGap) || 0
      : this.contentGapPx;
    this.readContentText(host);
    this.writeLayoutOffset();

    // POSITION FIRST (frozen baseline: orbits, the one centre, tilt, fit
    // scale), THEN the content-first visual pass on top of those fixed
    // positions.
    this.applyVisualSizes();
    this.fitContentToPlanets();
    // PASS 1: the FROZEN orbit radii (position layer) + a provisional fit, so
    // the visual pass below has the radii it needs for its size caps.
    this.updateOrbitGeometry();
    // The content-first VISUAL pass: the DRAWN sizes - what is actually painted.
    this.growVisualBodies();
    // PASS 2: re-derive the ONE uniform fit from the DRAWN composition. The
    // bounding box now holds the Sun + its halo + EVERY orbit + EVERY drawn
    // body + the glow margin, so containment is proven against what is painted.
    // The orbit radii are re-derived from the unchanged position inputs, so no
    // body moves and no locked distance changes.
    this.updateOrbitGeometry(true);
    this.validateOrbitGeometry();
    this.applyAnimation();
  }

  /**
   * DEV-TIME SUN-CONTENT OVERLAP + LAYERING AUDIT - init / resize ONLY (never
   * per frame, no production cost: isDevMode()).
   *
   * The Sun carries the active value, so its content must survive the planets
   * passing in front of it. For the CURRENT plane angle and the CURRENT sizes
   * this measures, over a full revolution and for every planet:
   *   1. the worst share of the Sun's READABLE CONTENT ZONE covered by a
   *      planet disc - the content zone being the Sun disc inset by its own
   *      content padding (V3D_SUN_CONTENT_PAD_X / _Y), i.e. exactly where the
   *      icon / title / description are laid out;
   *   2. the deepest penetration of a planet disc into the Sun disc;
   *   3. whether the REAL laid-out text block of the Sun (measured live, in
   *      the active language) is touched at all.
   * It also verifies the layering invariant of the ONE 3D model: the order
   * must come from DEPTH alone, so a planet renders in front of the Sun
   * (z > V3D_Z_SUN) exactly where its depth is positive and behind it where
   * its depth is negative. No angle comparison, no per-half special case.
   *
   * The requirement is < ~50% of the readable content zone; the audit warns
   * as soon as it is exceeded, and reports the measured values otherwise.
   */
  private validateSunContentOverlap(): void {
    if (!isDevMode()) return;
    const sunR = this.visualSunRadiusPx;
    if (sunR <= 0 || this.geometry.radii.length === 0) return;
    // Everything below is in DESIGN px: the planet offsets, the radii and the
    // measured block heights all live in that space, and the fit scale applies
    // to the whole composition equally, so it cannot change a ratio.
    const zoneHx = sunR * (1 - 2 * V3D_SUN_CONTENT_PAD_X);
    const zoneHy = sunR * (1 - 2 * V3D_SUN_CONTENT_PAD_Y);
    const zoneArea = 4 * zoneHx * zoneHy;
    if (!(zoneArea > 0)) return;

    // The REAL text block of the Sun, exactly as laid out right now (active
    // language, active value).
    const content = this.sunContent;
    let textHx = 0;
    let textHy = 0;
    if (content && content.children.length > 0) {
      const boxWidth = sunR * 2 * (1 - 2 * V3D_SUN_CONTENT_PAD_X);
      let blockWidth = 0;
      let blockHeight = 0;
      for (let k = 0; k < content.children.length; k++) {
        const el = content.children[k] as HTMLElement;
        blockHeight += el.offsetHeight;
        blockWidth = Math.max(blockWidth, this.contentLineWidth(el, boxWidth));
      }
      blockHeight += this.sunContentGapPx * (content.children.length - 1);
      textHx = blockWidth / 2;
      textHy = blockHeight / 2;
    }

    let worstZone = 0;
    let worstPlanet = -1;
    let worstDeg = 0;
    let worstText = 0;
    let penetration = 0;
    for (let i = 0; i < this.planets.length; i++) {
      const bodyR = this.visualRadiiPx[i];
      for (let deg = 0; deg < 360; deg++) {
        const theta = (deg * Math.PI) / 180;
        // The ONE trajectory: the same function the movement and the traces use.
        const point = this.geometry.orbitPoint(i, theta);
        const px = point.x - this.geometry.centerX;
        const py = point.y - this.geometry.centerY;
        const distance = Math.hypot(px, py);
        if (distance - bodyR >= sunR) continue; // never touches the Sun
        penetration = Math.max(penetration, sunR - (distance - bodyR));
        const share = this.discRectArea(bodyR, px, py, zoneHx, zoneHy) / zoneArea;
        if (share > worstZone) {
          worstZone = share;
          worstPlanet = i;
          worstDeg = deg;
        }
        if (textHx > 0 && textHy > 0) {
          worstText = Math.max(
            worstText,
            this.discRectArea(bodyR, px, py, textHx, textHy) / (4 * textHx * textHy),
          );
        }
      }
    }

    // Layering invariant: the order comes from DEPTH, never from an angle
    // comparison and never from a per-half special case.
    const flat: number[] = [];
    for (let i = 0; i < this.planets.length; i++) {
      const front = this.calculatePlanetGeometry(i, Math.PI / 2).zIndex > V3D_Z_SUN;
      const back = this.calculatePlanetGeometry(i, -Math.PI / 2).zIndex < V3D_Z_SUN;
      if (!front || !back) flat.push(i + 1);
    }

    const zonePct = (worstZone * 100).toFixed(1);
    const textPct = (worstText * 100).toFixed(1);
    const penetrationPct = ((penetration / sunR) * 100).toFixed(0);
    const worstCase =
      worstPlanet >= 0 ? `(planet ${worstPlanet + 1} at ${worstDeg}°)` : '(no planet reaches the Sun)';
    const summary =
      `[values-3d] Sun content overlap: worst ${zonePct}% of the readable content zone ` +
      `${worstCase}, penetration ${penetrationPct}% of the Sun radius, ` +
      `Sun text block ${textHx > 0 ? `${textPct}% covered` : 'not measured'} - ` +
      `plane ${V3D_ORBIT_PLANE_ANGLE_DEG}°, fit ${this.geometry.fit.toFixed(2)}, ` +
      `front/back from depth ${flat.length === 0 ? 'OK' : `BROKEN (planet ${flat.join(', ')})`}.`;
    if (worstZone > 0.5) {
      console.warn(
        `${summary} REQUIREMENT < 50%: LOWER V3D_ORBIT_PLANE_ANGLE_DEG (a smaller angle keeps the planets farther from the Sun on screen) - never change a radius or a size.`,
      );
    } else {
      console.info(summary);
    }
  }

  /**
   * Area of the intersection between a disc (radius `p`, centre `px` / `py`)
   * and an axis-aligned rectangle centred on the origin (half extents `hx` /
   * `hy`). Numeric integration, DEV diagnostics only - it runs from the
   * resize-time audit, never from the animation frames.
   */
  private discRectArea(
    p: number,
    px: number,
    py: number,
    hx: number,
    hy: number,
  ): number {
    const x0 = Math.max(-hx, px - p);
    const x1 = Math.min(hx, px + p);
    if (!(x1 > x0)) return 0;
    const steps = 48;
    const dx = (x1 - x0) / steps;
    let area = 0;
    for (let k = 0; k < steps; k++) {
      const x = x0 + (k + 0.5) * dx;
      const chord2 = p * p - (x - px) * (x - px);
      if (chord2 <= 0) continue;
      const chord = Math.sqrt(chord2);
      const lo = Math.max(-hy, py - chord);
      const hi = Math.min(hy, py + chord);
      if (hi > lo) area += (hi - lo) * dx;
    }
    return area;
  }

  /**
   * DEV-TIME SPACING AUDIT (STEP 2) - init / resize ONLY (never per frame,
   * production cost: isDevMode()). Proves the two geometric guarantees by
   * sampling the SAME calculateOrbitPoint() the planets use (45°):
   *
   *   1. SUN <-> PLANET 1: the smallest screen gap between the Sun's edge
   *      and planet 1's DEPTH-SCALED disc over ALL 360 degrees - in front,
   *      behind and at the side - must stay >= half of the configured gap
   *      (configured = V3D_SUN_TO_FIRST_PLANET_GAP x the Sun's diameter;
   *      the 50% is the calibration slack between the headroom budget R1 is
   *      sized with and the sizes that actually render).
   *   2. NEIGHBOUR BANDS: for every consecutive pair, the smallest screen
   *      gap when both planets are at the SAME angle - the worst case that
   *      exists, because the projected step shrinks toward the vertical
   *      extremes while both discs grow with the depth scale. Reported per
   *      pair so V3D_SPACING_SCALE_BY_CATEGORY can be tuned on real numbers.
   *
   * Resize-only cost (a few thousand cheap iterations), zero production cost.
   */
  private validateSpacingGaps(): void {
    if (!isDevMode()) return;
    const sunR = this.visualSunRadiusPx;
    if (!(sunR > 0) || this.geometry.radii.length === 0) return;

    // 1. Sun <-> planet 1 over a full revolution (depth-scaled disc),
    //    sampled from the rendered 45° movement (not the geometry audit).
    let minSunGap = Infinity;
    let minSunDeg = 0;
    for (let deg = 0; deg < 360; deg++) {
      const point = this.geometry.orbitPoint(0, (deg * Math.PI) / 180);
      const distance = Math.hypot(
        point.x - this.geometry.centerX,
        point.y - this.geometry.centerY,
      );
      const scale = V3D_MIN_SCALE + point.depth01 * (V3D_MAX_SCALE - V3D_MIN_SCALE);
      const gap = distance - sunR - this.visualRadiiPx[0] * scale;
      if (gap < minSunGap) {
        minSunGap = gap;
        minSunDeg = deg;
      }
    }
    const configured = 2 * V3D_SUN_TO_FIRST_PLANET_GAP * sunR;

    // 2. Neighbour pairs, same angle = worst case.
    const pairs: string[] = [];
    for (let i = 0; i < this.geometry.radii.length - 1; i++) {
      const dr = this.geometry.radii[i + 1] - this.geometry.radii[i];
      const bodies = this.visualRadiiPx[i] + this.visualRadiiPx[i + 1];
      let minGap = Infinity;
      for (let deg = 0; deg < 360; deg++) {
        const theta = (deg * Math.PI) / 180;
        // Screen distance between BOTH planets at this very same theta,
        // with the STEP-2 45° projection (same as the movement).
        const tilt = this.spacingTilt();
        const projection = Math.hypot(
          Math.cos(theta),
          Math.sin(theta) * tilt,
        );
        const point = this.geometry.orbitPoint(i, theta);
        const scale = V3D_MIN_SCALE + point.depth01 * (V3D_MAX_SCALE - V3D_MIN_SCALE);
        minGap = Math.min(minGap, projection * dr - bodies * scale);
      }
      pairs.push(`${i + 1}-${i + 2} ${minGap >= 0 ? '+' : ''}${minGap.toFixed(0)}px`);
    }

    const summary =
      `[values-3d] Spacing: Sun<->P1 min gap ${minSunGap.toFixed(0)}px at ${minSunDeg}° ` +
      `(configured ${configured.toFixed(0)}px = ${(V3D_SUN_TO_FIRST_PLANET_GAP * 100).toFixed(0)}% of the Sun diameter) - ` +
      `neighbour min gaps [${pairs.join(', ')}] at scale ${this.spacingScale().toFixed(2)}, ` +
      `R1 ${this.geometry.radii[0].toFixed(0)}px.`;
    if (minSunGap < configured * 0.5) {
      console.warn(
        `${summary} REQUIREMENT: Sun and planet 1 must never visually merge - check V3D_SUN_TO_FIRST_PLANET_GAP and the visual headroom caps.`,
      );
    } else {
      console.info(summary);
    }
  }

  /**
   * DEV-TIME VALIDATION (STEP 2) - init/resize ONLY, never per frame.
   * Containment is guaranteed by the uniform fit scale, so this is
   * diagnostics + warnings:
   *   1. full table: rendered sizes, content fit, orbit radii, overlap,
   *      fit scale and the UNCHANGED 45° plane angle actually rendered
   *   2. the Sun must stay clearly bigger than every planet (>= 1.25x)
   *   3. a planet must never be smaller than its own content needs
   *   4. the first orbit must match the STEP-2 Sun -> Planet 1 distances
   *      (R1 + band gaps from the same origin, not CSS margins)
   */
  private validateOrbitGeometry(): void {
    if (this.sceneWidth <= 0 || !isDevMode()) return;
    const fit = this.geometry.fit;
    const rendered = (r: number) => (r * 2 * fit).toFixed(0);
    const maxPlanetR = Math.max(...Array.from(this.visualRadiiPx));

    console.info(
      `[values-3d] Sizes: scene ${this.sceneWidth.toFixed(0)}x${this.sceneHeightPx.toFixed(0)}px, fit ${fit.toFixed(2)}, plane ${V3D_ORBIT_PLANE_ANGLE_DEG}° (STEP-2 tilt ${this.spacingTilt().toFixed(2)}), orbits ${Array.from(this.geometry.radii, (r) => (r * fit).toFixed(0)).join('/')}px (position layer - locked), sun Ø${rendered(this.visualSunRadiusPx)}px (text ${(this.sunTitlePx * fit).toFixed(1)}px), planets Ø${Array.from(this.visualRadiiPx, (r) => rendered(r)).join('/')}px, titles ${Array.from(this.contentTitlePx, (t) => (t * fit).toFixed(1)).join('/')}px`,
    );

    // 1. Sun dominance (visual / depth-scaled: the Sun wins at the worst angle).
    if (this.visualSunRadiusPx > 0 && maxPlanetR > 0 && this.visualSunRadiusPx < maxPlanetR * V3D_SUN_DOMINANCE * V3D_MAX_SCALE) {
      console.warn(
        `[values-3d] Sun Ø${rendered(this.visualSunRadiusPx)}px should be >= ${V3D_SUN_DOMINANCE}x the largest planet Ø${rendered(maxPlanetR)}px (x V3D_MAX_SCALE) - increase V3D_SUN_RADIUS (or reduce V3D_PLANET_RADII).`,
      );
    }

    // 2. Content fit + neighbour overlap, planet by planet (visual sizes).
    for (let i = 0; i < V3D_SLOTS; i++) {
      const need = this.requiredRadius(i);
      if (need > 0 && need > this.visualRadiiPx[i] + 0.5) {
        console.warn(
          `[values-3d] Planet ${i + 1}: content wants Ø${rendered(need)}px but the sphere is Ø${rendered(this.visualRadiiPx[i])}px - text was scaled down to keep it fully visible.`,
        );
      }
      if (i < V3D_SLOTS - 1) {
        // STEP-2 GEOMETRIC band step (design px) vs the two RENDERED
        // bodies at the SAME angle (worst case): positive = separated,
        // negative = may still cross. Spacing scale per category, never
        // CSS. Size relationships preserved (uniform rowFactor trim).
        const step = this.step2BandGap(i) * fit;
        const bodies = (this.visualRadiiPx[i] + this.visualRadiiPx[i + 1]) * fit;
        const gap = step - bodies;
        console.info(
          gap > 0
            ? `[values-3d] Planets ${i + 1}-${i + 2}: bands separated by ${gap.toFixed(0)}px at the closest approach (scale ${this.spacingScale().toFixed(2)}).`
            : `[values-3d] Planets ${i + 1}-${i + 2}: may overlap by ${(-gap).toFixed(0)}px while crossing (scale ${this.spacingScale().toFixed(2)}, V3D_BAND_VISUAL_GAP_RATIO ${V3D_BAND_VISUAL_GAP_RATIO}).`,
        );
      }
    }

    // 4. STEP-2 first orbit + monotonic bands from the same origin:
    //    Sun -> R1 (sun + planet1 + gap, / 45° tilt) and
    //    R1 < R2 < ... < R6 (band gaps add rendered bodies + gap).
    //    Warns only; movement reads geometry.radii[] every frame.
    const expected = this.step2ExpectedRadii();
    if (Math.abs(this.geometry.radii[0] - expected[0]) > 0.5) {
      console.warn('[values-3d] STEP-2: first orbit drifted from Sun -> Planet 1 distance.');
    }
    for (let i = 0; i < expected.length - 1; i++) {
      if (!(expected[i + 1] > expected[i])) {
        console.warn(`[values-3d] STEP-2: bands not separated at R${i + 1} -> R${i + 2}.`);
      }
    }

    // 5. STEP-2 SPACING guarantees: Sun <-> planet 1 at EVERY orbital
    //    angle (front / behind / side) + neighbour bands R1..R6 from the
    //    same origin, sampled from the rendered 45° movement.
    this.validateSpacingGaps();

    // 6. THE composition requirement this step exists for: a planet passing in
    //    FRONT of the Sun must not cover more than ~50% of the Sun's readable
    //    content zone, and the Sun's real text block must stay readable.
    this.validateSunContentOverlap();

    // 7. THE CONTAINMENT GUARANTEE ITSELF, checked against the SAME bounding
    //    box compute() fitted: every orbit + its drawn (depth-scaled) body and
    //    the Sun + its halo must stay inside the measured scene rectangle at
    //    the WORST orbital angle (theta = 0 deg for X, 90 deg for Y).
    this.validateSceneContainment();
  }

  /**
   * THE responsive fix: stale geometry after ANY scene size change. The
   * observer keeps the JS radii in sync with the measured scene at ALL
   * times, without Angular CD. It reacts to WIDTH and HEIGHT changes (browser
   * resize, orientation change, breakpoint change, one-viewport section
   * growth) - not width only.
   */
  /**
   * DEV-TIME CONTAINMENT AUDIT (init / resize only; isDevMode(), zero
   * production cost). Proves, from the SAME bounding box compute() fitted and
   * the SAME orbit radii and plane angle the movement reads every frame, that
   * the DRAWN system stays inside the measured scene at EVERY frame of the
   * revolution: for every orbit the worst projected centre (theta = 0 deg on
   * X, 90 deg on Y) plus that orbit's drawn, depth-scaled body radius must fit
   * the scene once the ONE fit scale is applied - and so must the Sun with its
   * full halo. Observes only: positions, radii and speeds are untouched.
   */
  private validateSceneContainment(): void {
    if (!isDevMode()) return;
    const fit = this.geometry.fit;
    const w = this.sceneWidth;
    const h = this.sceneHeightPx;
    if (!(fit > 0) || !(w > 0) || !(h > 0)) return;
    let worstX = 0;
    let worstY = 0;
    for (let i = 0; i < this.geometry.radii.length; i++) {
      const orbit = this.geometry.radii[i] * fit;
      const body = this.visualRadiiPx[i] * V3D_MAX_SCALE * fit;
      worstX = Math.max(worstX, orbit + body);
      worstY = Math.max(worstY, orbit * V3D_ORBIT_PLANE_TILT + body);
    }
    // The Sun adds its own reach (full visual radius AND its halo).
    const sun =
      Math.max(
        this.visualSunRadiusPx,
        this.visualSunRadiusPx * V3D_SUN_HALO_FACTOR,
      ) * fit;
    const reachX = Math.max(worstX, sun);
    const reachY = Math.max(worstY, sun);
    const overX = reachX - w / 2;
    const overY = reachY - h / 2;
    const ok = overX <= 0.5 && overY <= 0.5;
    const line =
      `[values-3d] Contained: box ${this.lastBox.halfW.toFixed(0)}x${this.lastBox.halfH.toFixed(0)} (design px) ` +
      `-> fit ${fit.toFixed(3)} | worst drawn reach ${reachX.toFixed(1)}x${reachY.toFixed(1)}px ` +
      `in scene ${w.toFixed(0)}x${h.toFixed(0)} (half ${(w / 2).toFixed(1)}x${(h / 2).toFixed(1)}) ` +
      `-> ${ok ? 'OK' : 'FAIL'} (overflow ${overX.toFixed(1)}x${overY.toFixed(1)}px)`;
    if (ok) console.info(line);
    else console.warn(line);
  }

  private observeSceneResizes(): void {
    if (typeof ResizeObserver === 'undefined' || !this.scene) return;
    const scene = this.scene;
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        const rect = scene.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        if (width === this.sceneWidth && height === this.sceneHeightPx) return;
        this.sceneWidth = width;
        this.sceneHeightPx = height;
        // Full pipeline on every scene size change: frozen position geometry
        // first, then the content-first visual pass on top of it. Runs on
        // resize ticks only - never inside a frame.
        this.applyVisualSizes();
        this.fitContentToPlanets();
        this.updateOrbitGeometry();      // pass 1: frozen radii (position)
        this.growVisualBodies();         // the DRAWN sizes
        this.updateOrbitGeometry(true);  // pass 2: fit from the DRAWN box
        this.validateOrbitGeometry();
        this.applyAnimation();
      });
      this.resizeObserver.observe(scene);
    });
  }

  /**
   * LANGUAGE RE-FIT: the visible strings come from the translation service, so
   * a FR / EN / AR switch changes every paragraph length. Without this the
   * sizes computed for the previous language would stay on screen and a longer
   * (e.g. Arabic) description could overflow its planet. Re-runs exactly the
   * same size pipeline once, after the new strings are rendered - sizes only,
   * positions untouched.
   */
  private observeLanguageChanges(): void {
    this.zone.runOutsideAngular(() => {
      this.langSubscription = this.translate.onLangChange.subscribe(() => {
        // Wait one frame so the pipe has written the new strings into the DOM
        // before they are measured.
        requestAnimationFrame(() => {
          if (!this.scene) return;
          const rect = this.scene.getBoundingClientRect();
          this.sceneWidth = rect.width;
          this.sceneHeightPx = rect.height;
          this.applyVisualSizes();
          this.fitContentToPlanets();
          this.updateOrbitGeometry();      // pass 1: frozen radii (position)
          this.growVisualBodies();         // the DRAWN sizes
          this.updateOrbitGeometry(true);  // pass 2: fit from the DRAWN box
          this.validateOrbitGeometry();
          this.applyAnimation();
        });
      });
    });
  }

  /** ONE rAF loop: advances every planet continuously until destroyed, runs
      outside the Angular zone and writes only to style props (no CD per frame).
      Each frame: (1) delta time, (2) orbital angles, (3) SELF-rotation angles,
      (4) direct DOM writes. The two angle systems are fully independent.

      Two separate time units are used on purpose:
        delta        = frame-time ratio (≈1 at 60 Hz) - drives ORBITAL movement.
        deltaSeconds = actual elapsed seconds           - drives SELF-rotation
                     so the axial spin is a true °/second speed, identical on
                     60/120/144 Hz screens. This fixes the previous behaviour
                     where the self-rotation was applied per-FRAME (~60x faster
                     than intended) instead of per-SECOND. */
  private startAnimation(): void {
    this.zone.runOutsideAngular(() => {
      const step = (timestamp: number) => {
        const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 16.667 : 1;
        const deltaSeconds = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
        this.lastTimestamp = timestamp;
        for (let i = 0; i < this.angles.length; i++) {
          // Orbital angle: ONE shared cycle duration x the tiny per-planet
          // correction (see orbitSpeed / V3D_ORBIT_CYCLE_MS). The motion
          // equation itself is untouched.
          this.angles[i] += this.orbitSpeed(i) * V3D_DEG * delta;
          this.selfAngles[i] += this.selfRotationSpeed(i) * V3D_DEG * deltaSeconds;
        }
        this.applyAnimation();
        this.animationFrame = requestAnimationFrame(step);
      };
      this.animationFrame = requestAnimationFrame(step);
    });
  }

  private applyAnimation(): void {
    const nodes = this.planets;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el) continue;
      const g = this.calculatePlanetGeometry(i, this.angles[i]);
      el.style.transform = this.composeOrbitTransform(g);
      el.style.zIndex = String(g.zIndex);
      el.style.opacity = String(g.opacity);

      // Self-rotation: the SPHERE rotates; ALL FOUR content faces are its
      // physical children, so they inherit the exact same angle, speed and
      // clock. backface-visibility (CSS) hard-culls each face when it points
      // away, while each face gets its OWN facing factor (`--v3d-face`,
      // 0..1 from its angular distance to the camera): the face closest to
      // the camera stays at ~1 while neighbours crossfade narrowly around
      // the handover midpoint - so one face is always readable, never a
      // whole-planet fade, never all faces invisible.
      const sphere = this.spheres[i];
      if (sphere) {
        sphere.style.transform = this.composeSelfRotationTransform(this.selfAngles[i]);
      }
      const faces = this.faceContents[i];
      if (faces) {
        for (let f = 0; f < faces.length; f++) {
          const faceEl = faces[f];
          if (!faceEl) continue;
          faceEl.style.setProperty(
            '--v3d-face',
            this.faceFactor(this.selfAngles[i] + (f * Math.PI) / 2).toFixed(3),
          );
        }
      }
    }
  }

  /**
   * Per-FACE facing factor (0..1) from the face's angular distance to the
   * camera: 1 while the face squarely faces the camera, smoothly crossfading
   * to 0 past the 45-degree handover midpoint (fully out by 67.5 degrees,
   * well before backface-visibility culls it at 90). Adjacent faces therefore
   * hand over as outgoing-fades/incoming-rises - one face is always readable,
   * never two fully opaque, never all invisible. Never applied to the whole
   * planet, only per face.
   */
  private faceFactor(faceAngle: number): number {
    const twoPi = Math.PI * 2;
    let delta = faceAngle % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    const cosine = Math.cos(delta);
    const cutoff = Math.cos((67.5 * Math.PI) / 180);
    const t = Math.min(1, Math.max(0, (cosine - cutoff) / (1 - cutoff)));
    return t * t * (3 - 2 * t); // smoothstep
  }

  private scheduleAutoplay(ms: number): void {
    this.clearTimer();
    if (this.reduceMotion || this.values.length < 2) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.activeIndex.update((i) => (i + V3D_STEP) % V3D_SLOTS);
      this.scheduleAutoplay(V3D_AUTOPLAY_MS);
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onDestroy(): void {
    this.clearTimer();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
      this.langSubscription = null;
    }
  }
}
