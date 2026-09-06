import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header.component';
import { COMPANY_VALUES } from './values.data';

/* ============================================================
   3D VALUES — MANUAL VISUAL TUNING (TypeScript side)
   Change these values to tune the composition.
   NOTE: V3D_RX1_FRAC / V3D_STEP_FRAC below MUST stay identical
   to the CSS custom properties --v3d-orbit-rx-base / --v3d-orbit-step
   in the styles of this component (single source of truth pair).
   ============================================================ */

/** Dwell time between automatic active-value steps (autoplay). */
const V3D_AUTOPLAY_MS = 4000;
/** Planets (= COMPANY_VALUES length). */
const V3D_SLOTS = 6;
/** Autoplay proceeds 0..n-1 then wraps. */
const V3D_STEP = 1;
/**
 * Orbit plane tilt, expressed as the projection ratio of the tilted XZ
 * circle: radiusY = radiusX * cos(tilt). 0.6 == a circle on the XZ plane
 * viewed from ~53° above the horizon. The ring (CSS) and the planet
 * trajectory (JS) BOTH multiply the same radius by this ratio, so the
 * planet can never leave its ring.
 */
const V3D_ELLIPSE_RATIO = 0.6;
const V3D_DEG = Math.PI / 180;
/** Near/far visual scale range - smooth and deliberately modest. */
const V3D_MIN_SCALE = 0.82;
const V3D_MAX_SCALE = 1.06;
/** Near/far opacity range (far planets stay clearly readable). */
const V3D_MIN_OPACITY = 0.75;
const V3D_MAX_OPACITY = 1;
/** Depth -> z-index band. 200..300 renders BEHIND the sun (z:300),
    300..400 renders IN FRONT of it - planets visibly orbit around it. */
const V3D_Z_BASE = 200;
const V3D_Z_SPAN = 200;
/** Per-planet orbital speed (radians per second) - inner fast, outer calm. */
const V3D_SPEEDS = [0.32, 0.27, 0.23, 0.2, 0.17, 0.14];
/** Initial offsets (radians) so the six planets start spread around the sun. */
const V3D_START_ANGLES = [0.4, 1.6, 3.0, 4.4, 5.6, 2.4];
/** Fixed planet accent colors (SIGAT identity: warm gold + cool blues). */
const V3D_COLORS = ['#f59e0b', '#2563eb', '#0ea5e9', '#6366f1', '#1d4ed8', '#0f766e'];
/**
 * radiusX = this fraction x scene width; successive orbits step by fraction.
 * MUST MATCH --v3d-orbit-rx-base (0.23) and --v3d-orbit-step (0.039) in CSS.
 */
const V3D_RX1_FRAC = 0.23;
const V3D_STEP_FRAC = 0.039;
/** Subtle per-planet size variation (planet i is scaled by 1 - i*step). */
const V3D_PLANET_SIZE_STEP = 0.03;
/** Per-planet AXIAL (self) rotation speed (radians/s) - VERY slow celestial
    rotation, NOT a spinning UI card. Inner planets rotate slightly faster.
    In degrees/frame at 60fps this is ~0.018-0.031 (inside the 0.015-0.04
    readability window). Fully independent of the orbital speeds (two
    separate angle systems, one shared rAF clock). */
const V3D_SELF_SPEEDS = [0.032, 0.03, 0.028, 0.026, 0.024, 0.022];
/**
 * Content visibility model - keeps the TRUE 360deg rotation perceptible.
 * A hard backface cull makes the content vanish for a whole hemisphere,
 * which reads like a fake 0->180->0 oscillation. Instead the content fades
 * smoothly with the self-rotation angle and keeps a faint presence
 * (V3D_BACK_OPACITY) on the far side, so the cycle reads as one continuous
 * spin. opacity = BACK + (1 - BACK) * smoothstep(max(0, cos(selfAngle))).
 */
const V3D_BACK_OPACITY = 0.15;

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
 * Geometry model (single mathematical source of truth per orbit):
 *   Every orbit is a circle of radius orbitRadius(i) on the XZ plane. The
 *   whole system is tilted toward the camera, so the circle projects onto
 *   the screen as an ellipse with radiusY = radiusX * V3D_ELLIPSE_RATIO.
 *   The CSS rings and the JS planet trajectory use the SAME radius fractions
 *   about the SAME 50%/50% center, therefore a planet is always exactly on
 *   its ring - the ellipse look is the projection, never a faked path.
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
        /* Fixed navbar height: h-20 (5rem) mobile, md:h-24 (6rem) desktop. */
        --v3d-header-offset: 6rem;
        /* Vertical space used by the section header block above the scene. */
        --v3d-header-block: 7.5rem;
        /* Breathing room kept below the section (was 8rem -> giant blank). */
        --v3d-bottom-gap: 4rem;
        /* Scene aspect ratio as width/height multiplier (100 / 62). */
        --v3d-scene-ar: 1.6129;
        /* Widest the scene may ever get on desktop. */
        --v3d-scene-max-w: 940px;
        /* Orbit radii: base + step * i (MUST match V3D_RX1_FRAC / V3D_STEP_FRAC). */
        --v3d-orbit-rx-base: 23cqw;
        --v3d-orbit-step: 3.9cqw;
        /* Orbit plane tilt (radiusY = radiusX * ratio). */
        --v3d-orbit-ratio: 0.6;
        /* Sun vs planet sizes - the sun stays ~1.9x the largest planet even
           though planets grew to carry icon + title + description. */
        --v3d-sun: clamp(7.5rem, 19cqw, 12rem);
        --v3d-planet: clamp(3.2rem, 10.8cqw, 6.4rem);
        /* Surface-mounted content depth: translateZ = planet diameter x this
           fraction. Small value = text sits just above the curved surface
           (bowed toward the viewer by the 700px perspective), never floating. */
        --v3d-content-z: 0.35;
        /* Content scale relative to the surface cap (keeps it inside the
           sphere silhouette). */
        --v3d-content-scale: 0.92;
        /* ============================================================ */

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

      /* Scene - geometry root. container-type lets every size resolve from
         the container width (cqw) so rings scale responsively. The later
         width candidates derive the scene width from the AVAILABLE HEIGHT,
         so the whole system fits one viewport without empty bands. */
      .v3d-scene {
        --v3d-rx1: var(--v3d-orbit-rx-base);
        --v3d-rx2: calc(var(--v3d-orbit-rx-base) + var(--v3d-orbit-step));
        --v3d-rx3: calc(var(--v3d-orbit-rx-base) + var(--v3d-orbit-step) * 2);
        --v3d-rx4: calc(var(--v3d-orbit-rx-base) + var(--v3d-orbit-step) * 3);
        --v3d-rx5: calc(var(--v3d-orbit-rx-base) + var(--v3d-orbit-step) * 4);
        --v3d-rx6: calc(var(--v3d-orbit-rx-base) + var(--v3d-orbit-step) * 5);
        --v3d-ease: cubic-bezier(0.22, 1, 0.36, 1);
        container-type: inline-size;
        position: relative;
        margin-inline: auto;
        width: min(100%, var(--v3d-scene-max-w));
        width: min(
          100%,
          var(--v3d-scene-max-w),
          calc(
            (100vh - var(--v3d-header-offset) - var(--v3d-header-block) - var(--v3d-bottom-gap))
            * var(--v3d-scene-ar)
          )
        );
        width: min(
          100%,
          var(--v3d-scene-max-w),
          calc(
            (100dvh - var(--v3d-header-offset) - var(--v3d-header-block) - var(--v3d-bottom-gap))
            * var(--v3d-scene-ar)
          )
        );
        aspect-ratio: 100 / 62;
      }

      /* Orbit rings - the projected ellipse of each tilted XZ circle.
         width = 2 * radiusX, height = 2 * radiusX * tilt ratio. */
      .v3d-orbits { position: absolute; inset: 0; }
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
      .v3d-orbit.o1 { width: calc(var(--v3d-rx1) * 2); height: calc(var(--v3d-rx1) * 2 * var(--v3d-orbit-ratio)); }
      .v3d-orbit.o2 { width: calc(var(--v3d-rx2) * 2); height: calc(var(--v3d-rx2) * 2 * var(--v3d-orbit-ratio)); }
      .v3d-orbit.o3 { width: calc(var(--v3d-rx3) * 2); height: calc(var(--v3d-rx3) * 2 * var(--v3d-orbit-ratio)); }
      .v3d-orbit.o4 { width: calc(var(--v3d-rx4) * 2); height: calc(var(--v3d-rx4) * 2 * var(--v3d-orbit-ratio)); }
      .v3d-orbit.o5 { width: calc(var(--v3d-rx5) * 2); height: calc(var(--v3d-rx5) * 2 * var(--v3d-orbit-ratio)); }
      .v3d-orbit.o6 { width: calc(var(--v3d-rx6) * 2); height: calc(var(--v3d-rx6) * 2 * var(--v3d-orbit-ratio)); }

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
        /* Layered spherical shading: top-left light, bottom-right shadow. */
        background:
          radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 22%),
          radial-gradient(circle at 65% 70%, rgba(0, 0, 0, 0.34) 0%, rgba(0, 0, 0, 0) 58%),
          var(--v3d-pc);
        border: 2px solid rgba(255, 255, 255, 0.45);
        box-shadow:
          0 8px 20px rgba(15, 23, 42, 0.25),
          inset 0 -10px 18px rgba(0, 0, 0, 0.26),
          inset 4px 6px 10px rgba(255, 255, 255, 0.24);
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
         the self-rotation angle (see V3D_BACK_OPACITY / applyAnimation), so
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

      /* LAYER 4 (content): icon / title / description physically mounted on
         the rotating surface cap. translateZ is proportional to the planet
         diameter so the text bows toward the viewer with the sphere
         curvature; the subtle scale keeps it inside the silhouette. The
         content owns NO rotation transform - it simply inherits the sphere's
         axial rotation, angle, speed and clock. */
      .v3d-planet-content {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.18rem;
        /* Safe internal padding as a PERCENTAGE of the content box, so the
           readable area scales with the planet (10-15% band, no fixed rem
           that breaks on mobile). */
        padding: 12% 10%;
        overflow: hidden;
        text-align: center;
        color: #ffffff;
        text-shadow: 0 1px 3px rgba(15, 23, 42, 0.55), 0 1px 0 rgba(255, 255, 255, 0.14);
        user-select: none;
        transform:
          translateZ(calc(var(--v3d-planet) * var(--v3d-content-z)))
          scale(var(--v3d-content-scale));
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

      /* LAYER 3 (content): icon / title / description, clipped to the circle
         so nothing escapes the planet surface. This is the SELF-ROTATION
         layer: the rAF loop writes rotateY(selfAngle) + cos-based opacity
         here. backface-visibility hides mirrored text past 90deg; the
         planet disc itself is NOT affected and never disappears. */
      .v3d-planet i { font-size: clamp(0.95rem, 2.6cqw, 1.5rem); line-height: 1; }
      .v3d-planet-title {
        font-size: clamp(0.5rem, 1.45cqw, 0.75rem);
        font-weight: 700;
        line-height: 1.08;
        letter-spacing: 0.01em;
        max-width: 100%;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .v3d-planet-desc {
        font-size: clamp(0.44rem, 1.1cqw, 0.58rem);
        line-height: 1.25;
        opacity: 0.92;
        max-width: 100%;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
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
        background: radial-gradient(circle at 30% 28%, #fff6cf 0%, #ffd76b 48%, #ffb347 92%);
        box-shadow: 0 0 40px rgba(255, 179, 71, 0.5), 0 0 110px rgba(255, 140, 0, 0.26),
          inset 0 0 0 8px rgba(255, 245, 192, 0.6), inset 0 -14px 26px rgba(234, 88, 12, 0.34);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: v3d-sun-pulse 3.2s ease-in-out infinite;
      }
      @keyframes v3d-sun-pulse {
        0%, 100% { box-shadow: 0 0 40px rgba(255, 179, 71, 0.5), 0 0 110px rgba(255, 140, 0, 0.26), inset 0 0 0 8px rgba(255, 245, 192, 0.6); }
        50%      { box-shadow: 0 0 64px rgba(255, 179, 71, 0.66), 0 0 150px rgba(255, 140, 0, 0.34), inset 0 0 0 8px rgba(255, 245, 192, 0.66); }
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
      /* Sun content: subtle convex/embossed treatment. A slight perspective
         tilt + layered highlight/shadow text makes the text feel embedded in
         the glowing sphere while staying perfectly readable. */
      .v3d-sun-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        padding: 0 14%;
        text-align: center;
        color: #78350f;
        perspective: 480px;
        animation: v3d-swap 300ms var(--v3d-ease) both;
      }
      .v3d-sun-content i,
      .v3d-sun-content h3,
      .v3d-sun-content p {
        transform: rotateX(4deg);
        text-shadow:
          0 1px 0 rgba(255, 251, 235, 0.55),
          0 -1px 2px rgba(124, 45, 18, 0.28);
      }
      .v3d-sun-content i { font-size: clamp(1.3rem, 4cqw, 2rem); line-height: 1; }
      .v3d-sun-content h3 { margin: 0; font-size: clamp(0.85rem, 2.7cqw, 1.15rem); font-weight: 800; line-height: 1.18; }
      .v3d-sun-content p {
        margin: 0;
        font-size: clamp(0.55rem, 1.75cqw, 0.78rem);
        line-height: 1.4;
        color: #92400e;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
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
         Same math everywhere: only the tuning variables shrink. */
      @media (max-width: 900px) {
        .v3d-section {
          --v3d-header-block: 7rem;
          --v3d-scene-max-w: 34rem;
          --v3d-sun: clamp(6.3rem, 18cqw, 8.5rem);
          --v3d-planet: clamp(2.95rem, 10.6cqw, 5rem);
        }
      }
      @media (max-width: 560px) {
        .v3d-section {
          --v3d-header-block: 6.5rem;
          --v3d-bottom-gap: 3rem;
          --v3d-scene-max-w: 23rem;
          --v3d-sun: clamp(5.5rem, 19cqw, 7rem);
          --v3d-planet: clamp(2.75rem, 11cqw, 4rem);
        }
        /* A ~42px circle cannot hold three text rows: the description is
           hidden visually only (data + translations untouched; the full
           text remains in the sun and in each planet's aria-label). */
        .v3d-planet-desc { display: none; }
      }

      /* ================= Reduced motion =================
         The rAF loop never starts, so no orbital OR self-rotation happens;
         content stays fully visible and readable. */
      @media (prefers-reduced-motion: reduce) {
        .v3d-sun-content { animation: none; }
        .v3d-sun { animation: none; }
        .v3d-planet, .v3d-planet-surface, .v3d-dot { transition: none; }
        .v3d-planet-sphere { transform: none; }
        /* !important overrides any inline opacity already written by the
           rAF loop before the preference changed - content stays readable. */
        .v3d-planet-content { opacity: 1 !important; }
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
    // Randomize start positions ONCE so every reload looks fresh.
    // Orbit angles and self-rotation angles are seeded independently.
    for (let i = 0; i < V3D_SLOTS; i++) {
      this.angles[i] = V3D_START_ANGLES[i] + Math.random() * Math.PI * 2;
      this.selfAngles[i] = Math.random() * Math.PI * 2;
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
   * Responsive planet size from the scene custom property, with a subtle
   * per-planet variation (planet i is scaled by 1 - i * V3D_PLANET_SIZE_STEP).
   */
  planetSize(i: number): string {
    const f = 1 - (i % V3D_SLOTS) * V3D_PLANET_SIZE_STEP;
    return `calc(var(--v3d-planet) * ${f.toFixed(3)})`;
  }

  selectPlanet(index: number): void {
    const i = ((index % V3D_SLOTS) + V3D_SLOTS) % V3D_SLOTS;
    this.activeIndex.set(i);
    // Orbital position is untouched - the planet keeps moving from where it is.
    this.scheduleAutoplay(V3D_AUTOPLAY_MS);
  }

  /**
   * THE single orbit-radius source of truth in JavaScript.
   * Returns radiusX in px for orbit i; the visual ring is the SAME fraction
   * of the SAME container width via --v3d-orbit-rx-base/--v3d-orbit-step,
   * and both share the vertical ratio V3D_ELLIPSE_RATIO, so:
   *   planet distance from center === ring radius  (for every i)
   */
  private orbitRadius(index: number): number {
    return this.sceneWidth * (V3D_RX1_FRAC + index * V3D_STEP_FRAC);
  }

  /**
   * XZ-circle orbit projected by the fixed system tilt:
   *   x = cos(theta) * radius          (screen X)
   *   y = sin(theta) * radius * ratio  (screen Y = projected Z of the tilt)
   * The ellipse is purely the projection of the circular orbit - never a
   * separately faked path - so the planet can never drift off its ring.
   */
  private calculatePlanetGeometry(index: number, angle: number): PlanetGeometry {
    const radius = this.orbitRadius(index);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * V3D_ELLIPSE_RATIO;
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

    this.planets = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet'));
    this.spheres = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-sphere'));
    this.contents = Array.from(host.querySelectorAll<HTMLElement>('.v3d-planet-content'));
    this.applyAnimation();
  }

  /**
   * THE responsive fix: the old code measured sceneWidth ONCE, so after any
   * resize the planets kept stale px radii while the CSS rings (cqw) resized
   * - planets visibly drifted off their orbits. The observer keeps the JS
   * radius in sync with the CSS rings at ALL times, without Angular CD.
   */
  private observeSceneResizes(): void {
    if (typeof ResizeObserver === 'undefined' || !this.scene) return;
    const scene = this.scene;
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        const width = scene.clientWidth;
        if (width === this.sceneWidth) return;
        this.sceneWidth = width;
        this.applyAnimation();
      });
      this.resizeObserver.observe(scene);
    });
  }

  /** ONE rAF loop: advances every planet continuously until destroyed, runs
      outside the Angular zone and writes only to style props (no CD per frame).
      Each frame: (1) delta time, (2) orbital angles, (3) SELF-rotation angles,
      (4) direct DOM writes. The two angle systems are fully independent. */
  private startAnimation(): void {
    this.zone.runOutsideAngular(() => {
      const step = (timestamp: number) => {
        const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 16.667 : 1;
        this.lastTimestamp = timestamp;
        for (let i = 0; i < this.angles.length; i++) {
          this.angles[i] += V3D_SPEEDS[i] * V3D_DEG * delta;
          this.selfAngles[i] += V3D_SELF_SPEEDS[i] * delta;
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
      // The sphere's rotateY angle is CONTINUOUS (0 -> 360 -> 720 ...). A hard
      // backface cull would hide the content for a whole hemisphere and read
      // like a fake 0->180->0 oscillation, so visibility is instead a smooth
      // front-facing factor: front = 1, ~45deg ~= 0.8, 90deg = back floor,
      // back = V3D_BACK_OPACITY - continuous, no flip, no teleport, no jump.
      const sphere = this.spheres[i];
      if (sphere) {
        sphere.style.transform = this.composeSelfRotationTransform(this.selfAngles[i]);
      }
      const content = this.contents[i];
      if (content) {
        const front = Math.max(0, Math.cos(this.selfAngles[i]));
        const smooth = front * front * (3 - 2 * front); // smoothstep
        content.style.opacity = (
          V3D_BACK_OPACITY + (1 - V3D_BACK_OPACITY) * smooth
        ).toFixed(3);
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