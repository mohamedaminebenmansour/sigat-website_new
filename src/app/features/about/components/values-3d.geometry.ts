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
export const V3D_ORBIT_PLANE_ANGLE_DEG = 40;

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
 * reproduces the approved position model verbatim:
 *
 *   R1     = sunRadius + 2*sunRadius*SUN_TO_FIRST_ORBIT_GAP_RATIO
 *            + planetRadius_1 * V3D_MAX_SCALE        (depth headroom)
 *   gap_i  = V3D_BAND_GAP_RATIO * (radius_i + radius_i+1) / 2
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

    // THE VISIBLE ORBIT TRACES: each one is SAMPLED from the very same
    // calculateOrbitPoint() the planets move on (0 .. 2*PI, V3D_TRACE_SAMPLES
    // points), so a trace and the planet that rides it are the same curve by
    // construction - same origin, same radius, same ONE plane angle. Static
    // geometry: rebuilt here only (init / resize / language), never per frame.
    const traces: OrbitTrace[] = [];
    for (let i = 0; i < n; i++) {
      traces.push({ index: i, d: this.sampleTracePath(i) });
    }
    // THE COMPOSITION ASPECT (halfW / halfH): a ratio of the frozen radii and
    // of the ONE plane angle, so it is independent of every size knob and of
    // the scene. The component publishes it, and the scene is then given
    // exactly the height this composition needs for its measured width: on a
    // wide, short viewport the system fills the whole WIDTH instead of being
    // shrunk by the height, while tall viewports simply keep centring it.
    const aspect = halfH > 0 ? halfW / halfH : 1;
    return { fit, traces, aspect };
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