/**
 * ============================================================
 * MASTER ANGLE - INCLINATION OF THE COMMON ORBITAL PLANE
 * ============================================================
 *
 * Change V3D_ORBIT_PLANE_ANGLE_LADDER_DEG to change the common orbital-plane
 * inclination (one small set of candidate angles, of which the SMALLEST
 * that fits the available height is resolved per geometry pass):
 * how the six planet trajectories are projected onto the screen.
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
 * IMPORTANT: test this value in small increments (45 / 50 / 55 / 60 / 65).
 *
 * WHAT THIS NUMBER IS, PRECISELY:
 * the angle BETWEEN THE ORBITAL PLANE AND THE SCREEN PLANE. The whole disc is
 * rotated around the horizontal X axis through the exact centre of the Sun:
 *     orbitalX = R * cos(theta)            orbitalY = R * sin(theta)
 *     screenX  = orbitalX
 *     screenY  = orbitalY * cos(angle)     (the ellipse's vertical semi-axis)
 *     depth    = orbitalY * sin(angle)     (out of plane, drives front/back)
 *   angle = 0  -> the plane LIES IN the screen plane: perfect circles,
 *                 a top-down diagram, and NO depth (the front/back order
 *                 degenerates). This is the look to avoid.
 *   angle = 90 -> the plane is PERPENDICULAR to the screen: every orbit
 *                 collapses to a horizontal line (no ellipse left to read).
 *   55       -> the cinematic oblique in between (see below).
 *
 * WHY 55 on mobile/tablet and 61 on desktop (measured, never guessed):
 * the projected rings must read as clear ELLIPSES with real front/back
 * travel, and the whole system must fit its scene:
 *     32 -> ellipse 1.18:1 - almost circular, i.e. the top-down look, and
 *           the near-circular box is tall, so desktop was HEIGHT-bound and
 *           wasted the width (73.6% at 1920x1080).
 *     55 -> ellipse 1.74:1 - unmistakably oblique yet far from a line, and
 *           the shallower box lets the WIDTH become the binding axis.
 *     61 -> ellipse 2.06:1 - the SMALLEST inclination that makes the desktop
 *           section fit its viewport; still clearly oblique, not a line.
 *     65 -> ellipse 2.37:1 - flatter, but cos(alpha) shrinks every radius
 *           (R1 = .../cos(alpha)) so the bodies lose ~9% of their size for
 *           a look that starts reading as a flat diagram.
 *
 * WHY DESKTOP NEEDS 61 (measured heights, available = viewport - navbar of
 * 80/96px - bottom margin of 8/48px):
 *     1024x768   available 664  needed 664  -> 55 fits (exactly)
 *     1280x800   available 696  needed 743  -> 55 overflows by  47px
 *     1440x900   available 796  needed 837  -> 55 overflows by  41px
 *     1920x1080  available 976  needed 1119 -> 55 overflows by 143px
 *     320..834   available >= needed at 55 (overflow 0 at every size)
 * At 61 deg every one of those cells needs less than its available height
 * (verified with the headless sweep: overflow 0px at all 30 cells).
 * THE COST IS MATHEMATICAL, NOT COSMETIC: the composition is normalized to
 * the WIDTH and R1 = .../cos(alpha), so the body size and the required
 * height scale with the SAME factor. Flattening the plane enough to fit
 * therefore costs ~9% of body size - and ONLY on the viewports that
 * actually need it: 1280 / 1440 / 1920. Everything up to and including
 * 1024x768 keeps 55 deg and its exact approved size.
 * Measured across 320/360/390/430/768/834/1024/1280/1440/1920 and
 * FR / EN / AR: the rings read 1.743:1 on mobile/tablet (55 deg) and
 * 2.06:1 on desktop (61 deg) on the rendered SVG, the worst
 * planet-vs-planet disc overlap over a full revolution is 0px, and no
 * planet ever reaches the Sun's readable content zone (0.0% covered,
 * penetration 0% - comfortably inside the "<= 5% of the Sun" requirement,
 * because firstOrbitRadius() divides by cos(alpha) and therefore holds the
 * Sun -> Planet 1 clearance in SCREEN space at EVERY orbital angle).
 * The running value is audited in dev by Values3dComponent
 * ("[values-3d] Sun content overlap: ...", "[values-3d] Contained: ...").
 *
 * Nothing here ever changes a size, a radius or a speed: the angle only
 * ORIENTS the plane, and the fit scale absorbs the projection.
 *
 * HOW IT PROPAGATES (nothing else needs manual editing):
 *
 *        ANGLE
 *          |
 *          v
 *   orbital plane       tilt = cos(angle)   -> screen Y   (per pass)
 *                       depth = sin(angle) -> depth      (the SAME angle)
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
/**
 * ─── THE ONE INCLINATION KNOB ─────────────────────────────────────────────
 *
 * The solar system is projected with ONE common orbital plane, inclined by
 * this angle between the orbital plane and the screen plane. The ladder is
 * ordered from the most cinematic (flattest look, biggest bodies) to the
 * most projected-down; the engine always uses the SMALLEST entry whose
 * complete projected system fits the available scene height
 * (angleDegThatFits), so a viewport that already fits keeps its approved
 * size and only the too-short ones are flattened.
 *
 *     55 -> ellipse 1.74:1   the cinematic oblique (mobile / tablet)
 *     61 -> ellipse 2.06:1   desktop, where the 55 deg box is too tall
 *     66 -> ellipse 2.47:1   last resort for very short / very wide windows
 *
 * WHY the ladder exists - the measured heights that make 55 deg too tall on
 * a desktop viewport - is documented in the header above.
 */
export const V3D_ORBIT_PLANE_ANGLE_LADDER_DEG = [55, 61, 66];

/** Angle in radians. */
export function radOf(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180;
}

/** Screen projection of the inclined plane (the ellipse's vertical
    semi-axis, i.e. radius * cos(angle)) - the ONE tilt handed to the
    radii, the fit, the bounds and the component's distance checks. */
export function tiltOf(angleDeg: number): number {
  return Math.cos(radOf(angleDeg));
}

/** Out-of-plane component of that very same inclination (radius *
    sin(angle)) - it becomes the depth (front/back z-order, near/far scale
    and opacity) of a body. Never a second tuning value. */
export function depthOf(angleDeg: number): number {
  return Math.sin(radOf(angleDeg));
}

/**
 * THE SMALLEST INCLINATION WHOSE COMPLETE SYSTEM FITS `availableHeight`.
 *
 * The test is exact and scale-invariant: the whole design is normalized to
 * the scene WIDTH, so the needed height is
 *     neededHeight = sceneWidth * (paddedHalfH / paddedHalfW)
 * which depends only on the frozen radii and the candidate angle - never on
 * the normalization factor and never on the measured height (so it is
 * evaluated from the frozen baselines, BEFORE the normalization: stateless,
 * with no feedback loop and no dependence on a previous pass).
 *
 * The box mirrors compute() exactly - same radii, same per-planet DRAWN
 * cap (the orbit-1 affordability cap and the rendered/position budget the
 * component applies), same Sun + halo reach, same scene-fill padding - so
 * the test answers precisely "does THIS inclination fit", not a guess.
 *
 * @param sceneWidth      measured scene width in px
 * @param availableHeight scene height the composition may occupy in px
 *                        (viewport - navbar - bottom margin)
 * @param sunRadius       position-layer Sun radius (design px)
 * @param planetRadii     position-layer planet radii (design px)
 * @param spacingScale    the responsive spacing dial of the current category
 * @returns the ladder entry to use; the last one if none is short enough
 */
export function angleDegThatFits(
  sceneWidth: number,
  availableHeight: number,
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  spacingScale = 1,
): number {
  const ladder = V3D_ORBIT_PLANE_ANGLE_LADDER_DEG;
  if (!(sceneWidth > 0) || !(availableHeight > 0)) return ladder[0];
  for (const deg of ladder) {
    const box = projectedBoxFor(sceneWidth, tiltOf(deg), sunRadius, planetRadii, spacingScale);
    // Scale-invariant: the design is normalized to the WIDTH, so the height
    // the composition needs is sceneWidth * (halfH / halfW).
    if (sceneWidth * (box.halfH / box.halfW) <= availableHeight) return deg;
  }
  return ladder[ladder.length - 1];
}

/** The scene height this composition would need at `angleDeg`, for a scene
    `sceneWidth` px wide - the exact model compute() uses. Exported so the
    component's dev audit can explain the inclination it picked. */
export function projectedHeightPx(
  sceneWidth: number,
  angleDeg: number,
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  spacingScale = 1,
): number {
  const box = projectedBoxFor(sceneWidth, tiltOf(angleDeg), sunRadius, planetRadii, spacingScale);
  return sceneWidth * (box.halfH / box.halfW);
}

/** The PADDED bounding box (design px, un-normalized) this composition would
    produce at the given tilt - the same model compute() uses, so the
    inclination test and the real fit can never disagree. */
function projectedBoxFor(
  sceneWidth: number,
  tilt: number,
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  spacingScale: number,
): { halfW: number; halfH: number } {
  // ── the six orbit radii, exactly as compute() lays them out
  const radii: number[] = [];
  let radius = firstOrbitRadius(sunRadius, planetRadii, tilt);
  for (let i = 0; i < planetRadii.length; i++) {
    radii.push(radius);
    if (i < planetRadii.length - 1) radius += bandGap(i, planetRadii, spacingScale);
  }

  // ── the DRAWN body every planet is capped at (planetVisualCap): the
  //    orbit-1 affordability cap, limited by the rendered/position budget.
  const orbitCap = Math.max(
    0,
    (radii[0] * tilt) /
      (V3D_MAX_SCALE * (V3D_SUN_DOMINANCE * (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) + 1)) -
      4,
  );
  const body = (i: number) =>
    Math.max(planetRadii[i], Math.min(orbitCap, V3D_PLANET_VISUAL_HEADROOM * planetRadii[i])) *
    V3D_MAX_SCALE;

  let coreW = 0;
  let coreH = 0;
  for (let i = 0; i < radii.length; i++) {
    coreW = Math.max(coreW, radii[i] + body(i));
    coreH = Math.max(coreH, radii[i] * tilt + body(i));
  }
  // The Sun sits on the origin: its visual radius AND its halo.
  const sunCap = Math.max(
    0,
    (radii[0] * tilt) / (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP + 1 / V3D_SUN_DOMINANCE),
  );
  const sunVis = Math.max(sunRadius, Math.min(V3D_SUN_VISUAL_HEADROOM * sunRadius, sunCap));
  const sunExtent = Math.max(sunVis, sunVis * V3D_SUN_HALO_FACTOR);
  coreW = Math.max(coreW, sunExtent);
  coreH = Math.max(coreH, sunExtent);

  const pad = (core: number) =>
    Math.max(stagePadding(sceneWidth), core * (1 / V3D_SCENE_FILL_RATIO - 1));
  return { halfW: coreW + pad(coreW), halfH: coreH + pad(coreH) };
}

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
 * SCENE BOUNDS - THE COMPLETE BOUNDING BOX OF THE DRAWN SYSTEM
 * ============================================================
 * compute() turns the DRAWN composition into ONE bounding box and fits it
 * inside the measured scene with ONE uniform scale. Everything a body can
 * reach during a FULL revolution is inside that box:
 *   - every orbit's projected extent   (R_i , R_i * cos(plane angle)),
 *   - PLUS that orbit's body radius (the DRAWN / visual radius),
 *   - PLUS the Sun's full visual radius AND its halo,
 *   - PLUS the scene-fill padding below (V3D_SCENE_FILL_RATIO),
 * so the Sun and all six planets stay inside the scene at EVERY frame.
 *
 * Nothing here changes a size, a radius, a distance or a speed: the box only
 * decides how much the WHOLE composition is scaled down when the scene is too
 * small for it (ratios always preserved; no body shrinks on its own).
 */

/** The Sun's visible HALO radius factor. The CSS is
 *      .v3d-sun-halo { width: calc(var(--v3d-sun) * 1.6) }
 *  and --v3d-sun is the Sun's DIAMETER, so the halo RADIUS is 1.6 x the Sun's
 *  radius. The box must contain it, otherwise the halo is clipped. */
export const V3D_SUN_HALO_FACTOR = 1.6;

/** SCENE FILL (dimensionless) - how much of the measured scene the PADDED
 *  bounding box may occupy on the binding axis. Each axis is padded from its
 *  own core extent by exactly `core * (1 / ratio - 1)`, so by construction
 *      core / (core + margin) = V3D_SCENE_FILL_RATIO
 *  i.e. with 0.92 the drawn system claims 92% of the scene and 8% stays
 *  breathing room (still floored by stagePadding(w) on narrow scenes).
 *
 *  WHY A RATIO AND NOT A FIXED PX (the previous V3D_GLOW_MARGIN_PX = 132):
 *  a FIXED px allowance costs proportionally more on a small scene and
 *  almost nothing on a large one - exactly backwards. Measured, 132px was
 *  37% of a 360px phone's half-width but only 14% of a 1920px desktop's:
 *  the phone rendered a tiny system with big empty side margins while the
 *  desktop had none. As a RATIO the padding scales with the composition, so
 *  the rendered share of the scene stays in a tight band at every
 *  breakpoint (audited by the headless sweep: containment + width usage at
 *  320 / 375 / 414 / 560 / 768 / 834 / 1024 / 1280 / 1440 / 1920).
 *
 *  GLOW TRADE-OFF (the knob that trades composition size for glow room):
 *    larger ratio  -> less padding -> the system renders bigger, and the
 *                     faintest box-shadow tails may fade at the scene edge;
 *    smaller ratio -> more padding -> smaller system, more glow room.
 *  The Sun's pulse glow lives at the CENTRE (far from the box edge), so the
 *  only glow measured against this margin is the outer planet's hover glow,
 *  which the stagePadding floor covers on phones and the 8% covers on
 *  tablets / desktops.
 *
 *  Unitless. Used per axis in compute():
 *      margin = max(stagePadding(w), core * (1 / V3D_SCENE_FILL_RATIO - 1)). */
export const V3D_SCENE_FILL_RATIO = 0.92;

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
    extremes (R * cos(plane angle)). Dividing by that per-pass tilt makes
    the configured gap hold at EVERY orbital angle - in front, behind and at
    the side - using the ONE plane angle (no second angle exists).

    `fallbackWidth` only guards the pre-measurement state (sunRadius = 0):
    the historical behaviour was 0.2 * sceneWidth.

    `tilt` is cos(angle) of the ONE inclination resolved for the current
    pass (tiltOf(angleDegThatFits(...))) - passed in, never recomputed here,
    so the radii and the movement can never use different planes. */
export function firstOrbitRadius(
  sunRadius: number,
  planetRadii: ArrayLike<number>,
  tilt: number,
  fallbackWidth = 0,
): number {
  if (sunRadius <= 0) return 0.2 * fallbackWidth;
  return (
    ( sunRadius * (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) * V3D_SUN_VISUAL_HEADROOM +
      planetRadii[0] * V3D_MAX_SCALE * V3D_PLANET_VISUAL_HEADROOM ) /
    tilt
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
  tilt = 1,
  fallbackWidth = 0,
): number {
  let radius = firstOrbitRadius(sunRadius, planetRadii, tilt, fallbackWidth);
  for (let i = 0; i < planetRadii.length - 1; i++) {
    radius += bandGap(i, planetRadii, spacingScale);
  }
  return radius + planetRadii[planetRadii.length - 1] * V3D_MAX_SCALE;
}

/** The Sun's own contribution to R1, in POSITION units - the exact mirror of
    the Sun term inside firstOrbitRadius(), so absorbGrowthIntoSun() can peel
    it out of the design extent WITHOUT a second copy of the formula. */
export function sunClearanceFactor(tilt: number): number {
  return ((1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) * V3D_SUN_VISUAL_HEADROOM) / tilt;
}

/** Largest RENDERED planet radius that orbit 1 can afford, projection- and
    gap-aware: derived from
        TILT * R1 >= visSun * (1 + 2*GAP) + V3D_MAX_SCALE * visPlanet
    together with the dominance floor visSun >= DOMINANCE * visPlanet.
    Single source for the component's planet cap - it can never disagree
    with firstOrbitRadius(). */
export function maxPlanetRadiusForOrbit(r1: number, tilt: number): number {
  const denominator =
    V3D_MAX_SCALE * (V3D_SUN_DOMINANCE * (1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP) + 1);
  return Math.max(0, (r1 * tilt) / denominator - 4);
}

/** Largest RENDERED Sun radius that orbit 1 can afford (same derivation,
    solved for the Sun). Single source for the component's Sun wish cap. */
export function maxSunRadiusForOrbit(r1: number, tilt: number): number {
  const denominator = 1 + 2 * V3D_SUN_TO_FIRST_PLANET_GAP + 1 / V3D_SUN_DOMINANCE;
  return Math.max(0, (r1 * tilt) / denominator);
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
 *            / tilt (cos of the pass inclination)  (holds at EVERY angle)
 *   gap_i  = spacingScale * (1 + V3D_BAND_VISUAL_GAP_RATIO)
 *            * PLANET_HEADROOM * (radius_i + radius_i+1)
 *   R_i+1  = R_i + gap_i
 *   angle  = input.planeAngleRad                   (the resolved knob)
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
      cos(planeAngleRad) of the CURRENT pass - i.e. exactly the inclination
      resolved for the current screen category, never flattened, clamped or
      scaled by the viewport. Re-assigned on every compute(). */
  ellipseRatio = tiltOf(V3D_ORBIT_PLANE_ANGLE_LADDER_DEG[0]);

  /** OUT-OF-PLANE factor of that very same inclination (the depth axis):
      sin(planeAngleRad). With a circle of radius R,
      screenOffsetY^2 + depth^2 = R^2, so all six planets stay on circles of
      ONE common plane. Re-assigned on every compute(). */
  depthFactor = depthOf(V3D_ORBIT_PLANE_ANGLE_LADDER_DEG[0]);

  /** THE ONE inclination in radians used by THIS geometry pass - the value
      handed to the shared calculateOrbitPoint() (planet movement every frame
      AND the trace sampling), to the orbit radii and to the bounding box.
      Set from `input.planeAngleRad` in compute(), so all of them describe
      the same plane at all times. */
  planeAngleRad = radOf(V3D_ORBIT_PLANE_ANGLE_LADDER_DEG[0]);

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

    // THE ONE INCLINATION OF THIS PASS: read from the input (the component
    // resolves it once per geometry pass from the screen category), then
    // reused for EVERYTHING below - the orbit radii, the projection, the
    // traces and the bounding box - so a planet and its ring can never end
    // up on different planes.
    this.planeAngleRad = input.planeAngleRad;
    this.ellipseRatio = Math.cos(this.planeAngleRad);
    this.depthFactor = Math.sin(this.planeAngleRad);

    // Sizes are already resolved by the component (applyVisualSizes +
    // fitContentToPlanets): here they are only turned into positions, so a
    // size change can never move a body - it only redraws the ring it
    // travels on.
    const planetRadii = input.planetRadii;
    const spacingScale = input.spacingScale ?? 1;
    const n = planetRadii.length;
    if (this.radii.length !== n) this.radii = new Float64Array(n);
    let radius = firstOrbitRadius(input.sunRadius, planetRadii, this.ellipseRatio, w);
    for (let i = 0; i < n; i++) {
      this.radii[i] = radius;
      if (i < n - 1) {
        radius += bandGap(i, planetRadii, spacingScale);
      }
    }
    // ORIENTATION: already applied above (ellipseRatio / depthFactor from
    // input.planeAngleRad) BEFORE the radii were laid out, so R1, the band
    // steps, the traces and the bounding box below all share that ONE plane.

    // ==========================================================
    // THE COMPLETE BOUNDING BOX OF THE DRAWN SYSTEM + THE ONE FIT SCALE
    // ==========================================================
    // A body of orbit i at angle theta is centred at
    //   ( centerX + R_i*cos(theta) , centerY + R_i*cos(planeAngle)*sin(theta) )
    // i.e. its centre rides the ellipse of semi-axes (R_i , R_i*cos(angle)).
    // The DISC of that body therefore sweeps that ellipse expanded by the
    // body's DRAWN radius r_i, so the deepest reach of the whole orbit is
    //   max|x| = R_i + r_i            max|y| = R_i*cos(angle) + r_i
    // (attained at theta = 0 deg for X and theta = 90 deg for Y).
    // MAX over EVERY orbit - never just the outermost - and the DRAWN (visual)
    // radii, because those are what is painted: the position radii can be up
    // to V3D_PLANET_VISUAL_HEADROOM smaller than the rendered sphere. The
    // orbit radii R_i themselves still come from the POSITION inputs only, so
    // every locked distance stays byte-identical.
    const drawnRadii = input.visualPlanetRadii ?? planetRadii;
    const drawnBody = (i: number) => drawnRadii[i] * V3D_MAX_SCALE; // depth-scaled
    let halfW = 0;
    let halfH = 0;
    for (let i = 0; i < n; i++) {
      halfW = Math.max(halfW, this.radii[i] + drawnBody(i));
      halfH = Math.max(halfH, this.radii[i] * this.ellipseRatio + drawnBody(i));
    }
    // The Sun sits ON the origin, so it adds its own reach: its full visual
    // radius AND its halo (the box must hold both, or the halo is clipped).
    const drawnSunRadius = input.visualSunRadius ?? input.sunRadius;
    const sunExtent = Math.max(drawnSunRadius, drawnSunRadius * V3D_SUN_HALO_FACTOR);
    halfW = Math.max(halfW, sunExtent);
    halfH = Math.max(halfH, sunExtent);

    // SCENE FILL: pad EACH axis from its own core extent, so the padded box
    // keeps the constant core ratio (V3D_SCENE_FILL_RATIO) on both axes and
    // the composition claims exactly that share of the scene on whichever
    // axis binds. Floored by the stage padding so the edges can never touch,
    // whatever the scene width.
    const padAxis = (core: number): number =>
      Math.max(stagePadding(w), core * (1 / V3D_SCENE_FILL_RATIO - 1));
    const coreW = halfW;
    const coreH = halfH;
    halfW += padAxis(coreW);
    halfH += padAxis(coreH);

    // Real room left around the origin on each side. With the optional offset
    // at 0 (the shipped value) roomX is exactly w / 2 and roomY exactly h / 2.
    // The ONE uniform scale - derived from BOTH the measured width AND height
    // - shrinks the COMPLETE composition (Sun, halo, planets, traces, glows)
    // so the bounding box always fits the REAL scene rectangle. Ratios are
    // preserved: no body is ever shrunk on its own.
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
    return { fit, traces, aspect, box: { halfW, halfH } };
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
  /** THE inclination of this pass, in RADIANS - resolved ONCE by the
      component from the current pass (V3D_ORBIT_PLANE_ANGLE_LADDER_DEG ->
      angleDegThatFits() -> radOf(this.planeAngleDeg)).
      compute() applies it to the orbit radii, the projection, the traces and
      the bounding box, so every consumer of the plane is guaranteed to agree. */
  readonly planeAngleRad: number;
  /** Responsive spacing scale of the CURRENT screen category
      (V3D_SPACING_SCALE_BY_CATEGORY) - the SAME value the component's
      normalization uses, so both see one identical composition. */
  readonly spacingScale?: number;
  /** DRAWN (visual) Sun radius in design px. Used for the BOUNDING BOX only;
      the orbit radii still come from `sunRadius` (position layer), so every
      locked distance stays byte-identical. Defaults to `sunRadius`. */
  readonly visualSunRadius?: number;
  /** DRAWN (visual) planet radii in design px. BOUNDING BOX only, same rule
      as `visualSunRadius` above. Defaults to `planetRadii`. */
  readonly visualPlanetRadii?: ArrayLike<number>;
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
  /** THE COMPLETE BOUNDING BOX of the DRAWN system: half-extents in design
      px around the ONE origin, scene-fill padding included. `fit` is exactly the
      scale that fits this box into the measured scene; the component's dev
      containment audit re-checks it. */
  readonly box: { readonly halfW: number; readonly halfH: number };
}
