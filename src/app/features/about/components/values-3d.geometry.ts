/**
 * ============================================================
 * MASTER ANGLE - INCLINATION OF THE COMMON ORBITAL PLANE
 * ============================================================
 *
 * Change V3D_ORBIT_PLANE_ANGLE_DEG to change the common orbital-plane
 * inclination: how the six planet trajectories are projected onto the
 * screen.
 *
 * This value changes:
 *   - projected planet Y positions
 *   - front/back depth (and therefore the layering)
 *   - orbit-trace shape
 *   - visual overlap relationships (how close a planet passes to the Sun)
 *
 * This value MUST NOT change:
 *   - planet size
 *   - Sun size
 *   - orbital radius
 *   - orbital speed
 *   - content size
 *
 * DO NOT MODIFY PLANET RADIUS OR SIZE TO SOLVE OVERLAP.
 * The angle automatically updates:
 *   - planet projected positions
 *   - planet depth
 *   - orbit traces
 *   - front/back relationship
 * The angle does NOT change:
 *   - planet size
 *   - Sun size
 *   - orbital speed
 *   - orbital radius
 *
 * IMPORTANT: test this value in small increments (30 / 35 / 40 / 45 / 50).
 *
 * GEOMETRIC MEANING (the ONE mathematically consistent reading):
 * the plane is rotated around the horizontal X axis through the exact
 * centre of the Sun, so cos(angle) is the screen projection of the orbital
 * radius and sin(angle) becomes the depth - a single, exact interpretation:
 *     screenOffsetY = sin(theta) * radius * cos(angle)
 *     depth         = sin(theta) * radius * sin(angle)
 * so the closest a planet ever comes to the Sun centre is
 *     orbitRadius * cos(angle).
 *   0  = one extreme       (plane aligned with the screen: full circles, no
 *                           depth - the front/back order degenerates)
 *   90 = the other extreme (plane seen edge on: a horizontal line, the whole
 *                           orbital radius becomes depth)
 *
 * WHY THE DEFAULT IS 40 (measured, never guessed):
 * a SMALLER angle keeps every planet farther from the Sun on screen (less
 * Sun content covered while a planet passes in front) but needs MORE height,
 * which the single uniform fit scale absorbs. Measured over a full
 * revolution, all four screen categories and FR / EN / AR:
 *     45 -> worst 16.8% of the Sun's readable content zone covered, 13% of
 *           the Sun text block (the last description line was hidden)
 *     40 -> worst 12.4% of the content zone, 7.6% of the text block (Arabic
 *           only), desktop composition scale -6%
 *     35 -> worst  8.9% / 3.3%, scale -11%
 *     30 -> worst  6.4% / 0.7%, scale -16%
 * Mobile and tablet are WIDTH-bound, so they keep their exact scale at every
 * angle. Nothing here ever changes a size, a radius or a speed: the angle
 * only ORIENTS the plane, and the fit scale absorbs the projection. The
 * running value is audited in dev by Values3dComponent
 * (validateSunContentOverlap -> "[values-3d] Sun content overlap: ...").
 *
 * HOW IT PROPAGATES (nothing else needs manual editing):
 *
 *        ANGLE
 *          |
 *          v
 *   orbital plane       V3D_ORBIT_PLANE_TILT  = cos(angle)  -> screen Y
 *                       V3D_ORBIT_PLANE_DEPTH = sin(angle)  -> depth
 *          |
 *          v
 *   calculateOrbitPoint()  <- the SINGLE mathematical source of truth
 *          |                   (read by the planet movement every frame AND
 *          |                    sampled for the six visible orbit traces)
 *          v
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

/** The same angle in RADIANS - derived ONCE from the knob above. This is the
    value the shared calculateOrbitPoint() takes, so changing
    V3D_ORBIT_PLANE_ANGLE_DEG changes, in one go and with no other edit:
      - the planet screen Y          (y = centerY + orbitalY * cos(angle)),
      - the planet depth + layering  (depth = orbitalY * sin(angle)),
      - the projected orbit traces   (sampled from the SAME function). */
export const V3D_ORBIT_PLANE_ANGLE_RAD = (V3D_ORBIT_PLANE_ANGLE_DEG * Math.PI) / 180;

/** Screen projection of the inclined plane: the vertical semi-axis of a
    projected orbit, i.e. radius * cos(angle). One design unit = one px
    before the uniform --v3d-fit scale. It is EXACTLY cos of the knob above:
    there is no viewport-dependent flattening any more. */
export const V3D_ORBIT_PLANE_TILT = Math.cos(V3D_ORBIT_PLANE_ANGLE_RAD);

/** Out-of-plane component of the very same inclination, i.e. radius *
    sin(angle) - it becomes the depth (front/back z-order, near/far scale and
    opacity) of a body. Never a second tuning value: see
    calculateOrbitPoint(). */
export const V3D_ORBIT_PLANE_DEPTH = Math.sin(V3D_ORBIT_PLANE_ANGLE_RAD);

/** Angular step of the visible orbit trace: every trace is sampled at
    V3D_TRACE_SAMPLES points of the SAME calculateOrbitPoint() the planets
    move on (2*PI / 256 = 1.4 deg). On the widest scene the resulting chord
    deviates from the exact projected curve by less than 0.1px, and 45deg
    steps land exactly on sampled vertices (32/256 of a turn) - which the
    dev-time coincidence audit uses to prove that every trace passes through
    its planet. Resize-only cost: the traces are static geometry, NEVER
    evaluated per frame. */
export const V3D_TRACE_SAMPLES = 256;

/**
 * Optional visual composition offset for the Sun / orbital origin.
 *
 * It moves the COMPLETE orbital system together - the Sun, the six orbits,
 * the orbit traces, the planet bodies, the halo and the dots - so every
 * relative geometry (each distance, radius and overlap) stays mathematically
 * IDENTICAL. It never fakes orbital geometry and never changes an orbital
 * radius: it only lets the whole system sit more comfortably inside the
 * component.
 *
 * Use it only if the composition needs it:
 *   - keep every planet visible
 *   - keep the Sun visible
 *   - prevent clipping at the left / right / top / bottom edges
 *   - improve the composition balance
 *   - protect the readable Sun content
 *
 * It is applied to the ONE origin (compute()) AND published to the DOM
 * anchors that are pinned at 50% / 50% of the stage, so the planets keep
 * orbiting the Sun exactly. Containment stays guaranteed: the uniform fit
 * scale is computed against the REAL room left on each side, so moving the
 * origin can only make the composition smaller - never clipped.
 *
 * 0 / 0 = not needed. Measured: the default composition already keeps the
 * Sun and all six orbits (bodies included) fully inside the component on
 * mobile, tablet, desktop and large desktop.
 */
export const V3D_SUN_OFFSET_X = 0;
export const V3D_SUN_OFFSET_Y = 0;

/**
 * ============================================================
 * ORBITAL SPACING - GEOMETRIC DISTANCES, NOT CSS MARGINS
 * ============================================================
 * Everything below lives in the SAME design space as the orbit radii and is
 * measured from the ONE origin (the Sun centre) on the SAME orbital plane.
 * These are geometric distances: the planets move in 3D, so separation can
 * only come from the orbital radii themselves - never from CSS margins.
 *
 * SUN -> FIRST PLANET (must never visually merge, at ANY orbital angle:
 * in front, behind or at the side). Implemented by firstOrbitRadius(),
 * which also accounts for the projection (R * cos(plane angle)) and for the
 * difference between the position layer and the RENDERED body sizes.
 *
 * NEIGHBOUR BANDS 1 -> 2 -> 3 -> 4 -> 5 -> 6: each radial step is
 *     R(i+1) = R(i) + spacingScale * (1 + V3D_BAND_VISUAL_GAP_RATIO)
 *                           * V3D_PLANET_VISUAL_HEADROOM * (p_i + p_i+1)
 * i.e. the step accounts for BOTH rendered bodies plus a visual gap, times
 * the responsive spacing scale. Sun -> Planet 1 is NOT controlled by the
 * band values, and the band values do not control the Sun.
 *
 * RESPONSIVE: V3D_SPACING_SCALE_BY_CATEGORY is the single degradation dial
 * (compact on phones, larger on desktops). Because the whole design is
 * re-normalized to the measured scene, gaps AND bodies always scale
 * together - there is no per-breakpoint geometry.
 * ============================================================ */

/**
 * Minimum visual gap between the Sun's outer edge
 * and the first planet's orbital path/body.
 *
 * Unit: FRACTION OF THE SUN'S DIAMETER (0.28 = 28% of the Sun's diameter
 * of clear space between the Sun's edge and planet 1's depth-scaled disc).
 *
 * Increase this value to move the first orbit farther from the Sun.
 *
 * This controls DISTANCE only.
 * It does not change Sun or planet size.
 */
export const V3D_SUN_TO_FIRST_PLANET_GAP = 0.28;

/** Extra clear space between consecutive bands, as a fraction of
    (p_i + p_i+1). `bandGap(i) = spacingScale * (1 + ratio) * HEADROOM *
    (p_i + p_i+1)`, so `ratio = 0` still separates the two rendered bodies
    edge-to-edge and this value adds the professional breathing room on top.
    This controls DISTANCE only. */
export const V3D_BAND_VISUAL_GAP_RATIO = 0.1;

/** Responsive spacing scale, one entry per screen category (0 mobile /
    1 tablet / 2 PC / 3 large desktop) - THE degradation dial (#8):
    1.0 = full literal separation (bodies never touch even when aligned),
    ~0.29 = exactly the historical band separation, lower = below it.
    Shipped values are the MEASURED balance (readability comes first): the
    spacing audit showed that a bigger scale eats the width budget and
    shrinks the spheres, which the content-fit then answers by shrinking the
    text - so these sit at the point where every category keeps readable
    bodies AND the bands still improve (roughly 1.0x (mobile/tablet) to
    1.6x (large desktop) the historical separation). Raise toward 1 for
    maximum separation (smaller planets); lower if the content audit warns.
    Clamped to [V3D_SPACING_MIN_SCALE, 1] inside bandGap(), so this table
    can never produce an illegal value. */
export const V3D_SPACING_SCALE_BY_CATEGORY = [0.3, 0.3, 0.4, 0.45];

/** Hard floor of the responsive spacing scale (see above). */
export const V3D_SPACING_MIN_SCALE = 0.4;

/** RENDERED-vs-POSITION size budget of the Sun: the geometry consumes the
    smaller position-layer radii, while the Sun renders up to this factor
    bigger (V3D_SUN_RADIUS wish). Sizing the first orbit for this budget
    turns the Sun -> Planet 1 clearance into a guarantee for the RENDERED
    body. Enforced in Values3dComponent.growVisualBodies(). */
export const V3D_SUN_VISUAL_HEADROOM = 1.6;

/** Same budget for the planets. IMPORTANT (spacing audit): the value must
    stay BELOW the point where the global orbit cap (maxPlanetRadiusForOrbit)
    becomes the smallest ceiling, otherwise every planet clamps to the SAME
    radius and the configured per-planet size relationship is lost (the six
    values must keep their ratios). At 1.6 the per-planet budget binds first
    (measured rendered/position was ~1.66 at STEP 1 - the few percent over
    the budget are simply trimmed). Enforced in
    Values3dComponent.growVisualBodies() so the guarantee used by
    firstOrbitRadius() cannot drift. */
export const V3D_PLANET_VISUAL_HEADROOM = 1.6;

/** Safe edge margin between the composition and the boundary of the design
    space, expressed as a FRACTION of the measured scene width (the design is
    authored to fill that width, so the margin scales with it). It is bounded
    so the margin stays a real one on phones (V3D_STAGE_PADDING_MIN) and a
    professional one on wide screens (V3D_STAGE_PADDING_MAX): the outermost
    planet edge can therefore never touch the component boundary at any
    breakpoint, whatever the composition scale is.
    Tune V3D_STAGE_PADDING_RATIO to change the breathing room everywhere. */
export const V3D_STAGE_PADDING_RATIO = 0.025;
export const V3D_STAGE_PADDING_MIN = 10;
export const V3D_STAGE_PADDING_MAX = 48;

/** The safe edge margin (logical px) for a measured scene width. */
export function stagePadding(sceneWidth: number): number {
  if (!(sceneWidth > 0)) return V3D_STAGE_PADDING_MIN;
  return Math.min(
    V3D_STAGE_PADDING_MAX,
    Math.max(V3D_STAGE_PADDING_MIN, sceneWidth * V3D_STAGE_PADDING_RATIO),
  );
}

/** Near/far visual scale range of the depth model (0 far .. 1 near):
    smooth and deliberately modest. Used by the geometry (orbit headroom,
    fit extent) and by the component (depth -> scale mapping), so the pair
    lives here as ONE source. */
export const V3D_MIN_SCALE = 0.86;
export const V3D_MAX_SCALE = 1.08;

/** INVARIANT: the Sun must stay at least this factor bigger than the largest
    planet (rendered sizes, depth-scaled at the worst orbital angle). Used by
    the geometry helpers below AND by the component's size caps - exported
    from ONE place so the two can never disagree. */
export const V3D_SUN_DOMINANCE = 1.25;

/** FIRST ORBIT RADIUS - the ONE Sun -> Planet 1 distance formula. Lives here
    so the geometry, the component's rendered-size caps and the dev validator
    can never disagree about what R1 means:

        R1 = ( sun * (1 + 2*GAP) * SUN_HEADROOM
             + planet1 * V3D_MAX_SCALE * PLANET_HEADROOM ) / TILT

    WHY THE HEADROOMS: this function consumes the POSITION-layer radii (the
    small design anchor the content fit grows from), while the body that is
    RENDERED may be up to the headroom factor bigger (the visual size knobs).
    Sizing R1 for that budget makes the clearance hold for the rendered
    bodies - and growVisualBodies() enforces the same headrooms as caps, so
    the guarantee cannot drift.

    WHY / TILT: the screen distance of a planet at angle theta is
    R * sqrt(cos^2(theta) + tilt^2 * sin^2(theta)), minimal at the vertical
    extremes (R * cos(plane angle)). Dividing by V3D_ORBIT_PLANE_TILT makes
    the configured gap hold at EVERY orbital angle - in front, behind and at
    the side - using the ONE plane angle (no second angle exists).

    `fallbackWidth` only guards the pre-measurement state (sunRadius = 0):
    the historical behaviour was 0.2 * sceneWidth. */
export function firstOrbitRadius(
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  fallbackWidth = 0,
): number {
  if (sunRadius <= 0) return 0.2 * fallbackWidth;
  return (
    ( sunRadius * (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) * V3D_SUN_VISUAL_HEADROOM +
      planetRadii[0] * V3D_MAX_SCALE * V3D_PLANET_VISUAL_HEADROOM ) /
    V3D_ORBIT_PLANE_TILT
  );
}

/** RADIAL STEP between orbit i and orbit i+1 - the rendered-size form of
        R(next) >= R(current) + p_current + p_next + visual gap
    Both bodies it separates are accounted for (x HEADROOM so the step
    covers the RENDERED radii), the visual gap is added on top, and the
    responsive spacing scale (default 1 = full separation) shrinks all of it
    together on viewports that cannot afford the full spacing - geometric
    distance in design px, never a CSS margin. */
export function bandGap(
  index: number,
  planetRadii: ArrayLike<number>,
  spacingScale = 1,
): number {
  const scale = Math.min(1, Math.max(V3D_SPACING_MIN_SCALE, spacingScale));
  return (
    scale *
    (1 + V3D_BAND_VISUAL_GAP_RATIO) *
    V3D_PLANET_VISUAL_HEADROOM *
    (planetRadii[index] + planetRadii[index + 1])
  );
}

/** Half extent (design px) of the composition with the GIVEN radii:
    the outermost ring + the body that rides it. Used to normalize the
    manual radii against the measured scene width. `spacingScale` is the
    responsive spacing dial of the CURRENT screen category and must be the
    same value the geometry pass uses, so the normalization and compute()
    see one identical composition. */
export function designHalfExtent(
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  spacingScale = 1,
  fallbackWidth = 0,
): number {
  let radius = firstOrbitRadius(sunRadius, planetRadii, fallbackWidth);
  for (let i = 0; i < planetRadii.length - 1; i++) {
    radius += bandGap(i, planetRadii, spacingScale);
  }
  return radius + planetRadii[planetRadii.length - 1] * V3D_MAX_SCALE;
}

/** The Sun's own contribution to R1, in POSITION units - the exact mirror of
    the Sun term inside firstOrbitRadius(), so absorbGrowthIntoSun() can peel
    it out of the design extent WITHOUT a second copy of the formula. */
export function sunClearanceFactor(): number {
  return (
    ((1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) * V3D_SUN_VISUAL_HEADROOM) /
    V3D_ORBIT_PLANE_TILT
  );
}

/** Largest RENDERED planet radius that orbit 1 can afford, projection- and
    gap-aware: derived from
        TILT * R1 >= visSun * (1 + 2*GAP) + V3D_MAX_SCALE * visPlanet
    together with the dominance floor visSun >= DOMINANCE * visPlanet.
    Single source for the component's planet cap - it can never disagree
    with firstOrbitRadius(). */
export function maxPlanetRadiusForOrbit(r1: number): number {
  const denominator =
    V3D_MAX_SCALE * (V3D_SUN_DOMINANCE * (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) + 1);
  return Math.max(0, (r1 * V3D_ORBIT_PLANE_TILT) / denominator - 4);
}

/** Largest RENDERED Sun radius that orbit 1 can afford (same derivation,
    solved for the Sun). Single source for the component's Sun wish cap. */
export function maxSunRadiusForOrbit(r1: number): number {
  const denominator = 1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP + 1 / V3D_SUN_DOMINANCE;
  return Math.max(0, (r1 * V3D_ORBIT_PLANE_TILT) / denominator);
}

/**
 * ============================================================
 * THE ONE ORBITAL TRAJECTORY - SHARED BY THE PLANETS *AND* THE TRACES
 * ============================================================
 *
 * Pure, DOM-free, stateless. The SAME call produces
 *   - the position of a planet, every frame (theta = that planet's angle), and
 *   - every sampled point of the visible orbit traces (theta = 0 .. 2π),
 * which is the whole point: there is exactly ONE trajectory, so a trace and
 * the planet that rides it can never be computed differently.
 *
 *   1. position inside the orbital plane (the real circle the body travels)
 *        orbitalX = cos(theta) * radius
 *        orbitalY = sin(theta) * radius
 *   2. that plane rotated around the horizontal X axis through the ONE origin
 *      (centerX / centerY = the Sun centre), in ABSOLUTE stage coordinates
 *        x     = centerX + orbitalX
 *        y     = centerY + orbitalY * cos(planeAngleRad)   (screen position)
 *        depth = orbitalY * sin(planeAngleRad)              (front/back, px)
 *   3. `depth` is returned RAW (out-of-plane px): the layering model
 *      normalises this very value (never a second depth), and any depth-aware
 *      use of a trace reads it from here too.
 *
 * `radius` is the ONLY radius source (Values3dGeometry.radii): a trace never
 * invents an orbit distance of its own.
 */
export function calculateOrbitPoint(
  radius: number,
  theta: number,
  centerX: number,
  centerY: number,
  planeAngleRad: number,
): OrbitProjection {
  const orbitalX = Math.cos(theta) * radius;
  const orbitalY = Math.sin(theta) * radius;
  return {
    x: centerX + orbitalX,
    y: centerY + orbitalY * Math.cos(planeAngleRad),
    depth: orbitalY * Math.sin(planeAngleRad),
  };
}

/** One point of the projected orbital plane (absolute design coordinates). */
export interface OrbitProjection {
  /** Absolute stage X (design px): centerX + cos(theta) * radius. */
  readonly x: number;
  /** Absolute stage Y (design px): centerY + sin(theta) * radius *
      cos(plane angle). */
  readonly y: number;
  /** Out-of-plane offset of the very same point, in design px:
      sin(theta) * radius * sin(plane angle). Negative = behind the plane,
      positive = in front. */
  readonly depth: number;
}

/**
 * THE ORBITAL GEOMETRY - one instance inside Values3dComponent.
 *
 * compute() turns (measured scene, body sizes) into: the ONE origin
 * (centerX / centerY), the six orbit radii, the projection of the ONE
 * orbital plane (its cos / sin), the uniform fit scale AND the six projected
 * orbit traces. It is called on init + resize ONLY (never per frame) and
 * reproduces the approved position model with the spacing rules of STEP 2:
 *
 *   R1     = ( sun * (1 + 2*V3D_SUN_TO_FIRST_PLANET_GAP) * SUN_HEADROOM
 *            + planetRadius_1 * V3D_MAX_SCALE * PLANET_HEADROOM )
 *            / V3D_ORBIT_PLANE_TILT        (holds at EVERY orbital angle)
 *   gap_i  = spacingScale * (1 + V3D_BAND_VISUAL_GAP_RATIO)
 *            * PLANET_HEADROOM * (radius_i + radius_i+1)
 *   R_i+1  = R_i + gap_i
 *   angle  = V3D_ORBIT_PLANE_ANGLE_RAD              (exactly the knob)
 *   tilt   = cos(angle)   (screen Y - never flattened by the viewport)
 *   depth  = sin(angle)   (the SAME angle, never a second value)
 *   fit    = ONE uniform scale fitting the composition on BOTH axes
 *
 * calculateOrbitPoint() (module-level pure function above) is the SINGLE
 * mathematical source of truth: the planets read it every frame AND the six
 * traces are SAMPLED from it here, so a trace and its planet are the same
 * curve by construction - same origin, same radius, same ONE angle. The
 * traces are static geometry (radius + origin + angle) and therefore need no
 * animation of their own: only theta moves.
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

  /** THE ONE manual angle in radians - the value handed to the shared
      calculateOrbitPoint(). Read by the planet movement every frame AND by
      the trace sampling in compute(), so both always describe the same
      orbit: changing the knob above changes the planet Y, the depth and the
      projected traces together, and nothing else. */
  readonly planeAngleRad = V3D_ORBIT_PLANE_ANGLE_RAD;

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
    // pins the Sun and every body at 50% / 50% of the stage, plus the
    // optional V3D_SUN_OFFSET_X / _Y published to those anchors).
    // calculateOrbitPoint() works in ABSOLUTE stage coordinates
    // around this origin, so every planet shares it; the planet
    // transform subtracts it again because the DOM adds the centre
    // exactly once. The Sun needs no orbiting state at all: it never
    // leaves the origin, and there is no second centre anywhere (no
    // ring centre, no per-half correction).
    // ==========================================================
    this.centerX = w / 2 + V3D_SUN_OFFSET_X;
    this.centerY = (h > 0 ? h / 2 : w * 0.31) + V3D_SUN_OFFSET_Y;

    // Sizes are already resolved by the component (applyVisualSizes +
    // fitContentToPlanets): here they are only turned into positions, so a
    // size change can never move a body - it only redraws the ring it
    // travels on.
    const planetRadii = input.planetRadii;
    const spacingScale = input.spacingScale ?? 1;
    const n = planetRadii.length;
    if (this.radii.length !== n) this.radii = new Float64Array(n);
    let radius = firstOrbitRadius(input.sunRadius, planetRadii, w);
    for (let i = 0; i < n; i++) {
      this.radii[i] = radius;
      if (i < n - 1) {
        radius += bandGap(i, planetRadii, spacingScale);
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
    const pad = stagePadding(w);
    const halfW = outerR + outerBody + pad;
    const halfH = outerR * this.ellipseRatio + outerBody + pad;
    // Real room left around the origin on each side. With the optional offset
    // at 0 (the shipped value) roomX is exactly w / 2 and roomY exactly h / 2,
    // i.e. the historical fit - the general form only makes sure that moving
    // the origin can never clip the composition, it can only scale it down.
    const roomX = Math.min(this.centerX, w - this.centerX);
    const roomY = h > 0 ? Math.min(this.centerY, h - this.centerY) : halfH;
    const fit = Math.min(roomX / halfW, roomY / halfH);
    this.fit = fit;

    // THE COMPOSITION ASPECT (halfW / halfH): a ratio of the frozen radii and
    // of the ONE plane angle, so it is independent of every size knob and of
    // the scene. The component publishes it, and the scene is then given
    // exactly the height this composition needs for its measured width: on a
    // wide, short viewport the system fills the whole WIDTH instead of being
    // shrunk by the height, while tall viewports simply keep centring it.
    const aspect = halfH > 0 ? halfW / halfH : 1;
    return { fit, traces: [], aspect };
  }

  /**
   * SVG path of orbit `index`, in ABSOLUTE design coordinates (the exact
   * space calculateOrbitPoint() returns): the projected trajectory sampled at
   * V3D_TRACE_SAMPLES values of theta. The path is closed (Z) because
   * theta = 0 and theta = 2*PI are the same point of the same circle.
   */
  private sampleTracePath(index: number): string {
    const radius = this.radii[index];
    const points: string[] = [];
    for (let s = 0; s < V3D_TRACE_SAMPLES; s++) {
      const theta = (s / V3D_TRACE_SAMPLES) * Math.PI * 2;
      const point = calculateOrbitPoint(
        radius,
        theta,
        this.centerX,
        this.centerY,
        this.planeAngleRad,
      );
      points.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
    }
    return `M ${points.join(' L ')} Z`;
  }

  /**
   * THE ORBIT POINT OF BODY `index` AT ANGLE `theta` - its position in
   * ABSOLUTE stage coordinates, consumed by the planet movement every frame.
   *
   * It only CONVENES the instance state (this orbit's radius, the ONE origin,
   * the ONE plane angle) and delegates the mathematics to the module-level
   * calculateOrbitPoint(): the trajectory equations exist in exactly ONE
   * place, so the planets and the traces sampled in compute() can never
   * disagree.
   *
   * `depth` is the raw out-of-plane offset of that very point and `depth01`
   * is that SAME depth normalised to 0 (far / back) .. 1 (near / front) - the
   * only input of the layering model (z-index, near/far scale, opacity),
   * never a second depth system.
   */
  orbitPoint(index: number, theta: number): OrbitPoint {
    const radius = this.radii[index];
    const point = calculateOrbitPoint(
      radius,
      theta,
      this.centerX,
      this.centerY,
      this.planeAngleRad,
    );
    // Same depth, normalised: depth / radius = sin(theta) * sin(angle), so the
    // mapping is independent of the orbit size (and stays finite even before
    // the scene has been measured).
    const depth01 = radius > 0 ? (point.depth / radius + 1) / 2 : 0.5;
    return { x: point.x, y: point.y, depth: point.depth, depth01 };
  }
}

/** One point of the projected orbital plane PLUS the normalised depth - the
    value the planet movement consumes (Values3dGeometry.orbitPoint()). */
export interface OrbitPoint extends OrbitProjection {
  /** `depth` normalised to 0 (far / back) .. 1 (near / front) - the ONLY
      input of the layering model (z-band, near/far scale, opacity). */
  readonly depth01: number;
}

/** One visible orbit trace: the projected trajectory of orbit `index`,
    SAMPLED from calculateOrbitPoint() - the same function the planets move on
    - in ABSOLUTE design coordinates. */
export interface OrbitTrace {
  /** Planet / orbit index (COMPANY_VALUES order). */
  readonly index: number;
  /** SVG path data: a closed polyline of V3D_TRACE_SAMPLES projected points. */
  readonly d: string;
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
  /** Responsive spacing scale of the CURRENT screen category
      (V3D_SPACING_SCALE_BY_CATEGORY) - the SAME value the component's
      normalization uses, so both see one identical composition. */
  readonly spacingScale?: number;
}

/** What a geometry pass produces for the component. */
export interface OrbitGeometryResult {
  /** Uniform fit scale (design space -> measured scene). */
  readonly fit: number;
  /** The six projected traces, sampled from calculateOrbitPoint() - the SAME
      function the planet movement reads every frame. */
  readonly traces: readonly OrbitTrace[];
  /** halfW / halfH of the design box: the aspect ratio the scene needs so the
      composition can use the full available width without being clipped. */
  readonly aspect: number;
}