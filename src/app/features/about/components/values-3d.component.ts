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

/* ============================================================
   3D VALUES — MANUAL VISUAL TUNING (TypeScript side)

   The component is split in TWO independent layers:

   1. POSITION (locked) — where a body is on screen:
      orbit angles + speeds (V3D_ORBITS), the classic projected
      orbit (x = cos(angle) * radius, y = sin(angle) * radius * ratio),
      the z-band, the self-rotation and the autoplay. NOTHING in the
      VISUAL SIZE CONTROLS block can move a body: resizing a sphere
      never changes its x, y, angle, orbit radius or orbit centre.
      It always stays centred on exactly the same ring point.

   2. VISUAL SIZE + CONTENT — see the "VISUAL SIZE CONTROLS" block
      below: V3D_SUN_RADIUS (Sun size), V3D_PLANET_RADII (one size per
      planet), V3D_PLANET_CONTENT (per-planet padding / text scale /
      text width) and V3D_BAND_GAP_RATIO (band spacing). The whole
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

   ORBITAL GEOMETRY (single source of truth):
   the radial grid (updateOrbitGeometry) is THE geometry source: at
   init and on every ResizeObserver tick it derives the six radii
   from the MEASURED scene (width AND height) and writes them into
   the CSS custom properties --v3d-orbit-rx-N on .v3d-scene; the CSS
   rings consume exactly those values (with the adaptive
   --v3d-orbit-ratio tilt), so a planet can never drift off its ring
   or out of the component bounds.

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
/** Near/far visual scale range - smooth and deliberately modest. */
const V3D_MIN_SCALE = 0.86;
const V3D_MAX_SCALE = 1.08;
/** Near/far opacity range (far planets stay clearly readable). */
const V3D_MIN_OPACITY = 0.78;
const V3D_MAX_OPACITY = 1;
/** Depth -> z-index band. 200..300 renders BEHIND the sun (z:300),
    300..400 renders IN FRONT of it - planets visibly orbit around it. */
const V3D_Z_BASE = 200;
const V3D_Z_SPAN = 200;
/** Fixed planet accent colors (SIGAT identity: warm gold + cool blues). */
const V3D_COLORS = ['#f59e0b', '#2563eb', '#0ea5e9', '#6366f1', '#1d4ed8', '#0f766e'];

/* ============================================================
   ORBITAL SYSTEM — POSITION MODEL (locked geometry)
   Positions are DERIVED at init/resize from the MEASURED scene
   (never hand-picked, no hard-coded max width):

     R1      = sunRadius
               + 2 * sunRadius * SUN_TO_FIRST_ORBIT_GAP_RATIO
               + planetRadius_1 * V3D_MAX_SCALE      (depth headroom)
     gap_i   = V3D_BAND_GAP_RATIO * (planetRadius_i + planetRadius_i+1) / 2
     R_i+1   = R_i + gap_i                       (per-planet visual sizes)
     ratio   = scene-aspect tilt, clamped to
               V3D_ELLIPSE_RATIO_MIN .. V3D_ELLIPSE_RATIO
     fit     = ONE uniform scale that makes the whole composition fit
               the measured scene on BOTH axes

   The radii above are the VISUAL radii of the VISUAL SIZE CONTROLS
   block (plus the content-driven growth), which is exactly why a
   size change can never produce a stray orbit: the ring and the
   trajectory are always computed from the same numbers, so a planet
   is always exactly on its ring. Movement is the CLASSIC orbital
   projection (unchanged):
     x = cos(angle) * R
     y = sin(angle) * R * ratio
   ============================================================ */

/** SUN -> FIRST ORBIT gap as a fraction of the Sun's logical diameter.
    Controls ONLY the Sun -> Planet 1 distance. */
const V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO = 0.28;

// =====================================================
// VISUAL SIZE CONTROLS
// These values change VISUAL SIZE only.
// They NEVER change a planet's position: not its x / y, not its
// orbit radius, not its orbit centre, not its orbital angle.
// A sphere can be resized freely - it always stays centred on
// exactly the same point of exactly the same orbit ring.
// =====================================================

/** =============================================================
     POSITION BASELINE — LOCKED. DO NOT EDIT.
     These values (and only these) drive the orbit rings, the
     planet centres, the tilt and the fit scale. They reproduce the
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
// exactly the same point of exactly the same ring.
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
// MANUAL ORBIT SPACING - distance between consecutive planets
// (1 -> 2 -> 3 -> 4 -> 5 -> 6). Sun -> Planet 1 is NOT controlled
// by this value (see V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO above).
// The band spacing is proportional to the planet radii, so the
// composition keeps the same rhythm however big the planets get.
// 2.0 = neighbours never overlap (smaller planets); 1.15 = a mild
// overlap only while two planets cross; 1.0 = biggest planets.
// ============================================================
const V3D_BAND_GAP_RATIO = 1.05;

/** Breathing room (logical px) between the outermost orbit and the edge
    of the logical design space. */
const V3D_STAGE_PADDING = 24;
/** THE orbit tilt: one shared ellipse ratio for the classic projection
    (same visual model as the original component). */
const V3D_ELLIPSE_RATIO = 0.5;
/** Lower bound of the ellipse tilt on short (wide) scenes. A flatter tilt
    uses less height and more width - exactly what a wide laptop scene needs
    to show the composition as large as possible. Raise it (e.g. 0.32) if you
    prefer rounder rings on short scenes (the composition then renders
    smaller, because the scene height starts to limit it). */
const V3D_ELLIPSE_RATIO_MIN = 0.2;

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
/** Description px = title px x this ratio. */
const V3D_DESC_PER_TITLE = 0.78;
/** Icon px = title px x this ratio. */
const V3D_ICON_PER_TITLE = 1.7;
/** The Sun carries the active value, so its text is bigger than any
    planet's: sun title px = Sun visual diameter x this ratio. */
const V3D_SUN_TITLE_PER_DIAMETER = 1 / 13;
/** The Sun must stay at least this factor bigger than the largest
    planet (visual sizes). */
const V3D_SUN_DOMINANCE = 1.25;

// Internal to the POSITION layer (baseline geometry): the ratio model the
// frozen orbit computation was calibrated with. Do not edit - it keeps the
// approved ring/centre positions byte-identical.
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
 * Content visibility model - each planet carries TWO content faces (front
 * + back, identical translated content), so exactly one of them is readable
 * at any time. Each face has its own facing factor (0..1) written by the
 * rAF loop into `--v3d-front`: the front face uses cos(angle), the back
 * face -cos(angle). The CSS derives opacity + depth scale from it, and
 * backface-visibility hides the face whose surface points away from the
 * camera, so the two faces can never be readable at the same time: no
 * duplicated text, no mirroring, no popping - and the content stays
 * readable for about two thirds of every revolution instead of one third.
 * V3D_CONTENT_FADE_START keeps a face FULLY opaque until it is this far
 * off-axis (1 = only when perfectly facing the camera, 0 = fades from the
 * very first degree). The faint floor (V3D_CONTENT_MIN_OPACITY) and the
 * slight shrink (V3D_CONTENT_MIN_SCALE) keep the cycle continuous.
 */
const V3D_CONTENT_MIN_OPACITY = 0.06;
const V3D_CONTENT_MIN_SCALE = 0.86;
const V3D_CONTENT_FADE_START = 0.35;

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
 *   POSITIONS second: updateOrbitGeometry() turns those radii into the six
 *   orbit radii + the uniform fit scale and writes them into the CSS custom
 *   properties that draw the rings. The planet position is the CLASSIC
 *   projected orbit (unchanged):
 *     x = cos(angle) * radius
 *     y = sin(angle) * radius * ellipseRatio
 *   The ring is drawn from the SAME radius + ratio, therefore a planet is
 *   always exactly on its ring, whatever its visual size. Overlap while two
 *   planets cross is tuned by the single V3D_BAND_GAP_RATIO value - there is
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
 * every orbit radius) in sync with the responsive CSS rings.
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
        /* Navbar height + header block + bottom gap (all responsive below). */
        --v3d-header-offset: 6rem;
        --v3d-header-block: 7.5rem;
        --v3d-bottom-gap: 4rem;
        /* Edge safety: small responsive margin so the outermost orbit/planet
           never touches the browser edge on the FULL-WIDTH orbital stage.
           Tune this single variable to adjust the horizontal breathing room.
           Kept deliberately small (1.5vw) so the radial grid receives the
           maximum real width to distribute across the six orbits. */
        --v3d-edge-padding: clamp(0.6rem, 1.5vw, 1.5rem);
        /* Body sizes. The orbital system is authored in ONE design space and
           uniformly scaled to fit the real scene (.v3d-stage / --v3d-fit).
           The TS engine writes the real values at init/resize: --v3d-sun on
           .v3d-scene and --v3d-pd (that planet's diameter) + the text sizes
           on each planet, from the VISUAL SIZE CONTROLS block. The values
           below are the pre-JS fallbacks for the very first paint. */
        --v3d-sun: 240px;
        --v3d-pd: 140px;
        /* Per-orbit radii (single source of truth = radial grid in TS):
           at init/resize the component writes --v3d-orbit-rx-N in px onto
           .v3d-scene; the cqw values below are equivalent desktop-grid
           fallbacks so the rings render correctly before JS runs. All six
           rings share ONE tilt (--v3d-orbit-ratio = V3D_ELLIPSE_RATIO) -
           the classic projected-orbit look. */
        --v3d-orbit-ratio: 0.5;
        --v3d-orbit-rx-1: 15cqw;
        --v3d-orbit-rx-2: 19cqw;
        --v3d-orbit-rx-3: 24cqw;
        --v3d-orbit-rx-4: 30.5cqw;
        --v3d-orbit-rx-5: 37.5cqw;
        --v3d-orbit-rx-6: 43.5cqw;
        /* Content depth (translateZ fraction of the body diameter), cap-relative
           scale, and convex "bowed" curvature (rotateX) - subtle to stay readable.
           --v3d-content-scale = 1 keeps the printed text exactly at the size the
           engine computed for the planet (it is NOT used to shrink text). */
        --v3d-content-z: 0.35;
        --v3d-content-scale: 1;
        --v3d-content-curve: 6deg;
        position: relative;
        background: linear-gradient(180deg, #ffffff 0%, #f4f7fc 100%);
        overflow: hidden;
        width: 100%;
        /* Header + component fill exactly one viewport (dvh with vh fallback). */
        min-height: calc(100vh - var(--v3d-header-offset));
        min-height: calc(100dvh - var(--v3d-header-offset));
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-inline: 1.25rem;
        padding-block: 1rem 1.5rem;
        margin-bottom: var(--v3d-bottom-gap);
      }
      @media (max-width: 767px) {
        .v3d-section { --v3d-header-offset: 5rem; }
      }
      .v3d-header { width: 100%; }

      /* Scene - the MEASURED coordinate system. Everything inside it lives
         on .v3d-stage, which is authored in a fixed LOGICAL design space
         (large Sun, large planets, generous manual orbit gaps) and then
         uniformly scaled with --v3d-fit so the full composition always
         fits the real scene: the manual gap is never clamped, no planet
         is ever clipped, and guides + planets share one coordinate space.

         DEBUG LAYOUT (disabled): uncomment to verify the coordinate space.
         .v3d-scene { outline: 1px dashed red; }
         .v3d-stage { outline: 1px dashed blue; } */
      .v3d-scene {
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        /* Defaults before the TS geometry engine runs; at init/resize the
           engine overrides these with logical design values: the six orbit
           radii (--v3d-orbit-rx-N), the tilt (--v3d-orbit-ratio) and the
           fit scale (--v3d-fit). */
        --v3d-fit: 1;
        container-type: inline-size;
        position: relative;
        margin-inline: auto;
        width: calc(100% - (2 * var(--v3d-edge-padding)));
        max-width: none;
        flex: 1 1 auto;
        min-height: 0;
      }
      /* The design-space surface: all orbital elements (guides, sun,
         planets, dots) are children of this ONE element and are scaled
         TOGETHER - perfect orbit/planet synchronization by construction. */
      .v3d-stage {
        position: absolute;
        inset: 0;
        transform: scale(var(--v3d-fit));
        transform-origin: 50% 50%;
      }

      /* Orbit rings - the classic projected orbit: width = 2R, height =
         2R * ratio, all six sharing ONE tilt. The radii come from the same
         variables the JS trajectory uses (written by the radial grid), so
         ring and path can never disagree. */
      /* Orbit guide layer - SAME coordinate space as the planets: it covers
         the entire full-width stage (inset: 0 + explicit 100% x 100%) and
         the six guides are drawn from the radial-grid variables. */
      .v3d-orbits {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .v3d-orbit {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border: 1px solid rgba(30, 58, 138, 0.16);
        border-radius: 50%;
        pointer-events: none;
      }
      .v3d-orbit:nth-of-type(2n) { border-style: dashed; }
      .v3d-orbit.o1 {
        width: calc(var(--v3d-orbit-rx-1) * 2);
        height: calc(var(--v3d-orbit-rx-1) * 2 * var(--v3d-orbit-ratio));
      }
      .v3d-orbit.o2 {
        width: calc(var(--v3d-orbit-rx-2) * 2);
        height: calc(var(--v3d-orbit-rx-2) * 2 * var(--v3d-orbit-ratio));
      }
      .v3d-orbit.o3 {
        width: calc(var(--v3d-orbit-rx-3) * 2);
        height: calc(var(--v3d-orbit-rx-3) * 2 * var(--v3d-orbit-ratio));
      }
      .v3d-orbit.o4 {
        width: calc(var(--v3d-orbit-rx-4) * 2);
        height: calc(var(--v3d-orbit-rx-4) * 2 * var(--v3d-orbit-ratio));
      }
      .v3d-orbit.o5 {
        width: calc(var(--v3d-orbit-rx-5) * 2);
        height: calc(var(--v3d-orbit-rx-5) * 2 * var(--v3d-orbit-ratio));
      }
      .v3d-orbit.o6 {
        width: calc(var(--v3d-orbit-rx-6) * 2);
        height: calc(var(--v3d-orbit-rx-6) * 2 * var(--v3d-orbit-ratio));
      }

      /* Planets - LAYER 1 (orbit wrapper + sphere BODY). Centered at 50/50
         like the rings; the rAF loop writes ONLY this element's transform +
         zIndex + opacity. No CSS transition touches transform here. The
         sphere BODY visuals live on this static element: a real sphere's
         silhouette never changes while it spins, and its shading comes from
         a fixed light (the camera), so the gradient must NOT rotate. */
      .v3d-planet {
        --v3d-pc: #0ea5e9;
        position: absolute;
        left: 50%;
        top: 50%;
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

         TWO-SIDED CONTENT: every planet has TWO of these caps (.front and
         .back), both inside the rotating sphere, both carrying the very same
         translated icon/title/description (the template renders the same
         bound value twice - no duplicated data, no new translation keys).
         Each cap is hidden by backface-visibility as soon as its surface
         points away from the camera, so exactly ONE cap is readable at any
         moment: no duplicated text, no mirrored text, no popping. Because a
         cap at 180deg of sphere rotation is geometrically identical to a cap
         at 0deg (R(180)*R(180) = identity), the face that takes over is
         exactly as close to the camera and exactly as large as the first -
         the content therefore stays readable for about two thirds of every
         revolution instead of one third.
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
      .v3d-planet-surface.back {
        transform: rotateY(180deg);
      }
      /* In reduced motion the sphere never rotates, so only the front cap is
         ever presented; the back cap is removed outright (deterministic - it
         does not rely on backface culling). */
      @media (prefers-reduced-motion: reduce) {
        .v3d-planet-surface.back { display: none; }
      }

      /* LAYER 4 (content): printed on the cap; inherits sphere spin; the
         --v3d-front factor fades/shrinks the whole icon+title+desc as one
         surface group front->back; convex radial mask + circular clip.
         The larger diameter is used for a comfortable internal area so the
         icon / wrapping title / full wrapping description sit well inside
         the disc and never touch the spherical edge. Content stays centered
         (justify-content: center) so a long description does not push the
         icon+title toward the top. overflow:hidden only serves the circular
         clip - it is never used to hide text (no ellipsis / clamp). */
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
        --v3d-front: 1;
        opacity: calc(0.06 + 0.94 * var(--v3d-front));
        transform:
          translateZ(calc(var(--v3d-pd, 140px) * var(--v3d-content-z)))
          rotateX(var(--v3d-content-curve))
          scale(calc(var(--v3d-content-scale) * (0.86 + 0.14 * var(--v3d-front))));
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
        left: 50%;
        top: 50%;
        width: var(--v3d-sun);
        height: var(--v3d-sun);
        /* Between the far (200) and near (400) planet z-band so planets
           genuinely pass behind AND in front of the sun. */
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
        left: 50%;
        top: 50%;
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
      @media (max-width: 900px) {
        .v3d-section {
          --v3d-header-block: 7rem;
        }
      }
      @media (max-width: 560px) {
        .v3d-section {
          --v3d-header-block: 6.5rem;
          --v3d-bottom-gap: 3rem;
        }
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
        .v3d-planet-content { opacity: 1 !important; --v3d-front: 1 !important; }
        .v3d-planet.active { filter: none; }
        .v3d-planet.active::after { box-shadow: none; }
      }
    `,
  ],
  template: `
    <section class="v3d-section">
      <div class="v3d-header py-4 sm:py-6">
        <app-section-header
          [title]="'values_title' | translate"
          [subtitle]="'values_subtitle' | translate"
        />
      </div>

      <div class="v3d-scene">
        <!-- The whole orbital system lives on ONE design-space surface that
             is uniformly scaled to fit the real scene (--v3d-fit): Sun,
             guides and planets share a single coordinate system, so every
             orbit guide passes exactly through its planet's path. -->
        <div class="v3d-stage">
        <!-- Orbital guide rings (projected tilted XZ circles) - behind everything. -->
        <div class="v3d-orbits" aria-hidden="true">
          <div class="v3d-orbit o1"></div>
          <div class="v3d-orbit o2"></div>
          <div class="v3d-orbit o3"></div>
          <div class="v3d-orbit o4"></div>
          <div class="v3d-orbit o5"></div>
          <div class="v3d-orbit o6"></div>
        </div>

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
                <!-- Front cap: the readable face for 0..180deg of the spin. -->
                <span class="v3d-planet-surface front">
                  <span class="v3d-planet-content">
                    <i [class]="value.icon" aria-hidden="true"></i>
                    <span class="v3d-planet-title">{{ value.titleKey | translate }}</span>
                    <span class="v3d-planet-desc">{{ value.descriptionKey | translate }}</span>
                  </span>
                </span>
                <!-- Back cap: the SAME bound value (same keys, same data -
                     no duplicate translations), on the opposite side of the
                     sphere. aria-hidden because it is a visual duplicate:
                     screen readers must announce every value only once. -->
                <span class="v3d-planet-surface back" aria-hidden="true">
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
  /** Scene height in px (vertical containment of the outer ellipse). */
  private sceneHeightPx = 0;
  /**
   * Live per-orbit geometry in px, recomputed at init + on every
   * ResizeObserver tick from V3D_ORBITS and the measured scene/sun/planet
   * sizes. THE single source of truth: the same numbers are written to the
   * CSS custom properties that draw the orbit rings, so the rings and the
   * planet trajectory can never disagree.
   */
  private readonly orbitRx = new Float64Array(V3D_SLOTS);
  private readonly orbitRy = new Float64Array(V3D_SLOTS);
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
  /** Live ellipse ratio (balances the design with the scene's aspect). */
  private ellipseRatio = V3D_ELLIPSE_RATIO;
  /** Current uniform fit scale (design space -> real scene). */
  private currentFit = 1;

  private scene: HTMLElement | null = null;
  private planets: HTMLElement[] = [];
  /** Cached self-rotation layers (one per planet) - written by the rAF loop. */
  private spheres: HTMLElement[] = [];
  /**
   * Cached FRONT content layers (one per planet): the face that is readable
   * for 0..180deg of the self-rotation. Measured and written per frame.
   */
  private contents: HTMLElement[] = [];
  /**
   * Cached BACK content layers (one per planet): the identical duplicate on
   * the opposite side of the sphere, readable for 180..360deg. Only the
   * facing factor is written per frame - never measured twice.
   */
  private backContents: HTMLElement[] = [];
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
   * Half extent (design px) of the composition with the CURRENT radii:
   * the outermost ring + the body that rides it. Used to normalize the
   * manual radii against the measured scene width.
   */
  private designHalfExtent(): number {
    let radius = this.firstOrbitRadius();
    for (let i = 0; i < V3D_SLOTS - 1; i++) {
      radius += this.bandGap(i);
    }
    return radius + this.planetRadiiPx[V3D_SLOTS - 1] * V3D_MAX_SCALE;
  }

  /**
   * Scales Sun + planets TOGETHER until the composition's half extent
   * exactly fills the measured scene width. State-less: it always works
   * from the current radii, so it can never drift between two passes.
   */
  private normalizeToSceneWidth(): void {
    if (this.sceneWidth <= 0) return;
    const available = this.sceneWidth / 2 - V3D_STAGE_PADDING;
    const extent = this.designHalfExtent();
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
    const available = this.sceneWidth / 2 - V3D_STAGE_PADDING;
    const extent = this.designHalfExtent();
    if (!(extent > available)) return;
    const sunFactor = 1 + 2 * V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO;
    const planetsExtent = extent - this.sunRadiusPx * sunFactor;
    if (planetsExtent >= available) return; // planets alone fill the scene
    const wantedSun = (available - planetsExtent) / sunFactor;
    // The Sun must stay clearly the largest body in the system.
    const maxPlanetR = Math.max(...Array.from(this.planetRadiiPx));
    this.sunRadiusPx = Math.max(wantedSun, maxPlanetR * 1.25);
  }

  /** Content-first type scale of the Sun (title px from its VISUAL
      diameter, bounded so it never dwarfs the planets' text). */
  private applySunContentScale(): void {
    const maxTitle =
      V3D_CONTENT_TITLE_PX[this.category % V3D_CONTENT_TITLE_PX.length] * 1.2;
    this.sunTitlePx = Math.min(
      this.visualSunRadiusPx * 2 * V3D_SUN_TITLE_PER_DIAMETER,
      maxTitle,
    );
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

        // 2. Sun size: the manual wish, capped by orbit-1 clearance so the Sun can
    //    never swallow planet 1's path (position is frozen). The cap is depth-
    //    scaled so the Sun stays the largest body at the worst orbital angle.
    const planetCap = this.orbitCapRadius();
    const sunWishCap = V3D_SUN_DOMINANCE * V3D_MAX_SCALE * planetCap;
    this.visualSunRadiusPx = Math.max(
      this.sunRadiusPx,
      Math.min(
        (V3D_SUN_RADIUS / V3D_POSITION_BASELINE_SUN_RADIUS) * this.sunRadiusPx,
        sunWishCap,
      ),
    );
    this.applySunContentScale();

    // 3. Planets: content-first, bounded by the edge and the Sun dominance.
    for (let pass = 0; pass < V3D_CONTENT_FIT_PASSES; pass++) {
      this.writeBodySizes();
      let changed = false;
      for (let i = 0; i < V3D_SLOTS; i++) {
        const baseline = this.planetRadiiPx[i];
        const need = this.requiredRadius(i);
        const min = Math.max(baseline, this.manualVisualMinRadius(i));
        const cap = Math.max(baseline, Math.min(this.edgeCapRadius(i), planetCap));
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
      const baseline = this.planetRadiiPx[i];
      const cap = Math.max(baseline, Math.min(this.edgeCapRadius(i), planetCap));
      this.visualRadiiPx[i] = Math.min(this.visualRadiiPx[i], cap);
    }

    // 4. A planet at its cap whose content still needs more room gets its
    //    text scaled by the exact shortfall - content is never clipped. The
    //    shrink is re-measured (bounded passes), because the icon, the
    //    wrapping and the fixed gaps do not follow the text proportionally.
    for (let i = 0; i < V3D_SLOTS; i++) {
      for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
        const need = this.requiredRadius(i);
        if (!(need > this.visualRadiiPx[i] + 0.5)) break;
        if (!(need > 0)) break;
        this.contentTitlePx[i] *= this.visualRadiiPx[i] / need;
        this.writeBodySizes();
      }
      const remaining = this.requiredRadius(i);
      if (remaining > this.visualRadiiPx[i] + 0.5 && isDevMode()) {
        console.warn(
          `[values-3d] Planet ${i + 1}: content still needs Ø${(remaining * 2).toFixed(0)}px, capped at Ø${(this.visualRadiiPx[i] * 2).toFixed(0)}px (scene edge / orbit clearance).`,
        );
      }
    }

    // 5. The Sun must stay the largest body: enforce the dominance floor on the
    //    FINAL planet sizes, depth-scaled so the Sun wins at the worst angle,
    //    then keep the Sun's own text inside its disc (shrink, never move).
    const largestPlanet = Math.max(...Array.from(this.visualRadiiPx));
    this.visualSunRadiusPx = Math.max(
      this.visualSunRadiusPx,
      V3D_SUN_DOMINANCE * V3D_MAX_SCALE * largestPlanet,
    );
    this.applySunContentScale();
    this.writeBodySizes();
    for (let pass = 0; pass < V3D_TEXT_FIT_PASSES; pass++) {
      const need = this.requiredSunRadius();
      if (!(need > this.visualSunRadiusPx + 0.5)) break;
      if (!(need > 0)) break;
      this.sunTitlePx *= this.visualSunRadiusPx / need;
      this.writeBodySizes();
    }
    if (isDevMode() && this.requiredSunRadius() > this.visualSunRadiusPx + 0.5) {
      console.warn('[values-3d] Sun content still does not fit its disc - reduce V3D_SUN_TITLE_PER_DIAMETER.');
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
   * Largest a planet may grow at its FROZEN orbit position without ever
   * being clipped by the scene edge (checked at the worst orbital angle,
   * including the depth scale). Size only - the planet is never moved.
   */
  private edgeCapRadius(i: number): number {
    const rx = this.orbitRx[i];
    const halfW = this.sceneWidth / 2 - rx;
    const halfH =
      (this.sceneHeightPx > 0 ? this.sceneHeightPx / 2 : this.sceneWidth * 0.31) -
      rx * this.ellipseRatio;
    const room = Math.max(0, Math.min(halfW, halfH));
    return room / V3D_MAX_SCALE - 4;
  }

  /**
   * Largest ANY planet may grow while keeping BOTH hard invariants true at
   * the worst orbital angle (i.e. including the depth scale the rAF applies):
   *   - the Sun stays the largest body: sun >= dominance x planet x depth,
   *   - planet 1 stays clear of the Sun's edge: sun x (1 + 2 x gap) <= R1.
   * Combining the two gives R <= R1 / (dominance x depth x (1 + 2 x gap)),
   * derived from the frozen first orbit. Size gives way, the position never.
   */
  private orbitCapRadius(): number {
    const sunFootprint =
      V3D_SUN_DOMINANCE * V3D_MAX_SCALE * (1 + 2 * V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO);
    return Math.max(0, (this.orbitRx[0] - 4) / sunFootprint);
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
   * ORBITAL GEOMETRY ENGINE - init + resize ONLY (never per frame).
   * POSITION ONLY: it turns the visual radii into the six orbit radii and
   * the uniform fit scale. It never changes a size:
   *   R1     = sunRadius + 2*sunRadius*SUN_TO_FIRST_ORBIT_GAP_RATIO
   *            + planetRadius_1 * V3D_MAX_SCALE       (depth headroom)
   *   gap_i  = V3D_BAND_GAP_RATIO * (R_i + R_i+1) / 2
   *   R_i+1  = R_i + gap_i
   * The radii come from ONE source (planetRadiiPx, already grown by the
   * content fit), the rings are drawn from these very values, and the whole
   * design space is uniformly scaled with --v3d-fit - so guides, Sun and
   * planets always share exactly one coordinate system.
   */
  private updateOrbitGeometry(): void {
    const w = this.sceneWidth;
    const h = this.sceneHeightPx;
    if (w <= 0) return;

    // Sizes are already resolved (applyVisualSizes + fitContentToPlanets):
    // here they are only turned into positions, so a size change can never
    // move a body - it only redraws the ring it travels on.
    let radius = this.firstOrbitRadius();
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.orbitRx[i] = radius;
      if (i < V3D_SLOTS - 1) {
        radius += this.bandGap(i);
      }
    }
    const outerR = this.orbitRx[V3D_SLOTS - 1];

    // Ellipse ratio: balance the design's height with the scene's aspect
    // (bounded), so the fit scale stays as large as possible.
    const outerBody = this.planetRadiiPx[V3D_SLOTS - 1] * V3D_MAX_SCALE;
    // Vertical budget: the ring's vertical extent + the body on the outer
    // band + the stage padding must fit the scene height, so the ratio uses
    // the available height instead of overflowing it.
    const halfHScene = (h > 0 ? h / 2 : w * 0.31) - V3D_STAGE_PADDING - outerBody;
    const targetRatio = halfHScene / outerR;
    this.ellipseRatio = Math.min(
      V3D_ELLIPSE_RATIO,
      Math.max(V3D_ELLIPSE_RATIO_MIN, targetRatio),
    );
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.orbitRy[i] = this.orbitRx[i] * this.ellipseRatio;
    }

    // Uniform fit scale: the full design is scaled to fit the real scene on
    // BOTH axes (width usually binds, the height takes over on short scenes).
    const halfW = outerR + outerBody + V3D_STAGE_PADDING;
    const halfH = outerR * this.ellipseRatio + outerBody + V3D_STAGE_PADDING;
    const fit = Math.min(
      w / (2 * halfW),
      (h > 0 ? h : 2 * halfH) / (2 * halfH),
    );
    this.currentFit = fit;
    this.writeOrbitCssVariables(fit);
  }

  /** Band spacing between planet i and planet i+1: proportional to the two
      radii it separates, so bigger planets automatically get more room
      without ever changing the rhythm of the composition. */
  private bandGap(i: number): number {
    return (V3D_BAND_GAP_RATIO * (this.planetRadiiPx[i] + this.planetRadiiPx[i + 1])) / 2;
  }

  /** Screen category from the MEASURED scene width: 0 mobile, 1 tablet,
      2 PC/laptop, 3 large desktop. */
  private selectCategory(sceneWidth: number): number {
    if (sceneWidth <= 560) return 0;
    if (sceneWidth <= 900) return 1;
    if (sceneWidth <= 1919) return 2;
    return 3;
  }

  /** First-orbit radius: Sun EDGE + gap + PLANET 1 EDGE headroom. */
  private firstOrbitRadius(): number {
    if (this.sunRadiusPx <= 0) return 0.2 * this.sceneWidth;
    return (
      this.sunRadiusPx +
      this.sunRadiusPx * 2 * V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO +
      this.planetRadiiPx[0] * V3D_MAX_SCALE
    );
  }

  /** Writes the orbit radii + the tilt + the uniform fit scale into the CSS
      custom properties consumed by the guides and the stage. Init + resize
      ONLY. Body sizes are written by writeBodySizes(). */
  private writeOrbitCssVariables(fit: number): void {
    if (!this.scene) return;
    const style = this.scene.style;
    for (let i = 0; i < V3D_SLOTS; i++) {
      style.setProperty(`--v3d-orbit-rx-${i + 1}`, `${this.orbitRx[i].toFixed(2)}px`);
    }
    style.setProperty('--v3d-orbit-ratio', this.ellipseRatio.toFixed(3));
    style.setProperty('--v3d-fit', fit.toFixed(4));
  }

  /**
   * CLASSIC orbital projection (same model as the original component):
   *   x = cos(angle) * radius
   *   y = sin(angle) * radius * ellipseRatio
   * The ring is drawn from the EXACT same radius + ratio (see
   * writeOrbitCssVariables), so the planet can never drift off its ring.
   */
  private calculatePlanetGeometry(index: number, angle: number): PlanetGeometry {
    const radius = this.orbitRx[index];
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * this.ellipseRatio;
    const depth = (Math.sin(angle) + 1) / 2; // 0 far (back) -> 1 near (front)
    const scale = V3D_MIN_SCALE + depth * (V3D_MAX_SCALE - V3D_MIN_SCALE);
    const opacity = V3D_MIN_OPACITY + depth * (V3D_MAX_OPACITY - V3D_MIN_OPACITY);
    // Far half renders behind the sun (z 200..300), near half in front (300..400).
    const zIndex = Math.round(V3D_Z_BASE + depth * V3D_Z_SPAN);
    return { x, y, depth, scale, opacity, zIndex };
  }

  /** A. ORBITAL POSITION transform (unchanged math - never mixes with the
      self-rotation angle). Position + depth scale only. */
  private composeOrbitTransform(g: PlanetGeometry): string {
    return `translate3d(${g.x.toFixed(2)}px, ${g.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${g.scale.toFixed(4)})`;
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
   * Scoped to the FRONT caps: the back cap carries the identical string, so
   * measuring it twice would be pure waste. Sizes only - nothing here can
   * move a body.
   */
  private readContentText(host: HTMLElement): void {
    const titles = host.querySelectorAll<HTMLElement>('.v3d-planet-surface.front .v3d-planet-title');
    const descs = host.querySelectorAll<HTMLElement>('.v3d-planet-surface.front .v3d-planet-desc');
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
    this.sceneWidth = this.scene ? this.scene.clientWidth : 0;
    this.sceneHeightPx = this.scene ? this.scene.clientHeight : 0;

    this.planets = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet'));
    this.spheres = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-sphere'));
    // The two content caps are cached separately: the FRONT cap is the one
    // that is measured and sized, the BACK cap only receives its facing
    // factor per frame.
    this.contents = Array.from(
      host.querySelectorAll<HTMLElement>('.v3d-planet-surface.front > .v3d-planet-content'),
    );
    this.backContents = Array.from(
      host.querySelectorAll<HTMLElement>('.v3d-planet-surface.back > .v3d-planet-content'),
    );

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

    // POSITION FIRST (frozen baseline: rings, centres, tilt, fit scale),
    // THEN the content-first visual pass on top of those fixed positions.
    this.applyVisualSizes();
    this.fitContentToPlanets();
    this.updateOrbitGeometry();
    this.growVisualBodies();
    this.validateOrbitGeometry();
    this.applyAnimation();
  }

  /**
   * DEV-TIME VALIDATION - init/resize ONLY, never per frame. Containment is
   * guaranteed by the uniform fit scale, so this is diagnostics + warnings:
   *   1. full table: rendered sizes, content fit, rings, overlap, fit scale
   *   2. the Sun must stay clearly bigger than every planet (>= 1.25x)
   *   3. a planet must never be smaller than its own content needs
   *   4. the first orbit must match the Sun -> Planet 1 formula
   */
  private validateOrbitGeometry(): void {
    if (this.sceneWidth <= 0 || !isDevMode()) return;
    const fit = this.currentFit;
    const rendered = (r: number) => (r * 2 * fit).toFixed(0);
    const maxPlanetR = Math.max(...Array.from(this.visualRadiiPx));

    console.info(
      `[values-3d] Sizes: scene ${this.sceneWidth.toFixed(0)}x${this.sceneHeightPx.toFixed(0)}px, fit ${fit.toFixed(2)}, tilt ${this.ellipseRatio.toFixed(2)}, orbits ${Array.from(this.orbitRx, (r) => (r * fit).toFixed(0)).join('/')}px (position layer - locked), sun Ø${rendered(this.visualSunRadiusPx)}px (text ${(this.sunTitlePx * fit).toFixed(1)}px), planets Ø${Array.from(this.visualRadiiPx, (r) => rendered(r)).join('/')}px, titles ${Array.from(this.contentTitlePx, (t) => (t * fit).toFixed(1)).join('/')}px`,
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
        const overlap =
          (this.visualRadiiPx[i] + this.visualRadiiPx[i + 1] - this.bandGap(i)) * fit;
        if (overlap > 0) {
          console.info(
            `[values-3d] Planets ${i + 1}-${i + 2} may overlap by ${overlap.toFixed(0)}px while crossing (V3D_BAND_GAP_RATIO ${V3D_BAND_GAP_RATIO}).`,
          );
        }
      }
    }

    // 3. First orbit matches the Sun -> Planet 1 design formula.
    const expectedR1 = this.firstOrbitRadius();
    if (Math.abs(this.orbitRx[0] - expectedR1) > 0.5) {
      console.warn('[values-3d] First orbit does not match the Sun -> Planet 1 design.');
    }
  }

  /**
   * THE responsive fix: stale geometry after ANY scene size change. The
   * observer keeps the JS radii in sync with the CSS rings at ALL times,
   * without Angular CD. It reacts to WIDTH and HEIGHT changes (browser
   * resize, orientation change, breakpoint change, one-viewport section
   * growth) - not width only.
   */
  private observeSceneResizes(): void {
    if (typeof ResizeObserver === 'undefined' || !this.scene) return;
    const scene = this.scene;
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        const width = scene.clientWidth;
        const height = scene.clientHeight;
        if (width === this.sceneWidth && height === this.sceneHeightPx) return;
        this.sceneWidth = width;
        this.sceneHeightPx = height;
        // Full pipeline on every scene size change: frozen position geometry
        // first, then the content-first visual pass on top of it. Runs on
        // resize ticks only - never inside a frame.
        this.applyVisualSizes();
        this.fitContentToPlanets();
        this.updateOrbitGeometry();
        this.growVisualBodies();
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
          this.sceneWidth = this.scene.clientWidth;
          this.sceneHeightPx = this.scene.clientHeight;
          this.applyVisualSizes();
          this.fitContentToPlanets();
          this.updateOrbitGeometry();
          this.growVisualBodies();
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

      // Self-rotation: the SPHERE rotates; BOTH content caps are its physical
      // children, so they inherit the exact same angle, speed and clock. Each
      // cap gets its OWN facing factor (0..1) written into --v3d-front, from
      // which the CSS derives the opacity + depth scale: the front cap uses
      // cos(angle), the back cap -cos(angle). Between them there is therefore
      // ALWAYS a readable face: as one approaches the edge-on orientation the
      // other one comes round, so the content never disappears for a long
      // period. backface-visibility (CSS) hides the cap that points away, so
      // both can never be readable at the same time - no duplicated text.
      // Fade curve: FULLY opaque until the cap is V3D_CONTENT_FADE_START off
      // axis (so heavily foreshortened text is never shown half-transparent),
      // then a smooth ramp to the faint floor exactly at the edge-on moment.
      const sphere = this.spheres[i];
      if (sphere) {
        sphere.style.transform = this.composeSelfRotationTransform(this.selfAngles[i]);
      }
      const facing = Math.cos(this.selfAngles[i]);
      const front = this.contents[i];
      if (front) {
        front.style.setProperty('--v3d-front', this.faceFactor(facing).toFixed(3));
      }
      const back = this.backContents[i];
      if (back) {
        back.style.setProperty('--v3d-front', this.faceFactor(-facing).toFixed(3));
      }
    }
  }

  /**
   * Facing factor (0..1) of ONE content cap: 1 while the cap is comfortably
   * facing the camera (cos >= V3D_CONTENT_FADE_START), then a smoothstep down
   * to 0 exactly at the edge-on orientation. Both caps use it with opposite
   * signs, so the hand-over happens in the (zero-width) edge-on instant.
   */
  private faceFactor(cosine: number): number {
    const start = Math.min(0.99, Math.max(0, V3D_CONTENT_FADE_START));
    const t = Math.min(1, Math.max(0, (cosine - start) / (1 - start)));
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
