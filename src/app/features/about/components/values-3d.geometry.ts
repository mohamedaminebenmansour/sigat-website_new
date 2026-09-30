/**
 * ============================================================
 * MANUAL ORBIT PLANE ANGLE  <-- THE ONE KNOB TO CHANGE
 * ============================================================
 *
 * This controls ONLY the inclination of the common orbital plane:
 * the plane all six planets share, rotated around the horizontal X
 * axis through the exact centre of the Sun.
 *
 * 0°:
 *     Orbital plane is aligned with the screen.
 *
 * 20°:
 *     Small inclination.
 *
 * 35°:
 *     Medium inclination.
 *
 * 45°:
 *     Strong inclination.
 *
 * 60°:
 *     Very strong inclination.
 *
 * IMPORTANT:
 *     Changing this value MUST NOT change:
 *
 *       - Sun size
 *       - Planet size
 *       - Orbit radius
 *       - Distance between orbits
 *       - Planet speed
 *       - Self rotation
 *       - Content size
 *
 * It changes ONLY the orientation of the common orbital plane.
 *
 * Mathematically:
 *     radius = constant          (never multiplied by this angle)
 *     angle  = orientation only
 *
 * HOW IT PROPAGATES (nothing else needs manual editing):
 *
 *        ANGLE
 *          │
 *          ▼
 *   orbital plane            V3D_ORBIT_PLANE_TILT  = cos(angle)
 *          │
 *    ┌─────┴─────┐
 *    ▼           ▼
 * planets      orbit traces  (traces are RESAMPLED from
 *    │                         calculateOrbitPoint() on every
 *    ▼                         geometry pass, never static SVG)
 * front/back depth          V3D_ORBIT_PLANE_DEPTH = sin(angle)
 *    │
 *    ▼
 * projected screen Y        y = originY + sin(theta) * radius * cos(angle)
 *
 * HEIGHT NOTE (not a second knob): a rounder ring needs more height,
 * so on a short (wide) scene the projection is only ever FLATTENED
 * (bounded by V3D_ELLIPSE_RATIO_MIN) instead of scaling the whole
 * composition down. Such a viewport reports it in the console
 * (cappedByHeight / effectiveAngleDeg) and renders the requested
 * angle wherever the scene has the height for it - sizes, radii and
 * distances are never touched by this.
 */
export const V3D_ORBIT_PLANE_ANGLE_DEG = 45;

/** The same inclination in radians - computed ONCE, at module load. */
const orbitPlaneAngleRad = (V3D_ORBIT_PLANE_ANGLE_DEG * Math.PI) / 180;

/** Screen projection of the inclined plane: the vertical semi-axis of a
    projected orbit, i.e. radius * cos(inclination). One design unit = one
    px before the uniform --v3d-fit scale. */
export const V3D_ORBIT_PLANE_TILT = Math.cos(orbitPlaneAngleRad);

/** Out-of-plane component of the same inclination, i.e. radius *
    sin(inclination) - it becomes the depth (z-order + near/far scale) of a
    body. Never an extra tuning value: see calculateOrbitPoint(). */
export const V3D_ORBIT_PLANE_DEPTH = Math.sin(orbitPlaneAngleRad);

/** Lower bound of the PROJECTED tilt on short (wide) scenes. A flatter tilt
    uses less height and more width - exactly what a wide laptop scene needs
    to show the composition as large as possible, so the height fit can
    never flatten the projected plane further than this. Raise it (e.g. 0.32)
    if you prefer rounder rings on short scenes (the composition then renders
    smaller, because the scene height starts to limit it). */
export const V3D_ELLIPSE_RATIO_MIN = 0.2;

/** Angular step of the visible orbit trace: every ring is sampled at
    V3D_TRACE_SEGMENTS points of the SAME calculateOrbitPoint() the planets
    use (2*PI / 256 = 1.4 deg). One point per ~0.0014 * radius, i.e. a chord
    that deviates from the exact curve by less than 0.1px even on the widest
    scene (2560px: 0.33px at 128 points -> 0.08px at 256). Resize-only cost. */
export const V3D_TRACE_SEGMENTS = 256;

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
 * compute() turns (measured scene, body sizes) into: the ONE origin, the six
 * orbit radii, the projected tilt + its depth factor, the uniform fit scale
 * and the sampled traces. It is called on init + resize ONLY (never per
 * frame) and reproduces the approved position model verbatim:
 *
 *   R1     = sunRadius + 2*sunRadius*SUN_TO_FIRST_ORBIT_GAP_RATIO
 *            + planetRadius_1 * V3D_MAX_SCALE        (depth headroom)
 *   gap_i  = V3D_BAND_GAP_RATIO * (radius_i + radius_i+1) / 2
 *   R_i+1  = R_i + gap_i
 *   ratio  = min(cos(angle), max(V3D_ELLIPSE_RATIO_MIN, height budget))
 *   depth  = sqrt(1 - ratio^2)          (the SAME inclination, never a 2nd)
 *   fit    = ONE uniform scale fitting the composition on BOTH axes
 *
 * calculateOrbitPoint() is the SINGLE mathematical source of truth: the
 * traces are sampled from it inside compute(), the planets read it every
 * frame - so a ring and its trajectory are the same curve by construction,
 * around the SAME centre, with the SAME radii and the SAME inclination.
 */
export class Values3dGeometry {
  /** THE GEOMETRY ROOT - the centre of the scene (= the Sun's centre). */
  originX = 0;
  originY = 0;

  /** The six orbit radii (design px), re-laid-out by compute(). */
  radii: Float64Array = new Float64Array(0);

  /** Live PROJECTION TILT of the ONE orbital plane: cos(inclination),
      flattened by the short-scene height budget (never rounded further). */
  ellipseRatio = V3D_ORBIT_PLANE_TILT;

  /** Live OUT-OF-PLANE factor of that very same inclination (depth axis):
      sin = sqrt(1 - cos^2), so screenOffsetY^2 + depth^2 = radius^2 - all
      six planets stay on circles of ONE common plane. */
  depthFactor = V3D_ORBIT_PLANE_DEPTH;

  /** Current uniform fit scale (design space -> real scene). */
  fit = 1;

  /** The requested cos(inclination) of the knob, before any height cap. */
  readonly requestedTilt = V3D_ORBIT_PLANE_TILT;

  /** True when the scene height flattened the requested tilt. */
  get cappedByHeight(): boolean {
    return this.ellipseRatio < this.requestedTilt - 1e-9;
  }

  /** The inclination actually rendered at this viewport, in degrees. */
  get effectiveAngleDeg(): number {
    const clamped = Math.min(1, Math.max(-1, this.ellipseRatio));
    return (Math.acos(clamped) * 180) / Math.PI;
  }

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
    // around this root: the trace canvas maps them 1:1, while the
    // planet transform subtracts the root again because the DOM
    // adds the centre exactly once. The Sun needs no orbiting state
    // at all: it never leaves the origin.
    // ==========================================================
    const centerX = w / 2;
    const centerY = h > 0 ? h / 2 : w * 0.31;
    this.originX = centerX;
    this.originY = centerY;

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

    // PROJECTION of the ONE orbital plane (V3D_ORBIT_PLANE_ANGLE_DEG): the
    // circle of every orbit is projected with cos(inclination) on its vertical
    // axis. The height budget may only FLATTEN that projection (bounded by
    // V3D_ELLIPSE_RATIO_MIN), never round it further - so the approved
    // composition keeps its scale on short scenes and the inclination can
    // never make the design smaller.
    const outerBody = planetRadii[n - 1] * V3D_MAX_SCALE;
    // Vertical budget: the ring's vertical extent + the body on the outer
    // band + the stage padding must fit the scene height above/below the
    // origin, so the projection uses the available height instead of
    // overflowing it.
    const halfHScene = centerY - V3D_STAGE_PADDING - outerBody;
    const heightFitRatio = halfHScene / outerR;
    this.ellipseRatio = Math.min(
      V3D_ORBIT_PLANE_TILT,
      Math.max(V3D_ELLIPSE_RATIO_MIN, heightFitRatio),
    );
    // Depth comes from the VERY SAME inclination that is projected (never a
    // second value): sin(inclination) = sqrt(1 - cos(inclination)^2).
    this.depthFactor = Math.sqrt(Math.max(0, 1 - this.ellipseRatio * this.ellipseRatio));

    // Uniform fit scale: the full design is scaled to fit the real scene on
    // BOTH axes (width usually binds, the height takes over on short scenes).
    // Both terms are (available half-extent around the origin) / (design
    // half-extent); before the height has been measured, only the width binds.
    const halfW = outerR + outerBody + V3D_STAGE_PADDING;
    const halfH = outerR * this.ellipseRatio + outerBody + V3D_STAGE_PADDING;
    const fit = Math.min(centerX / halfW, h > 0 ? centerY / halfH : 1);
    this.fit = fit;

    // Visible rings: SAMPLED from calculateOrbitPoint() - the exact function
    // the rAF loop uses for the planets - so a ring and its trajectory are the
    // same curve by construction (same origin, radius, tilt and depth).
    // calculateOrbitPoint() returns ABSOLUTE stage coordinates, so the canvas
    // below IS the outer ring's bounding box in that same space: the template
    // pins it at (left, top) with a 1:1 viewBox and the sampled points land
    // exactly where the planets actually are - no re-centring, no scaling.
    const traceHalfW = outerR;
    const traceHalfH = outerR * this.ellipseRatio;
    const space: OrbitSpace = {
      viewBox: `${this.originX - traceHalfW} ${this.originY - traceHalfH} ${traceHalfW * 2} ${traceHalfH * 2}`,
      width: traceHalfW * 2,
      height: traceHalfH * 2,
      left: this.originX - traceHalfW,
      top: this.originY - traceHalfH,
    };
    const paths: OrbitTracePath[] = [];
    for (let i = 0; i < n; i++) {
      const points: string[] = [];
      for (let j = 0; j < V3D_TRACE_SEGMENTS; j++) {
        const angle = (j / V3D_TRACE_SEGMENTS) * Math.PI * 2;
        const point = this.calculateOrbitPoint(i, angle);
        points.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
      }
      paths.push({ index: i, d: `M ${points.join(' L ')} Z` });
    }
    return { space, paths, fit };
  }

  /**
   * SINGLE ORBIT-POINT SOURCE OF TRUTH (planets AND traces).
   *
   * ONE orbital plane for all six planets (V3D_ORBIT_PLANE_ANGLE_DEG).
   * `angle` is the body's angle INSIDE that plane and `radius` its orbit
   * radius in the plane, which the inclination never changes:
   *
   *   1. orbital-plane coordinates - the real circle the body travels
   *        orbitalX = cos(angle) * radius
   *        orbitalY = sin(angle) * radius
   *   2. the plane rotated around the horizontal X axis through the origin,
   *      lifted into ABSOLUTE stage coordinates around the geometry root
   *      (the trace canvas maps them 1:1; the planet transform subtracts the
   *      root again because the DOM pins every body at 50% / 50%)
   *        x        = originX + orbitalX
   *        y        = originY + orbitalY * cos(inclination)
   *        depth    = orbitalY * sin(inclination)
   *   3. the depth normalised to 0 (far / back) .. 1 (near / front) for the
   *      z-band, near/far scale and opacity model
   *
   * SAME origin for everything (the .v3d-scene centre = the Sun centre),
   * SAME radius (radii) and SAME inclination (ellipseRatio / depthFactor).
   * There is NO front-dip, no front offset and no per-half special case:
   * the front/back relationship comes ONLY from the inclination of the
   * plane, so distance(planet, ring) stays ~0 for the full 360 degrees.
   */
  calculateOrbitPoint(index: number, angle: number): OrbitPoint {
    const radius = this.radii[index];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // 1. the orbital plane itself: a circle of this radius around the origin.
    const orbitalX = cos * radius;
    const orbitalY = sin * radius;
    // 2. that plane rotated around the horizontal X axis through the origin.
    //    Its out-of-plane component is orbitalY * sin(inclination), which is
    //    consumed by the depth below (never an extra tuning value).
    const x = this.originX + orbitalX;
    const y = this.originY + orbitalY * this.ellipseRatio; // = orbitalY * cos(inclination)
    // 3. depth of the z-order / scale / opacity model, 0..1:
    //    planeDepth / radius = sin(angle) * sin(inclination), so the mapping is
    //    independent of the orbit size (and stays finite even before the scene
    //    has been measured).
    const depth = (sin * this.depthFactor + 1) / 2;
    return { x, y, depth };
  }
}

/** Absolute-space geometry of the orbit-trace SVG canvas (design px). */
export interface OrbitSpace {
  /** viewBox spanning the fitted design extent; its 0,0 IS the geometry root. */
  readonly viewBox: string;
  /** 1:1 pixel size of the canvas (identical to the viewBox size). */
  readonly width: number;
  readonly height: number;
  /** Canvas offset inside the stage, so the viewBox maps 1:1 with no scaling. */
  readonly left: number;
  readonly top: number;
}

/** One sampled orbit trace (absolute design coordinates). */
export interface OrbitTracePath {
  readonly index: number;
  readonly d: string;
}

/** One point of the projected orbital plane (absolute design coordinates). */
export interface OrbitPoint {
  readonly x: number;
  readonly y: number;
  /** Depth normalised 0 (far/back) .. 1 (near/front) for the z-band,
      near/far scale and opacity model. */
  readonly depth: number;
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

/** What a geometry pass produces for the component. */
export interface OrbitGeometryResult {
  /** Absolute trace canvas placement (viewBox + 1:1 size + offset). */
  readonly space: OrbitSpace;
  /** The six sampled traces (dashed flag is presentation - added by the component). */
  readonly paths: readonly OrbitTracePath[];
  /** Uniform fit scale (design space -> measured scene). */
  readonly fit: number;
}