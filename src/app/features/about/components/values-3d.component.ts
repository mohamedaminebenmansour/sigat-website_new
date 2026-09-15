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
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';
import { COMPANY_VALUES } from './values.data';

/* ============================================================
   3D VALUES — MANUAL VISUAL TUNING (TypeScript side)
   Change these values to tune the composition.

   ORBITAL GEOMETRY (single source of truth):
   The radial grid (updateOrbitGeometry) is THE geometry source. At init
   and on every ResizeObserver tick it derives the six radii from the
   MEASURED scene (width AND height) inside a SAFE usable rectangle
   (responsive edge margin) and writes them into the CSS custom properties
   --v3d-orbit-rx-N on .v3d-scene; the CSS rings consume exactly those
   values (with the adaptive --v3d-orbit-ratio tilt), so a planet can never
   drift off its ring or out of the component bounds. The CSS defaults in .v3d-scene mirror these
   numbers (fallback before JS runs).

   3D CONTENT (sphere "printed text") controls:
   - PLANET_SELF_ROTATION_DEG_PER_SEC  axial spin (deg/s) ~40-70s per revolution
   - V3D_CONTENT_MIN_OPACITY  how faint the back-facing content gets (0.06)
   - V3D_CONTENT_MIN_SCALE    how much the back-facing content shrinks (0.86)
   Corresponding CSS variables live in the .v3d-section styles:
   --v3d-content-curve     convex bow of the spherical content (6deg)
   --v3d-content-z         surface offset depth (fraction of planet size)
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
   ORBITAL SYSTEM — CENTRALIZED MANUAL TUNING
   The six radii are DERIVED at init/resize from the MEASURED
   scene (never hand-picked, no hard-coded max width):

     R1        = sunRadius + SUN_TO_FIRST_ORBIT_GAP * sceneWidth
     R_{i+1}   = R_i + planetRadius_i + planetRadius_{i+1}
                 + ORBIT_VISUAL_BUFFER * sceneWidth   (per-planet sizes)
     R6max     = min(widthBound, heightBound) inside the safe
                 rectangle (margin + depth-scale headroom)
     weights   = 1 + i * SPACING_WEIGHT (i = 0..4)  -> non-linear:
                 outer bands get slightly more breathing room
     gap_i     = span * w_i / sum(w);  R_i = R_{i-1} + gap_i

   On large desktops span >= 5 * clearance, so every neighboring
   band automatically satisfies R2-R1 >= 2*planetRadius + buffer.
   On smaller scenes the full span is still distributed with the
   same balanced weighting (best physically possible, no clipping,
   no physics). Movement itself is the CLASSIC orbital projection:
     x = cos(angle) * R
     y = sin(angle) * R * V3D_ELLIPSE_RATIO
   ============================================================ */

/** SUN -> FIRST ORBIT: generous visible empty gap (sun EDGE to PLANET 1
    EDGE). R1 = sunRadius + gap*sceneWidth + planetRadius(1)*maxScale, so
    the planet BODY - not just its orbit path - clears the Sun by this gap. */
const V3D_SUN_TO_FIRST_ORBIT_GAP = 0.06;
/** Planet-to-planet radial breathing room: R2-R1 >= 2r + buffer. */
const V3D_ORBIT_VISUAL_BUFFER = 0.025;
// =====================================================
// MANUAL ORBIT SPACING CONTROL
// Change this value to increase/decrease the distance
// between Planet 1 → Planet 2 → Planet 3 → Planet 4 →
// Planet 5 → Planet 6.
//
// Examples:
// 6.0  = large spacing
// 8.0  = very large spacing
// 10.0 = extremely large spacing
//
// Sun → Planet 1 is NOT controlled by this value.
// =====================================================
/**
 * The PREFERRED gap between neighboring orbits is
 *   gap = V3D_ORBIT_GAP_MULTIPLIER * (planetRadiusA + planetRadiusB + buffer)
 * R1 is NOT multiplied - the Sun -> Planet 1 distance stays EXACTLY as-is
 * (see firstOrbitRadius). When the requested total does not fit inside the
 * available radial span, ALL gaps are compressed UNIFORMLY (proportions
 * preserved) so Planet 6 stays inside the scene - the largest safe spacing
 * that fits is used; on wide screens the multiplier renders as-is.
 *
 * IMPORTANT:
 * If you change V3D_ORBIT_GAP_MULTIPLIER, you normally do NOT need to
 * change the other orbit-spacing values manually:
 *   - V3D_ORBIT_VISUAL_BUFFER : the visual buffer INSIDE each band size.
 *   - V3D_HARD_GAP_FRACTION   : absolute safety floor (containment only -
 *                               never used to create spacing).
 *   - V3D_SPACING_WEIGHT      : only distributes LEFTOVER span toward the
 *                               outer bands.
 *   - V3D_SUN_TO_FIRST_ORBIT_GAP : the Sun -> Planet 1 gap. Do NOT touch
 *                               it for planet spacing - it is already good.
 *
 * OPTIONAL per-orbit control (only if ever needed): the five gaps are
 * computed in ONE loop in updateOrbitGeometry():
 *   gap index 0 = Planet 1 -> Planet 2
 *   gap index 1 = Planet 2 -> Planet 3
 *   gap index 2 = Planet 3 -> Planet 4
 *   gap index 3 = Planet 4 -> Planet 5
 *   gap index 4 = Planet 5 -> Planet 6
 * A per-band override is a 3-line change there - no second system exists.
 */
const V3D_ORBIT_GAP_MULTIPLIER = 8.0;
/** Absolute per-band no-clipping floor: gap >= HARD * (rA + rB). Used by
    the distribution fallback and the validator; below this the pure
    proportional split + containment rescale take over (extreme
    viewports). */
const V3D_HARD_GAP_FRACTION = 0.5;
/** Extra configurable safety (fraction of scene width) subtracted from
    the maximum safe outer orbit, so Planet 6 (radius + max depth scale +
    glow) never touches the component edge - without wasting width. */
const V3D_OUTER_ORBIT_MARGIN = 0.006;
/** Non-linear spacing factor: weight_i = 1 + i * SPACING_WEIGHT, so the
    outer orbital bands receive progressively more breathing room (the
    outer planets fan out toward the safe boundary). */
const V3D_SPACING_WEIGHT = 0.22;
/** THE orbit tilt: one shared ellipse ratio for the classic projection
    (same visual model as the original component). Lower = wider usable
    orbits on wide/short stages, flatter look. 0.5 = current feel.
    NOTE: this is the DEFAULT - on tight stages the geometry engine may
    adapt it downward (never below V3D_ELLIPSE_RATIO_MIN) to keep the
    whole system inside the scene. */
const V3D_ELLIPSE_RATIO = 0.5;
/** Absolute floor for the adaptive ellipse ratio (never flatter than this). */
const V3D_ELLIPSE_RATIO_MIN = 0.32;

/**
 * PER-PLANET SIZE FACTORS (content-driven, one entry per planet, order =
 * COMPANY_VALUES). NOT all six planets are forced to the same radius:
 * values holding longer text (FR/EN/AR descriptions measured at design
 * time) get a slightly larger sphere, shorter ones a slightly smaller one.
 *   0 quality        1.00  (short description)
 *   1 engagement     1.04  (medium-long)
 *   2 responsibility 1.10  (longest description)
 *   3 safety         0.94  (shortest description)
 *   4 sustainability 1.06  (medium-long)
 *   5 environment    0.98  (medium)
 * Multiplied by `--v3d-planet` (and the adaptive fit shrink), so the
 * factors stay fully responsive at every breakpoint.
 */
const V3D_PLANET_SIZE_FACTORS = [1.0, 1.04, 1.1, 0.94, 1.06, 0.98];

/* ============================================================
   BOUNDARY SAFETY - SAFE USABLE RECTANGLE
   The orbital system is laid out inside a SAFE RECTANGLE derived
   from the MEASURED .v3d-scene size, not from raw 100% / 100vw:
     margin      = max(V3D_EDGE_MARGIN_PX, RATIO * min(sceneW, sceneH))
     usableHalfW = sceneWidth  / 2 - margin
     usableHalfH = sceneHeight / 2 - margin
   Every orbit bound, sun position and planet containment check runs
   against this rectangle (including the depth-scale headroom so a
   scaled-up near planet can never clip). Proportional + fixed floor:
   tiny margins on phones, comfortable breathing room on desktop.
   ============================================================ */
/** Absolute horizontal/vertical safety floor (px). */
const V3D_EDGE_MARGIN_PX = 20;
/** Proportional safety margin (fraction of the smaller scene dimension). */
const V3D_EDGE_MARGIN_RATIO = 0.015;
/** Adaptive planet-size shrink floor: planets are never reduced below
    80% of their preferred (factor-based) size. The adaptation ladder only
    shrinks when the scene cannot even host the HARD no-overlap floor
    (0.5x(rA+rB)) per band - planet size is the LAST lever. */
const V3D_PLANET_SHRINK_MIN = 0.8;
/** Per-adaptation-step planet shrink decrement. */
const V3D_PLANET_SHRINK_STEP = 0.04;
/** Content scale floor when planets are shrunk (keeps text proportional,
    readable - never microscopic). */
const V3D_CONTENT_SCALE_MIN = 0.84;
/** Content scale ceiling - never scale content UP beyond the base. */
const V3D_CONTENT_MAX_SCALE = 0.92;
/** Base content scale (matches the .v3d-section CSS default). */
const V3D_CONTENT_SCALE_BASE = 0.92;
/** Buffer floor fraction when the engine is forced to trade breathing
    room for containment (never below half the preferred buffer). */
const V3D_BUFFER_FACTOR_MIN = 0.5;

/**
 * Per-planet motion tuning (one entry per planet, order = COMPANY_VALUES).
 * The radial DISTANCE comes from the layout grid above; this config only
 * holds the DETERMINISTIC initial position and the calm, non-linear speed:
 *   angle  initial position (radians, screen coords: x = cos, y = sin with
 *          +y pointing down) - organic spread, no Math.random, stable
 *   speed  orbital speed (radians / second)
 */
interface V3DOrbitConfig {
  angle: number;
  speed: number;
}
const V3D_ORBITS: V3DOrbitConfig[] = [
  { angle: 0.2,  speed: 0.19 },
  { angle: 2.6,  speed: 0.16 },
  { angle: 3.14, speed: 0.14 },
  { angle: 3.8,  speed: 0.12 },
  { angle: 5.8,  speed: 0.105 },
  { angle: 0.95, speed: 0.09 },
];
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
 * Content visibility model - the front-facing factor (0..1) drives the
 * content's opacity + depth scale through the `--v3d-front` custom property
 * (see applyAnimation / .v3d-planet-content). The back of the sphere keeps a
 * very faint floor (V3D_CONTENT_MIN_OPACITY) and a slight shrink
 * (V3D_CONTENT_MIN_SCALE) so the cycle reads as one continuous 360° spin
 * rather than a hard 0->180->0 flip: front = 1, side fades, back is
 * essentially hidden, smoothly and without any jump or teleport.
 */
const V3D_CONTENT_MIN_OPACITY = 0.06;
const V3D_CONTENT_MIN_SCALE = 0.86;

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
 *   The radial grid (updateOrbitGeometry) derives the six radii in px from
 *   the MEASURED scene (sun size, planet size, width, height) at init and
 *   on resize, and writes them into the CSS custom properties that draw
 *   the rings. The planet position is the CLASSIC projected orbit:
 *     x = cos(angle) * radius
 *     y = sin(angle) * radius * V3D_ELLIPSE_RATIO
 *   The ring is drawn from the SAME radius + ratio, therefore a planet is
 *   always exactly on its ring. Collisions are minimized by design: the
 *   planet-aware non-linear radial spacing, deterministic initial angles
 *   and non-linear speeds. No per-frame physics.
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
         Change these values to tune the composition.
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
        /* Content-first hierarchy: SUN clearly dominant (2x the planet) with
           an 11cqw planet that still holds icon + wrapping title + full
           wrapping description. The radial GRID derives every orbit from
           the measured scene, so these two clamps fully define the layout. */
        --v3d-sun: clamp(11.5rem, 22cqw, 19rem);
        --v3d-planet: clamp(4.25rem, 11cqw, 9.5rem);
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
        /* Content depth (translateZ fraction of diameter), cap-relative scale,
           and convex "bowed" curvature (rotateX) - subtle to stay readable. */
        --v3d-content-z: 0.35;
        --v3d-content-scale: 0.92;
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

      /* Scene - FULL-WIDTH ORBITAL STAGE and geometry root.
         Previously the width was min(100%, 1400px, (availHeight) * 1.6129)
         with aspect-ratio: 100/62 - the height-derived candidate was the
         effective binder on most screens, so the scene (and .v3d-orbits,
         inset: 0) stopped far short of the section edges. Now the stage
         uses the FULL available parent width minus the small edge-safety
         margin, and fills the vertical space the one-viewport section
         already allots it (flex: 1 + min-height: 0 - no aspect-ratio lock,
         no 100vw, no horizontal scrollbar). container-type is kept, so
         1cqw now means 1% of the FULL stage; the sun/planet clamps' rem
         caps keep their resolved sizes stable on wide stages. The TS
         radial grid measures this element's clientWidth/clientHeight and
         re-derives every orbit from the new coordinate space.

         DEBUG LAYOUT (disabled): uncomment to verify the coordinate space.
         .v3d-scene { outline: 1px dashed red; }
         .v3d-orbits { outline: 1px dashed blue; } */
      .v3d-scene {
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        /* Defaults before the TS geometry engine runs; at init/resize the
           engine overrides these with measured px values: the six orbit
           radii (--v3d-orbit-rx-N), the adaptive tilt (--v3d-orbit-ratio),
           the planet fit shrink (--v3d-planet-shrink) and the content
           scale (--v3d-content-scale). Containment is guaranteed by the
           geometry (safe usable rectangle), NOT by clipping. */
        --v3d-planet-shrink: 1;
        container-type: inline-size;
        position: relative;
        margin-inline: auto;
        width: calc(100% - (2 * var(--v3d-edge-padding)));
        max-width: none;
        flex: 1 1 auto;
        min-height: 0;
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
         globe. It rotates WITH the sphere (child of LAYER 2). Deliberately
         NO backface-visibility: hidden here - a hard cull hides the content
         for an entire hemisphere and makes the spin read like a fake
         0->180->0 oscillation; visibility is instead a smooth function of
         the self-rotation angle (see --v3d-front / applyAnimation), so
         the cycle is a genuine continuous 360deg. The sphere body on the
         static button is never affected and stays fully visible. No
         overflow:hidden either - it would flatten preserve-3d and kill the
         depth effect; containment is guaranteed geometrically (a centered
         plane under Y-rotation never projects past the disc) plus the
         internal clipping on the content layer below. */
      .v3d-planet-surface {
        position: absolute;
        inset: 8%;
        border-radius: 50%;
        transform-style: preserve-3d;
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
        padding: 17% 13%;
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
          translateZ(calc(var(--v3d-planet) * var(--v3d-content-z)))
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
         here. backface-visibility hides mirrored text past 90deg; the
         planet disc itself is NOT affected and never disappears.
         Typography is content-aware (scales with the scene): the title may
         wrap instead of ellipsizing, and the description wraps freely with
         NO line-clamp / text-overflow so the complete value is always
         readable in every language (FR / EN / AR, including RTL). */
      .v3d-planet i { font-size: clamp(1.2rem, 3cqw, 2rem); line-height: 1; }
      .v3d-planet-title {
        font-size: clamp(0.62rem, 2cqw, 1.02rem);
        font-weight: 700;
        line-height: 1.12;
        letter-spacing: 0.01em;
        max-width: 100%;
        display: block;
      }
      .v3d-planet-desc {
        font-size: clamp(0.5rem, 1.45cqw, 0.82rem);
        line-height: 1.35;
        opacity: 0.92;
        max-width: 100%;
        display: block;
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
      .v3d-sun-content i { font-size: clamp(1.6rem, 4.2cqw, 2.4rem); line-height: 1; }
      .v3d-sun-content h3 { margin: 0; font-size: clamp(1rem, 3cqw, 1.5rem); font-weight: 800; line-height: 1.14; }
      .v3d-sun-content p {
        margin: 0;
        font-size: clamp(0.62rem, 1.95cqw, 0.95rem);
        line-height: 1.45;
        color: #92400e;
        display: block;
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
         Only the tuning variables shrink; the geometry engine in TS
         re-measures and rebuilds every orbit on resize, so the sun gap,
         orbit spacing and edge safety hold at every breakpoint. */
      @media (max-width: 900px) {
        .v3d-section {
          --v3d-header-block: 7rem;
          /* Tablet: full-width stage + edge safety; the radial grid
             re-derives every orbit from the measured scene. */
          --v3d-sun: clamp(7.5rem, 21.5cqw, 9.5rem);
          --v3d-planet: clamp(5rem, 11cqw, 9.5rem);
        }
      }
      @media (max-width: 560px) {
        .v3d-section {
          --v3d-header-block: 6.5rem;
          --v3d-bottom-gap: 3rem;
          /* Mobile: full available width (no desktop max-width reuse), no
             horizontal scrolling; sun ~1.27x planet, full content kept. */
          --v3d-sun: clamp(5.5rem, 21.5cqw, 7rem);
          --v3d-planet: clamp(3.9rem, 11cqw, 9.5rem);
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
             LAYER 1 = button (orbit position) / LAYER 2 = surface (sphere
             visuals + active scale) / LAYER 3 = content (readable text). -->
        <div class="v3d-planets">
          @for (value of values; track value.id; let i = $index) {
            <button
              type="button"
              class="v3d-planet"
              [class.active]="i === activeIndex()"
              [style.--v3d-pc]="planetColor(i)"
              [style.width]="planetSize(i)"
              [style.height]="planetSize(i)"
              (click)="selectPlanet(i)"
              [attr.aria-label]="value.titleKey | translate"
              [attr.aria-current]="i === activeIndex() ? 'true' : null"
            >
              <span class="v3d-planet-sphere">
                <span class="v3d-planet-surface">
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
  /** Measured sun radius in px (drives the sun -> first-orbit gap). */
  private sunRadiusPx = 0;
  /** Measured BASE planet radius in px (factor 1.0 planet, shrink = 1). */
  private basePlanetRadiusPx = 0;
  /**
   * Per-planet radius in px (base radius * content-driven size factor *
   * adaptive fit shrink). THE sizes used by the radial grid, the bounds
   * and the containment validation - real per-planet values, never one
   * shared radius.
   */
  private readonly planetRadiiPx = new Float64Array(V3D_SLOTS);
  /** Adaptive planet shrink applied this pass (1 = preferred sizes). */
  private planetFitShrink = 1;
  /** Adaptive content scale written to --v3d-content-scale this pass. */
  private contentScale = V3D_CONTENT_SCALE_BASE;
  /** Live ellipse ratio (adapts downward on tight stages, bounded below). */
  private ellipseRatio = V3D_ELLIPSE_RATIO;
  /** Current safe-rectangle margin in px (responsive, proportional+floor). */
  private usableMarginPx = 0;
  /** Radial-grid tightness: achieved fraction of the ideal rA+rB+buffer
      separation (reported by the dev validator; k=1 = literal rule). */
  private gridRatioK = 0;

  private scene: HTMLElement | null = null;
  private planets: HTMLElement[] = [];
  /** Cached self-rotation layers (one per planet) - written by the rAF loop. */
  private spheres: HTMLElement[] = [];
  /** Cached content layers (one per planet) - smooth visibility per frame. */
  private contents: HTMLElement[] = [];
  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // DETERMINISTIC start positions (V3D_ORBITS[i].angle) - no Math.random.
    // Every planet starts at its own configured, intentionally distributed
    // position, stable across reloads. Self-rotation angles are also seeded
    // deterministically (staggered) so no two planets spin in phase.
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.angles[i] = V3D_ORBITS[i].angle;
      this.selfAngles[i] = i * 0.9;
    }
    inject(DestroyRef).onDestroy(() => this.onDestroy());

    afterNextRender(() => {
      this.applyStaticGeometry();
      this.observeSceneResizes();
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
   * Responsive planet diameter (per planet, NOT uniform). Every planet
   * holds a different amount of text, so the diameter is the responsive
   * base `--v3d-planet` scaled by a content-driven factor
   * (V3D_PLANET_SIZE_FACTORS - longest descriptions get the largest
   * spheres) and by the adaptive `--v3d-planet-shrink` written by the
   * geometry engine when the scene is too tight for the preferred sizes.
   * Width and height are identical (circular sphere).
   */
  planetSize(i: number): string {
    const factor = V3D_PLANET_SIZE_FACTORS[i % V3D_SLOTS];
    return `calc(var(--v3d-planet) * ${factor} * var(--v3d-planet-shrink, 1))`;
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
   * ORBITAL GEOMETRY ENGINE - runs at init and on resize ONLY (never per
   * frame). The six radii are DERIVED from the measured scene:
   *
   *   R1        = sunRadius + SUN_TO_FIRST_ORBIT_GAP * sceneWidth
   *   R6max     = halfWidth - planetRadius - OUTER_EDGE_MARGIN * sceneWidth
   *   clearance = 2 * planetRadius + ORBIT_VISUAL_BUFFER * sceneWidth
   *   gap_i     = span * (1 + i*SPACING_WEIGHT) / sum(weights)
   *
   * On large desktops span >= 5 * clearance, so every neighboring band
   * satisfies R2-R1 >= 2*planetRadius + buffer automatically; on smaller
   * scenes the same non-linear balance simply uses the full available span.
   * The same radii are written to the .v3d-scene CSS custom properties used
   * by the orbit rings, so rings and trajectory share ONE source of truth.
   */
  /**
   * ORBITAL GEOMETRY ENGINE - runs at init and on resize ONLY (never per
   * frame). Everything is derived from the MEASURED scene (clientWidth +
   * clientHeight of .v3d-scene), laid out inside a SAFE usable rectangle:
   *
   *   margin      = max(V3D_EDGE_MARGIN_PX, RATIO * min(w, h))
   *   usableHalfW = w/2 - margin      usableHalfH = h/2 - margin
   *   r_i         = r_{i-1} + planetRadii[i-1] + planetRadii[i] + buffer
   *   R6max       = min(widthBound, heightBound) - incl. depth-scale headroom
   *
   * ADAPTATION (only when the preferred composition does not fit, in
   * order, all with floors so nothing collapses):
   *   1. shrink planet DIAMETERS slightly (>= V3D_PLANET_SHRINK_MIN) and
   *      pair it with a proportional content-scale reduction (>= MIN)
   *   2. reduce the orbit visual buffer (>= 50%)
   *   3. flatten the ellipse ratio (>= V3D_ELLIPSE_RATIO_MIN)
   *   4. if the floors are still not enough, the FULL span is distributed
   *      PROPORTIONALLY to the required gaps (contained proximity - the
   *      outermost orbit can never leave the safe rectangle).
   * The SUN is never shrunk - it stays visually dominant.
   * The same radii are written to the .v3d-scene CSS custom properties
   * used by the orbit rings, so rings and trajectory share ONE source.
   */
  private updateOrbitGeometry(): void {
    const w = this.sceneWidth;
    const h = this.sceneHeightPx;
    if (w <= 0) return;

    // --- SAFE USABLE RECTANGLE (responsive margin: floor + proportional).
    this.usableMarginPx = Math.max(
      V3D_EDGE_MARGIN_PX,
      V3D_EDGE_MARGIN_RATIO * Math.min(w, h > 0 ? h : w),
    );
    const usableHalfW = w / 2 - this.usableMarginPx;
    const usableHalfH =
      (h > 0 ? h / 2 : w * 0.31) - this.usableMarginPx;
    const sunR = this.sunRadiusPx;
    const effectiveScale = V3D_MAX_SCALE; // near-planet depth headroom

    // --- ADAPTATION LOOP (deterministic, init/resize only).
    // Priority (spacing first, planet size LAST):
    //   1. use the full outer radius (R6max, minus V3D_OUTER_ORBIT_MARGIN)
    //   2. flatten the adaptive ellipse ratio (>= V3D_ELLIPSE_RATIO_MIN)
    //   3. trim the orbit visual buffer (>= 50%)
    //   4. ONLY THEN shrink the planet diameters (>= V3D_PLANET_SHRINK_MIN)
    // The ladder's GOAL is the achievable no-overlap floor: the span must
    // host V3D_HARD_GAP_FRACTION * (rA + rB) per band. The spacing
    // preference (V3D_ORBIT_GAP_MULTIPLIER) is applied by the DISTRIBUTION
    // below - never by shrinking planets.
    let shrink = 1;
    let bufferFactor = 1;
    let ratio = V3D_ELLIPSE_RATIO;
    const hardSpanFor = (): number => {
      let sum = 0;
      for (let i = 0; i + 1 < V3D_SLOTS; i++) {
        sum += V3D_HARD_GAP_FRACTION * (this.planetRadiiPx[i] + this.planetRadiiPx[i + 1]);
      }
      return sum;
    };
    let attempt = 0;
    for (; attempt < 24; attempt++) {
      this.derivePlanetRadii(shrink);
      this.ellipseRatio = ratio;
      const r1 = this.firstOrbitRadius(sunR, w, effectiveScale);
      const outer = this.planetRadiiPx[V3D_SLOTS - 1] * effectiveScale;
      const widthBound = usableHalfW - outer;
      const heightBound = (usableHalfH - outer) / ratio;
      const r6Max = Math.max(
        Math.min(widthBound, heightBound) - V3D_OUTER_ORBIT_MARGIN * w,
        r1 + 0.015 * w,
      );
      const buf = V3D_ORBIT_VISUAL_BUFFER * w * bufferFactor;
      const span = r6Max - r1;
      // Accept as soon as the no-overlap floor fits - UNLESS the height
      // bound is still the binder while horizontal width remains unused
      // (large monitors): flatten the adaptive ellipse further (floor
      // V3D_ELLIPSE_RATIO_MIN) so the outer orbit expands to the width
      // limit and the scene's full width is used.
      if (span >= hardSpanFor()) {
        if (ratio > V3D_ELLIPSE_RATIO_MIN && widthBound > heightBound) {
          ratio = Math.max(V3D_ELLIPSE_RATIO_MIN, ratio - 0.04);
          continue;
        }
        break; // preferred/stepped state fits
      }

      // Preferred sizes do not fit -> adapt (bounded, in priority order).
      if (ratio > V3D_ELLIPSE_RATIO_MIN) {
        ratio = Math.max(V3D_ELLIPSE_RATIO_MIN, ratio - 0.04);
        continue;
      }
      if (bufferFactor > V3D_BUFFER_FACTOR_MIN) {
        bufferFactor = Math.max(V3D_BUFFER_FACTOR_MIN, bufferFactor - 0.1);
        continue;
      }
      if (shrink > V3D_PLANET_SHRINK_MIN) {
        shrink = Math.max(V3D_PLANET_SHRINK_MIN, shrink - V3D_PLANET_SHRINK_STEP);
        continue;
      }
      // All floors reached: the full span is distributed PROPORTIONALLY to
      // the required per-planet gaps below - always inside the rectangle.
      break;
    }

    this.planetFitShrink = shrink;
    // Content scale follows the planet shrink so text stays proportional
    // and readable inside the (possibly smaller) spheres.
    this.contentScale = Math.min(
      V3D_CONTENT_MAX_SCALE,
      Math.max(
        V3D_CONTENT_SCALE_MIN,
        V3D_CONTENT_SCALE_BASE * Math.pow(shrink, 0.5),
      ),
    );

    // --- RADIAL DISTRIBUTION (4x preference + balanced outer weights).
    this.derivePlanetRadii(shrink);
    const buf = V3D_ORBIT_VISUAL_BUFFER * w * bufferFactor;
    const required: number[] = [];
    const raw: number[] = [];
    let requiredSpan = 0;
    let weightSum = 0;
    for (let i = 0; i + 1 < V3D_SLOTS; i++) {
      const req = this.planetRadiiPx[i] + this.planetRadiiPx[i + 1] + buf;
      required.push(req);
      requiredSpan += req;
      const weight = 1 + i * V3D_SPACING_WEIGHT;
      raw.push(weight);
      weightSum += weight;
    }
    const r1 = this.firstOrbitRadius(sunR, w, effectiveScale);
    const outer = this.planetRadiiPx[V3D_SLOTS - 1] * effectiveScale;
    const r6Max = Math.max(
      Math.min(
        usableHalfW - outer,
        (usableHalfH - outer) / this.ellipseRatio,
      ) - V3D_OUTER_ORBIT_MARGIN * w,
      r1 + 0.015 * w,
    );
    const span = Math.max(r6Max - r1, 0.015 * w);
    this.gridRatioK = span / Math.max(V3D_ORBIT_GAP_MULTIPLIER * requiredSpan, 1);

    // Preferred: V3D_ORBIT_GAP_MULTIPLIER x the previous band requirement
    // per gap (R1 untouched).
    const preferredSpan = V3D_ORBIT_GAP_MULTIPLIER * requiredSpan;
    // Hard no-overlap floor sum: 0.5x(rA+rB) per band.
    let hardSum = 0;
    for (let i = 0; i + 1 < V3D_SLOTS; i++) {
      hardSum +=
        V3D_HARD_GAP_FRACTION *
        (this.planetRadiiPx[i] + this.planetRadiiPx[i + 1]);
    }
    const hardFits = hardSum <= span;

    let prev = r1;
    for (let i = 0; i < V3D_SLOTS; i++) {
      const rx = prev;
      this.orbitRx[i] = rx;
      this.orbitRy[i] = rx * this.ellipseRatio;
      if (i < V3D_SLOTS - 1) {
        let gap: number;
        if (preferredSpan <= span) {
          // The multiplier target fits (wide screens): preferred gaps +
          // any spare span shared by the outer-weighted balance.
          const spare = span - preferredSpan;
          gap =
            V3D_ORBIT_GAP_MULTIPLIER * required[i] + (spare * raw[i]) / weightSum;
        } else {
          // The multiplier total cannot fit: compress ALL gaps UNIFORMLY
          // (proportions preserved) to the full available span - the
          // largest safe spacing possible, Planet 6 stays inside. Every
          // band keeps at least the
          // HARD no-overlap floor while the floors collectively fit; on
          // extreme viewports the pure proportional split + the strict
          // outer-bound guard below keep R6 INSIDE the safe rectangle.
          const proportional = span * (required[i] / requiredSpan);
          gap = hardFits
            ? Math.max(
                V3D_HARD_GAP_FRACTION *
                  (this.planetRadiiPx[i] + this.planetRadiiPx[i + 1]),
                proportional,
              )
            : proportional;
        }
        prev = rx + gap;
      }
    }
    // Strict outer-bound guarantee: uneven per-band floors could in theory
    // accumulate slightly past r6Max; if so, fall back to the pure
    // proportional split so the outer orbit NEVER leaves the rectangle.
    if (this.orbitRx[V3D_SLOTS - 1] > r6Max) {
      let prevP = r1;
      for (let i = 0; i < V3D_SLOTS; i++) {
        this.orbitRx[i] = prevP;
        this.orbitRy[i] = prevP * this.ellipseRatio;
        if (i < V3D_SLOTS - 1) {
          prevP += span * (required[i] / requiredSpan);
        }
      }
    }
    this.writeOrbitCssVariables();
  }

  /**
   * SUN -> FIRST ORBIT radius. The gap is measured from the Sun EDGE to
   * PLANET 1's EDGE (not merely its orbit path), so the visible empty
   * space between the Sun and the planet BODY is exactly
   * V3D_SUN_TO_FIRST_ORBIT_GAP * sceneWidth - generous by design:
   *   R1 = sunRadius + gap + planetRadius(1) * maxDepthScale
   */
  private firstOrbitRadius(
    sunR: number,
    sceneWidth: number,
    effectiveScale: number,
  ): number {
    if (sunR <= 0) return 0.2 * sceneWidth;
    return (
      sunR +
      V3D_SUN_TO_FIRST_ORBIT_GAP * sceneWidth +
      this.planetRadiiPx[0] * effectiveScale
    );
  }

  /** Writes the per-orbit radii (px) plus the adaptive ratio / planet
      shrink / content scale into the CSS custom properties consumed by
      the ring elements and the planet sizes. Init + resize ONLY. */
  private writeOrbitCssVariables(): void {
    if (!this.scene) return;
    const style = this.scene.style;
    for (let i = 0; i < V3D_SLOTS; i++) {
      style.setProperty(`--v3d-orbit-rx-${i + 1}`, `${this.orbitRx[i].toFixed(2)}px`);
    }
    style.setProperty('--v3d-orbit-ratio', this.ellipseRatio.toFixed(3));
    style.setProperty('--v3d-planet-shrink', this.planetFitShrink.toFixed(3));
    style.setProperty('--v3d-content-scale', this.contentScale.toFixed(3));
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

  /** Reads the scene size once and caches the planet/content nodes for the
      rAF loop (no DOM queries inside the animation frames). */
  private applyStaticGeometry(): void {
    const host = this.elementRef.nativeElement;
    this.scene = host.querySelector<HTMLElement>('.v3d-scene');
    this.sceneWidth = this.scene ? this.scene.clientWidth : 0;
    this.sceneHeightPx = this.scene ? this.scene.clientHeight : 0;

    this.planets = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet'));
    this.spheres = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-sphere'));
    this.contents = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-content'));

    // Geometry pipeline: measure the real sun/planet sizes, then build the
    // orbit system in px (first orbit = measured sun edge + gap), validate
    // (dev only), and finally place the planets once.
    this.measureBodies();
    this.updateOrbitGeometry();
    this.validateOrbitGeometry();
    this.applyAnimation();
  }

  /** Measures the sun + BASE planet sizes once per init/resize pass. The
      per-planet radii (base radius x content factor x adaptive shrink) are
      derived in updateOrbitGeometry, which also decides the shrink. */
  private measureBodies(): void {
    if (!this.scene) return;
    const sun = this.scene.querySelector<HTMLElement>('.v3d-sun');
    const planet = this.scene.querySelector<HTMLElement>('.v3d-planet');
    const sunD = sun ? sun.offsetWidth : 0;
    // Planet 0 carries factor 1.00, so its rendered width is exactly
    // (base * currentShrink); normalize back to the true base radius.
    const planetD = planet ? planet.offsetWidth : 0;
    this.sunRadiusPx = sunD / 2;
    const shrink = this.planetFitShrink || 1;
    this.basePlanetRadiusPx = planet ? planetD / 2 / shrink : 0;
  }

  /** Derives the real per-planet radii in px from the measured base radius,
      the content-driven size factors and the current adaptive shrink. */
  private derivePlanetRadii(shrink: number): void {
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.planetRadiiPx[i] =
        this.basePlanetRadiusPx * V3D_PLANET_SIZE_FACTORS[i] * shrink;
    }
  }

  /**
   * DEV-TIME GEOMETRY VALIDATION - runs at init and on resize ONLY, never
   * per frame. Diagnostic LOGGING is dev-only; the containment CORRECTION
   * (validatePlanetBounds) runs in every build. Never throws: it safely
   * adjusts what it can and logs useful development warnings. Checks:
   *   1. sun larger than every planet (>= 1.25x)
   *   2. sun -> first orbit gap positive and sufficient
   *   3. neighboring orbit separations vs the exact rA+rB+buffer rule
   *   4. FULL per-planet boundary containment (validatePlanetBounds):
   *      every planet, at every sampled orbital position, inside the safe
   *      usable rectangle; auto-shrinks the orbit set if anything clips.
   */
  private validateOrbitGeometry(): void {
    if (this.sceneWidth <= 0) return;
    const dev = isDevMode();
    const w = this.sceneWidth;
    const h = this.sceneHeightPx;
    const usableHalfW = w / 2 - this.usableMarginPx;
    const usableHalfH = (h > 0 ? h / 2 : w * 0.31) - this.usableMarginPx;
    const sunR = this.sunRadiusPx;
    const maxPlanetR = Math.max(...Array.from(this.planetRadiiPx));

    // Radial grid report (dev only).
    if (dev && maxPlanetR > 0) {
      console.info(
        `[values-3d] Geometry: scene ${w.toFixed(0)}x${(h || 0).toFixed(0)}px, margin ${this.usableMarginPx.toFixed(0)}px, sun ${(sunR * 2).toFixed(0)}px, planets ${Array.from(this.planetRadiiPx, (r) => (r * 2).toFixed(0)).join('/')}px, shrink ${this.planetFitShrink.toFixed(2)}, ratio ${this.ellipseRatio.toFixed(2)}, k = ${this.gridRatioK.toFixed(2)}, orbits ${Array.from(this.orbitRx, (r) => r.toFixed(0)).join('/')}px`,
      );
    }

    // 1. Sun dominance (>= 1.25x the largest planet).
    if (dev && sunR > 0 && maxPlanetR > 0 && sunR < maxPlanetR * 1.25) {
      console.warn(
        `[values-3d] Sun (${(sunR * 2).toFixed(0)}px) should be >= 1.25x the largest planet (${(maxPlanetR * 2).toFixed(0)}px). Increase --v3d-sun or reduce --v3d-planet.`,
      );
    }

    // 2. Sun -> first orbit gap (Sun EDGE to PLANET 1 EDGE - same formula
    // as firstOrbitRadius, so the validator enforces the real visible gap).
    if (
      dev &&
      this.orbitRx[0] <
        sunR + V3D_SUN_TO_FIRST_ORBIT_GAP * w + this.planetRadiiPx[0] * V3D_MAX_SCALE
    ) {
      console.warn('[values-3d] First orbit does not clear the sun edge + gap.');
    }

    // 3. Neighboring orbit separation. On tight stages the full span is
    // distributed proportionally (accepted, contained proximity - the exact
    // ideal rA+rB+buffer cannot physically fit six content-sized planets in
    // one viewport), so only a HARD shortfall warns: radial gap below half
    // the sum of the two planet radii would risk visible overlap.
    for (let i = 0; i + 1 < V3D_SLOTS; i++) {
      const gap = this.orbitRx[i + 1] - this.orbitRx[i];
      const hardFloor =
        V3D_HARD_GAP_FRACTION * (this.planetRadiiPx[i] + this.planetRadiiPx[i + 1]);
      if (gap < hardFloor && dev) {
        console.warn(
          `[values-3d] Orbits ${i + 1}->${i + 2}: radial gap ${gap.toFixed(0)}px < hard floor ${hardFloor.toFixed(0)}px. Reduce --v3d-planet.`,
        );
      }
    }

    // 4. FULL BOUNDARY CONTAINMENT (all six planets, all orbital positions).
    this.validatePlanetBounds(usableHalfW, usableHalfH);
  }

  /**
   * Boundary containment check (init/resize, never per frame; runs in ALL
   * builds so containment is guaranteed in production too - the diagnostic
   * console warnings are dev-only). Samples each orbit and verifies the
   * planet (at its maximum depth-scale size) stays inside the safe usable
   * rectangle horizontally AND vertically. If anything would clip, the
   * whole orbit set is safely scaled down to fit and the rings are
   * re-synced - geometry-first containment, never overflow clipping.
   */
  private validatePlanetBounds(usableHalfW: number, usableHalfH: number): void {
    const SAMPLES = 90;
    const scale = V3D_MAX_SCALE; // planets grow up to this at the near pass
    let maxOverflowX = 0;
    let maxOverflowY = 0;
    for (let i = 0; i < V3D_SLOTS; i++) {
      const r = this.planetRadiiPx[i] * scale;
      for (let s = 0; s < SAMPLES; s++) {
        const a = (s / SAMPLES) * Math.PI * 2;
        const [x, y] = this.orbitPoint(i, a);
        maxOverflowX = Math.max(maxOverflowX, Math.abs(x) + r - usableHalfW);
        maxOverflowY = Math.max(maxOverflowY, Math.abs(y) + r - usableHalfH);
      }
    }
    if (maxOverflowX > 0.5 || maxOverflowY > 0.5) {
      // BOTH constraints must hold, so apply the MORE aggressive (smaller)
      // correction factor - Math.min, never Math.max.
      const bound = Math.min(
        maxOverflowX > 0.5 ? usableHalfW / (usableHalfW + maxOverflowX) : 1,
        maxOverflowY > 0.5
          ? (usableHalfH - this.planetRadiiPx[V3D_SLOTS - 1] * scale) /
              (usableHalfH - this.planetRadiiPx[V3D_SLOTS - 1] * scale + maxOverflowY)
          : 1,
      );
      for (let i = 0; i < V3D_SLOTS; i++) {
        this.orbitRx[i] = Math.max(this.orbitRx[i] * bound, 1);
        this.orbitRy[i] = this.orbitRx[i] * this.ellipseRatio;
      }
      this.writeOrbitCssVariables();
      if (isDevMode()) {
        console.warn(
          `[values-3d] Planets exceeded the safe rectangle (overflow x=${Math.max(maxOverflowX, 0).toFixed(0)}px, y=${Math.max(maxOverflowY, 0).toFixed(0)}px). Orbits scaled by ${(bound * 100).toFixed(0)}%. Reduce --v3d-planet or --v3d-sun.`,
        );
      }
    }
  }

  /** Point on orbit i at parametric angle a (classic projection). */
  private orbitPoint(i: number, a: number): [number, number] {
    return [
      Math.cos(a) * this.orbitRx[i],
      Math.sin(a) * this.orbitRx[i] * this.ellipseRatio,
    ];
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
        // Re-measure the bodies (rem/cqw clamps shift with the viewport),
        // rebuild the orbit geometry, and re-validate (dev only). All of
        // this runs on resize ticks only - never inside a frame.
        this.measureBodies();
        this.updateOrbitGeometry();
        this.validateOrbitGeometry();
        this.applyAnimation();
      });
      this.resizeObserver.observe(scene);
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
          this.angles[i] += V3D_ORBITS[i].speed * V3D_DEG * delta;
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

      // Self-rotation: the SPHERE rotates; the icon/title/description are its
      // physical children and inherit the exact same angle, speed and clock.
      // The content's front-facing factor --v3d-front is then written here as
      // a smooth 0..1 value (front = 1, side fades, back ~0) — CSS derives the
      // content's opacity + depth scale from it, so the whole surface group
      // fades/shrinks as ONE continuous 360° cycle: no hard flip, no teleport.
      const sphere = this.spheres[i];
      if (sphere) {
        sphere.style.transform = this.composeSelfRotationTransform(this.selfAngles[i]);
      }
      const content = this.contents[i];
      if (content) {
        const front = Math.max(0, Math.cos(this.selfAngles[i]));
        const smooth = front * front * (3 - 2 * front); // smoothstep
        content.style.setProperty('--v3d-front', smooth.toFixed(3));
      }
    }
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
  }
}