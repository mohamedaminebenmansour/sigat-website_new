/**
 * ============================================================
 * ORBITAL-PLANE ANGLE  <-- THE ONE KNOB TO CHANGE
 * ============================================================
 *
 * This controls ONLY the inclination of the common 3D plane that
 * contains the Sun centre and all six planet centres: the plane is
 * rotated around the horizontal X axis through the exact centre of
 * the Sun.
 *
 *   0   = one extreme         (plane aligned with the screen: the orbits
 *                             are full circles and carry no depth)
 *   45  = medium inclination  (the configured value)
 *   90  = the other extreme   (plane seen edge-on: the orbits collapse to
 *                             a horizontal line and all the orbital
 *                             radius becomes depth)
 *
 * IMPORTANT - this angle MUST NOT modify:
 *     Sun size, planet size, orbit radius, distance between orbits,
 *     orbital speed, self-rotation, content size.
 * It ONLY controls the geometry / orientation of the common plane, and it
 * is projected DIRECTLY: there is no viewport-dependent flattening, no
 * height budget and no second inclination anywhere.
 *
 * HOW IT PROPAGATES (nothing else needs manual editing):
 *
 *        ANGLE
 *          │
 *          ▼
 *   orbital plane       V3D_ORBIT_PLANE_TILT  = cos(angle)  -> screen Y
 *                       V3D_ORBIT_PLANE_DEPTH = sin(angle)  -> depth
 *          │
 *          ▼
 *   calculateOrbitPoint()  <- the SINGLE mathematical source of truth
 *          │                   (read by the planet movement every frame;
 *          │                    STEP 2 will sample the orbit traces here)
 *          ▼
 *   orbitalX = cos(theta) * radius      orbitalY = sin(theta) * radius
 *   x        = centerX + orbitalX                        (screen)
 *   y        = centerY + orbitalY * cos(angle)           (screen)
 *   depth    = orbitalY * sin(angle)                     (front/back)
 *
 * ONE common origin (centerX / centerY = the exact centre of the Sun's
 * orbital coordinate system), ONE radius per orbit, ONE angle. Containment
 * is guaranteed by the single uniform fit scale in compute(): the angle is
 * never used to shrink or grow anything.
 */
export const V3D_ORBIT_PLANE_ANGLE_DEG = 45;

/** The same inclination in radians - computed ONCE, at module load. */
const orbitPlaneAngleRad = (V3D_ORBIT_PLANE_ANGLE_DEG * Math.PI) / 180;

/** Screen projection of the inclined plane: the vertical semi-axis of a
    projected orbit, i.e. radius * cos(angle). One design unit = one px
    before the uniform --v3d-fit scale. It is EXACTLY cos of the knob above:
    there is no viewport-dependent flattening any more. */
export const V3D_ORBIT_PLANE_TILT = Math.cos(orbitPlaneAngleRad);

/** Out-of-plane component of the very same inclination, i.e. radius *
    sin(angle) - it becomes the depth (front/back z-order, near/far scale and
    opacity) of a body. Never a second tuning value: see
    calculateOrbitPoint(). */
export const V3D_ORBIT_PLANE_DEPTH = Math.sin(orbitPlaneAngleRad);

/** SUN -> FIRST ORBIT gap as a fraction of the Sun's logical diameter.
    Controls ONLY the Sun -> Planet 1 distance. */
export const V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO = 0.28;

// ============================================================
// MANUAL ORBIT SPACING - distance between consecutive planets
// (1 -> 2 -> 3 -> 4 -> 5 -> 6). Sun -> Planet 1 is NOT controlled
// by this value (see V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO above).
// The band spacing is proportional to the planet radii, so the
// composition keeps the same rhythm however big the planets get.
// 2.0 = neighbours never overlap (smaller planets); 1.15 = a mild
// overlap only while two planets cross; 1.0 = biggest planets.
// ============================================================
export const V3D_BAND_GAP_RATIO = 1.05;

/** Breathing room (logical px) between the outermost orbit and the edge
    of the logical design space. */
export const V3D_STAGE_PADDING = 24;

/** Near/far visual scale range of the depth model (0 far .. 1 near):
    smooth and deliberately modest. Used by the geometry (orbit headroom,
    fit extent) and by the component (depth -> scale mapping), so the pair
    lives here as ONE source. */
export const V3D_MIN_SCALE = 0.86;
export const V3D_MAX_SCALE = 1.08;

/** First-orbit radius: Sun EDGE + gap + PLANET 1 EDGE headroom.
    `fallbackWidth` only guards the pre-measurement state (before the sizes
    pass has resolved a Sun radius): the historical behaviour was
    0.2 * sceneWidth. */
export function firstOrbitRadius(
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  fallbackWidth = 0,
): number {
  if (sunRadius <= 0) return 0.2 * fallbackWidth;
  return (
    sunRadius +
    sunRadius * 2 * V3D_SUN_TO_FIRST_ORBIT_GAP_RATIO +
    planetRadii[0] * V3D_MAX_SCALE
  );
}

/** Band spacing between planet i and planet i+1: proportional to the two
    radii it separates, so bigger planets automatically get more room
    without ever changing the rhythm of the composition. */
export function bandGap(index: number, planetRadii: ArrayLike<number>): number {
  return (V3D_BAND_GAP_RATIO * (planetRadii[index] + planetRadii[index + 1])) / 2;
}

/** Half extent (design px) of the composition with the GIVEN radii:
    the outermost ring + the body that rides it. Used to normalize the
    manual radii against the measured scene width. */
export function designHalfExtent(
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  fallbackWidth = 0,
): number {
  let radius = firstOrbitRadius(sunRadius, planetRadii, fallbackWidth);
  for (let i = 0; i < planetRadii.length - 1; i++) {
    radius += bandGap(i, planetRadii);
  }
  return radius + planetRadii[planetRadii.length - 1] * V3D_MAX_SCALE;
}

/**
 * THE ORBITAL GEOMETRY - one instance inside Values3dComponent.
 *
 * compute() turns (measured scene, body sizes) into: the ONE origin
 * (centerX / centerY), the six orbit radii, the projection of the ONE
 * orbital plane (its cos / sin) and the uniform fit scale. It is called on
 * init + resize ONLY (never per frame) and reproduces the approved position
 * model verbatim:
 *
 *   R1     = sunRadius + 2*sunRadius*SUN_TO_FIRST_ORBIT_GAP_RATIO
 *            + planetRadius_1 * V3D_MAX_SCALE        (depth headroom)
 *   gap_i  = V3D_BAND_GAP_RATIO * (radius_i + radius_i+1) / 2
 *   R_i+1  = R_i + gap_i
 *   tilt   = cos(V3D_ORBIT_PLANE_ANGLE_DEG)   (exactly the knob - never
 *                                              flattened by the viewport)
 *   depth  = sin(V3D_ORBIT_PLANE_ANGLE_DEG)   (the SAME angle, never a 2nd)
 *   fit    = ONE uniform scale fitting the composition on BOTH axes
 *
 * calculateOrbitPoint() is the SINGLE mathematical source of truth of the
 * orbital movement (the planets read it every frame). The orbit traces are
 * intentionally NOT drawn in this step: STEP 2 will sample them from this
 * very function, so a trace and a trajectory are the same curve by
 * construction - around the SAME origin, with the SAME radii and the SAME
 * inclination.
 */
export class Values3dGeometry {
  /** THE ONE ORIGIN of the orbital system: the exact centre of the Sun's
      orbital coordinate system (the centre of .v3d-scene, where the Sun is
      pinned). Every planet position is derived from this single point -
      there is no separate centre for anything else. */
  centerX = 0;
  centerY = 0;

  /** The six orbit radii (design px), re-laid-out by compute(). */
  radii: Float64Array = new Float64Array(0);

  /** PROJECTION of the ONE orbital plane on the screen's vertical axis:
      cos(V3D_ORBIT_PLANE_ANGLE_DEG), i.e. exactly the knob - never
      flattened, clamped or scaled by the viewport. */
  ellipseRatio = V3D_ORBIT_PLANE_TILT;

  /** OUT-OF-PLANE factor of that very same inclination (the depth axis):
      sin(angle). With a circle of radius R, screenOffsetY^2 + depth^2 = R^2,
      so all six planets stay on circles of ONE common plane. */
  depthFactor = V3D_ORBIT_PLANE_DEPTH;

  /** Current uniform fit scale (design space -> real scene). */
  fit = 1;

  /**
   * FULL GEOMETRY PASS (init + resize ONLY, never per frame).
   * Returns null while the scene has not been measured yet (width <= 0),
   * in which case the previous geometry must be kept untouched.
   * POSITION ONLY - it never changes a size; the inclination NEVER touches
   * the radii, it only ORIENTS the common plane (see calculateOrbitPoint).
   */
  compute(input: OrbitGeometryInput): OrbitGeometryResult | null {
    const w = input.width;
    const h = input.height;
    if (w <= 0) return null;

    // ==========================================================
    // THE ONE ORIGIN of the whole orbital system: the centre of
    // .v3d-scene - which is exactly where the Sun sits (the template
    // pins the Sun and every body at 50% / 50% of the stage).
    // calculateOrbitPoint() works in ABSOLUTE stage coordinates
    // around this origin, so every planet shares it; the planet
    // transform subtracts it again because the DOM adds the centre
    // exactly once. The Sun needs no orbiting state at all: it never
    // leaves the origin, and there is no second centre anywhere (no
    // ring centre, no per-half correction).
    // ==========================================================
    this.centerX = w / 2;
    this.centerY = h > 0 ? h / 2 : w * 0.31;

    // Sizes are already resolved by the component (applyVisualSizes +
    // fitContentToPlanets): here they are only turned into positions, so a
    // size change can never move a body - it only redraws the ring it
    // travels on.
    const planetRadii = input.planetRadii;
    const n = planetRadii.length;
    if (this.radii.length !== n) this.radii = new Float64Array(n);
    let radius = firstOrbitRadius(input.sunRadius, planetRadii, w);
    for (let i = 0; i < n; i++) {
      this.radii[i] = radius;
      if (i < n - 1) {
        radius += bandGap(i, planetRadii);
      }
    }
    const outerR = this.radii[n - 1];

    // ORIENTATION of the ONE orbital plane: the circle of every orbit is
    // projected with cos(V3D_ORBIT_PLANE_ANGLE_DEG) on the screen's vertical
    // axis and with sin(...) on the depth axis. Both come from the SAME
    // manual angle and nothing else - no height budget, no viewport-dependent
    // flattening, no second inclination. The angle never touches a radius, a
    // size or a speed: it only ORIENTS the common plane (see
    // calculateOrbitPoint()).
    this.ellipseRatio = V3D_ORBIT_PLANE_TILT;
    this.depthFactor = V3D_ORBIT_PLANE_DEPTH;

    // Uniform fit scale: the full design is scaled to fit the real scene on
    // BOTH axes (width usually binds, the height takes over on short scenes).
    // Both terms are (available half-extent around the origin) / (design
    // half-extent); before the height has been measured, only the width binds.
    // This ONE scale is what keeps the composition inside the scene - the
    // plane angle is never used to shrink anything.
    const outerBody = planetRadii[n - 1] * V3D_MAX_SCALE;
    const halfW = outerR + outerBody + V3D_STAGE_PADDING;
    const halfH = outerR * this.ellipseRatio + outerBody + V3D_STAGE_PADDING;
    const fit = Math.min(this.centerX / halfW, h > 0 ? this.centerY / halfH : 1);
    this.fit = fit;

    // NO orbit traces are drawn in this step: the planet movement below is the
    // only orbital geometry that exists. STEP 2 samples the visible traces
    // from calculateOrbitPoint() - the very function the planets move on - so
    // a trace and its trajectory can never disagree.
    return { fit };
  }

  /**
   * SINGLE ORBIT-POINT SOURCE OF TRUTH - the planet orbital movement.
   *
   * ONE orbital plane for all six planets (V3D_ORBIT_PLANE_ANGLE_DEG).
   * `angle` = theta is the body's angle INSIDE that plane and its orbit
   * radius in the plane is `radii[index]` - the inclination changes neither
   * of them:
   *
   *   1. position in the orbital plane (the real circle the body travels)
   *        orbitalX = cos(theta) * radius
   *        orbitalY = sin(theta) * radius
   *   2. that plane rotated around the horizontal X axis through the ONE
   *      origin, lifted into ABSOLUTE stage coordinates
   *        x     = centerX + orbitalX
   *        y     = centerY + orbitalY * cos(angleRad)   (screen position)
   *        depth = orbitalY * sin(angleRad)              (front/back, px)
   *   3. the SAME depth normalised to 0 (far / back) .. 1 (near / front): the
   *      ONLY input of the layering model (z-index, near/far scale, opacity),
   *      so the ordering comes from this very theta - never from a second
   *      calculation.
   *
   * SAME origin for everything (centerX / centerY = the .v3d-scene centre =
   * the Sun centre), SAME radius (radii) and SAME inclination (ellipseRatio /
   * depthFactor = exactly cos / sin of the ONE manual angle). There is NO
   * front-dip, no artificial Y offset and no per-half special case. STEP 2
   * samples the visible orbit traces from this very function, so a trace and
   * its trajectory are the same curve by construction.
   */
  calculateOrbitPoint(index: number, angle: number): OrbitPoint {
    const radius = this.radii[index];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // 1. the orbital plane itself: a circle of this radius around the origin.
    const orbitalX = cos * radius;
    const orbitalY = sin * radius;
    // 2. that plane rotated around the horizontal X axis through the origin:
    //    cos(angleRad) projects onto the screen, sin(angleRad) becomes depth.
    const x = this.centerX + orbitalX;
    const y = this.centerY + orbitalY * this.ellipseRatio; // * cos(angleRad)
    const depth = orbitalY * this.depthFactor; // * sin(angleRad) - for STEP 2
    // 3. the same depth normalised for the layering model, 0..1:
    //    depth / radius = sin(theta) * sin(angle), so the mapping is
    //    independent of the orbit size (and stays finite even before the scene
    //    has been measured).
    const depth01 = (sin * this.depthFactor + 1) / 2;
    return { x, y, depth, depth01 };
  }
}

/** One point of the projected orbital plane (absolute design coordinates). */
export interface OrbitPoint {
  /** Absolute stage X (design px): centerX + cos(theta) * radius. */
  readonly x: number;
  /** Absolute stage Y (design px): centerY + sin(theta) * radius *
      cos(plane angle). */
  readonly y: number;
  /** Out-of-plane offset of the very same point, in design px:
      sin(theta) * radius * sin(plane angle). Negative = behind the plane,
      positive = in front. Kept available for STEP 2: the orbit trace is
      generated from the projected X / Y, and this depth explains the
      front/back relationship of the trace. */
  readonly depth: number;
  /** `depth` normalised to 0 (far / back) .. 1 (near / front) - the ONLY
      input of the layering model (z-band, near/far scale, opacity). */
  readonly depth01: number;
}

/** What the component hands to a geometry pass (all plain numbers). */
export interface OrbitGeometryInput {
  /** Measured scene width in px. */
  readonly width: number;
  /** Measured scene height in px. */
  readonly height: number;
  /** Position-layer Sun radius (design px, already resolved by the sizes pass). */
  readonly sunRadius: number;
  /** Position-layer planet radii (design px, already resolved). */
  readonly planetRadii: ArrayLike<number>;
}

/** What a geometry pass produces for the component.
    STEP 2 will extend this result with the sampled orbit traces (taken from
    calculateOrbitPoint(), the very function the planets move on). */
export interface OrbitGeometryResult {
  /** Uniform fit scale (design space -> measured scene). */
  readonly fit: number;
}