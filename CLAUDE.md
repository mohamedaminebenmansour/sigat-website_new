# SIGAT website — working guide

Corporate site for **SIGAT – Société Internationale des Grands Travaux** (Le Bardo, Tunisia, since 2010):
hydraulic works — water-supply pipelines, reservoirs, pumping stations, sewerage, civil works.

**Design idea:** the whole site is one hydraulic network. Water and glass pipes connect every
section and every page. The animations must look physically right to a hydraulic engineer.

## Stack & commands
- Angular 18 standalone components (no NgModules), Tailwind 3, ngx-translate (fr default, en, ar = RTL).
- `npx ng build` — must pass. Per-component style budget is 12 kB, so put large CSS in `src/styles/hydro.css`.
- `npm start` runs the dev server.
- **Don't open these** unless asked: `dist/`, `node_modules/`, `*.log`, `playground/`, `media-source/`,
  `v3d-*.mjs`, `verify-*.json`, `_git*.txt`, `HOME_*.md` (old reports).
- `src/app/features/about/components/values-3d.*` is the owner's own work in progress. **Don't modify it.**

## Where things are
| Need | File |
|---|---|
| Routes (+ page-transition guard) | `src/app/app.routes.ts` |
| Layout: header, footer, page curtain | `src/app/layout/main-layout.component.ts` |
| Header (blue bar, official white logo; **no pipe** — removed at the owner's request) | `src/app/layout/components/header.component.ts` |
| Header: every panel ("Plus", language) closes on choice, outside click, scroll, navigation and Esc; language = globe pill + deep-water panel (no native select); search = translucent pill turning white on focus. "Plus" menu + **site search** (`hd-*` deep-water panels; search = pages + projects + expertise + actions, accent-insensitive, grouped by best match, ↑↓ ↵ Esc, "/" focuses; `PAGE_WORDS` = everyday words per page) | `header.component.ts` + `src/app/core/search/site-search.service.ts` |
| Mobile menu (`mm-*`: panel fills with water, numbered pages, orange drop = current page, partner CTA, quick actions, FR/EN/عر switch; scroll lock, Esc, focus) | `src/app/layout/components/mobile-menu.component.ts` |
| Footer (water background, wavy pipe; `above` = colour of the page's last section) | `src/app/layout/components/footer.component.ts` |
| **Company contact data (single source)**: email, phone (hidden while "XX"), legal ids, ISO status, `CONTACT_ROUTES` (mailbox per visitor type), `FORM_ENDPOINT`, `COMPANY_PROFILE_PDF`, `SAMPLE_DATA` | `src/app/core/company/company-info.ts` |
| Per-page title / description / OG (keys `seo_<page>_t/_d`) | `src/app/core/seo/seo.service.ts` |
| Inner-page hero (photo + glass pipe, the page's only joint) | `src/app/shared/components/page-hero.component.ts` |
| Careers openings (sample until SIGAT sends real ones) | `src/app/features/careers/careers.data.ts` |
| Social links (read company-info) | `src/app/core/social/social-links.ts` |
| Company values (6, shared by Home + About) | `src/app/features/about/components/values.data.ts` |
| Company figures (15+, 120+, 500 km+, 300+) | `src/app/features/media-showcase/data/company-stats.data.ts` |
| Translations (always edit all 3) | `src/assets/i18n/{fr,en,ar}.json` |
| Design tokens + all `hx-*` / `ww-*` / `vp-*` CSS | `src/styles/hydro.css` |

### Home (`src/app/features/home/home.component.ts`)
Story: **where SIGAT's water comes from**, shown as a real installation.
1. `sections/home-hero.component.ts`: sticky video. Wave-equation water rises with scroll. Below it is the page's only pipe joint.
2. `sections/home-water-scene.component.ts` + `sections/water-scene-engine.ts` (the owner's favourite design, **no photo**). The cycle is **FILL → DROPS → HOLD → SINK**:
   - the logo is `public/assets/brand/logo-glass.webp` (830×1111): the **owner's empty-glass logo** (Gemini image), its baked transparency checkerboard removed by matting: checker model fitted on the background; blue-chroma shape mask, smoothed; ring outline = two fitted ellipses (rim smoothed along the ring); tube interiors rebuilt along each tube (the checker was rendered refracted through the glass). The **middle tube was raised into the reservoir** (mouth y 418) using its own rim/body texture. Geometry (`LG`, `J_LINE`, `LEG_LINE`, `TUBE_R`, `RING_IN`, `VALVE_Y`) is measured in that image's pixels and scaled by `U = 1055/830` into logo units — if the logo image changes, re-measure these. **All water is drawn live**: ring water (clipped to `RING_IN`, the fitted inner ellipse), riser column, outlet and drain columns, pour jet. Tube water is drawn wider than the tube and trimmed by the **bore masks** `public/assets/brand/logo-bore.png` (R = riser, G = outlet, B = drain; glass silhouette minus the wall, measured on the logo) via `inBore()`, so it always fills the whole bore up to the real tube ends; free fronts get a meniscus (`tubeWater(..., freeStart, freeEnd)`). Regenerate the masks if the logo image changes;
   - riser (J): starts empty; while the pump runs the water front climbs it, and only at the gooseneck does water leave as a **free jet** (`jetPath`: exits along the pipe axis, parabola, narrows by continuity, plunges with foam, air plume and ripples at `pourX`). When the pump stops, the riser drains back under g;
   - **outlet (sortie) = the left tube** (`LEG_LINE`, no valve): it runs once the pump has stopped at HIGH and only while the surface is above its mouth (`mouthLevel`); each drop lowers the level toward the mouth; the water below it is dead storage (the ring never empties after the first fill). Drops form at its end (`LG.drip`);
   - **drain (vidange) = the middle tube** (`DRAIN_LINE`), raised into the reservoir, **closed**: it fills with still water once the surface covers its mouth, and its foot is real hardware (`drawDrainClosure`): flange adapter on the glass → flanged gate valve (blue epoxy ductile iron, red handwheel face-on, shut) → bolted blind flange;
   - the ring reservoir **starts empty**. The pump fills it (water climbs the J and pours from the gooseneck) up to the HIGH switch; the scene emits `(pump)` and Home feeds it to the pump's `[running]` input;
   - once the ring is half full, 5 drops form at the left leg **one after another, not in lockstep** (random growth time, overlapping in flight), carrying 15+, 120+, 500 km+, 300+ and 2010 (founding year, key `ws_founded`). Each drains the ring by 1/5, becomes a low-riding buoy, and launches a **travelling wave packet** (c = 480 px/s). The waves lift the letters as they pass. The letters are **revealed by an air-lift, independent of the drops**: once the section top is in the upper half of the viewport, a bubble plume rises under each letter in turn (0.3 s apart) and the letter breaks the surface; the word is up in ~1.6 s;
   - buoys: the first drop's float travels farthest from the drip, so floats never cross; touching floats push apart;
   - HOLD 5 s, then the buoys sink one after another, and the pump refills;
   - touch and mouse: a tap drops heavy water from the top of the view (big splash, waves both ways); a drag leaves a wake and pushes the letters it crosses (spring + sloshing). Phones show figures only on the buoys (logo 0.38·W on phones). Figure drops are big and sized to their number (`dropFont` 21–32 px desktop / 15 phone; `dropR`: number big, unit below, ≤ 0.5 × gap to the water); buoys `buoyR` 26–42 px desktop / 21–26 phone, figure fitted inside; the sky's top 30 % is exactly #86d0f7 (the joint's colour); impact splash, rings and spray scale with drop size;
   - the letters are the **owner's crystal artwork** `assets/media/home/letters/sigat-{S,I,G,A,T}.webp` (cut from the owner's image; A and T split by connected components because they overlap). Aspects in `LETTER_ASPECT`, kerning in `LETTER_GAP` (A–T negative). Sprite = artwork + faint blue tint; a lighter sloshing inner-water layer on top. Letter tops sit at the ring bottom. Phones: logo 0.38·W;
   - no caustic lines above the water; "Notre Histoire" is written on the water; it emits `tailX` for the pump riser;
   - perf: sticky band canvas at DPR 1, pre-rendered sky and sprites, underwater light at half resolution. Glass pipes animate through HydroTicker. **Never use SVG SMIL `<animate>`** (it caused page-wide style recalculation every frame).
3. `about/components/values-pump.component.ts` with `[riserX]="riserX()" [source]="true"`: wet well → suction line with foot valve/strainer → **our own drawn centrifugal pump** (centred, all values visible) → discharge header. The header rises, takes an elbow, then a horizontal run with **swing check valve → gate valve with handwheel → electromagnetic flow meter with a live m³/h reading → pressure gauge on a tee**, then an elbow up to the logo's J. Fittings are blue-epoxy ductile iron with PN16 flanges, drawn in `drawFittings()`. The heading moves to the right when the riser is on the left. The About page uses the same component with default inputs.
   **Pump machine model:** `running` input (Home: reservoir float switches; About: always true). Rotor speed n has inertia (spin-up τ 0.7 s, coast-down τ 2.4 s); affinity laws H ∝ n², it only delivers once H beats the static head H0; Q drives the flow meter, the streaks (`flowPh` = ∫Q dt, never `t·flow`), and the check-valve lever/counterweight; the gauge holds the static head when stopped; a Joukowsky surge rings on the gauge when the disc slams.
   **Pump physics (keep consistent):** the discharge is vertical, on the LEFT of the casing, so rotation is **clockwise** (in a volute the flow leaves tangentially in the direction of rotation). The impeller blades are backward-curved, θ(r) = θ0 − k·ln(r/r1). Casing flow, swirl and value orbits all turn clockwise. Outside the pump the flow is a free vortex: ω ∝ 1/r². Each value is linked to the pump by a log-spiral streamline. No text labels on the drawing (owner's request).
4. **Owner-requested joint** `app-wave-pipe` (#1d6dc6 → #c9eefc), then `sections/home-projects.component.ts` (`.hx-ch--arrive`: the footer's water gradient #c9eefc → #a6e0f8 → #86d0f4, owner's choice).
5. `sections/home-outfall.component.ts` + `sections/outfall-engine.ts` (**swapped with the Projects hero at the owner's request**; the old tap moved to Projects). The sky continues the projects' #86d0f4, no joint. **Pipe only — no concrete, no bank (owner)**: a PE100 main (SDR 17, blue stripes, electrofusion couplers) enters from the right edge and discharges as a free overfall: yc from the flow, brink yb = 0.75·yc (circular end-depth ratio), Vb = Q/A(yb); parcels are projectiles, thickness h = yb·Vb/|v|; roughness and streaks are advected with the water (functions of exit time t − τ) and grow with the fall (amplitude tied to local h); aeration whitens the lower nappe; edges shed drops (drawn with motion blur). Plunge: momentum flux per second (never per frame) dimples the surface, upwelling boil downstream, splash crown mostly forward, bubble plume along the jet direction decelerating to ≈ 0.55 × pool depth then rising at terminal speed ∝ √r, bursts → foam drifting on the surface outflow; rings spread on the surface (plunge + every landing drop), sun glints, a weak reflection of the pipe only (the churned surface under the jet gives none). Copy = CTA (`hx_out_kicker`, `hx_tap_title/text`); hovering "Démarrer un projet" raises the flow. Pool deep #0b4c91 → footer.
- "Le réseau" and "Le chantier" were **removed** at the owner's request.
- The old `water-world` engine and the photo version (`home-about`, `home-logo-reservoir`, `assets/media/home`) were removed or are unused.

### Expertise (`features/expertise/expertise.component.ts`)
- Data: `MockDataService.getExpertise()`. The model has translatable `slug / titleKey / descriptionKey / detailKeys` (i18n prefix `exp_*`). Legacy English `title/description/details` are still used by `expertise-detail.component.ts`.
- Page order:
  1. Hero: field photo, with the glass pipe as its lower edge.
  2. `components/expertise-hub.component.ts`: SVG ring main + glass drop. The drop's free surface is a damped oscillator. Selecting a node sends a droplet down its spoke, and the node ripples on arrival. Auto-cycles until the user interacts.
  3. Pipe joint, then `components/expertise-flow.component.ts`: zig-zag cards threaded on an S-bend pipe measured from the card positions. The water front follows scroll, and an icon tile fills when the water passes its card.
- Hand-off hub → flow: no joint; `.xp-hub` fades #eef6fd → #fff and its blueprint grid (`::before`, masked) fades with it, so `.xp-flow` (white) starts on the hub's last colour.
- Styles: `xp-* / xh-* / xf-*` in `hydro.css`. Checked at 390, 834, 1440 and 1920 px.

### Projects (`features/projects/projects.component.ts`)
"Where the water arrives". The site's pipe ends here.
- `components/projects-tap-hero.component.ts` (moved from Home): the hero is the valve installation — **reservoir seen in section on the left (water level above the intake), bellmouth, steel wall sleeve cut open through the hatched concrete wall so the water is seen coming from it** (owner: no empty hole), puddle flange → glycerine gauge → gate valve with handwheel → dismantling joint → 90° elbow → outlet → jet into the pool. The valve opens on arrival and stays open (button `pj_hero_cta` / `pj_hero_cta_close` toggles; fast closing → water hammer on the gauge); copy = projects title, sub and facts. Pool deep #0b4c91 = start of `.pj-net`. Impact forcing is a per-second momentum flux (a per-frame splash dug a crater when held open). Phones: installation in the 500 px band under the copy. Plunge: the jet is drawn first and ends exactly at the moving surface (aerating as it falls), then the pool, then an aerated plume below the entry + foam skirt; bubbles are driven down, slow, rise at terminal speed and burst into foam; rings from the entry. No spoke graphics.
- `components/projects-manifold.component.ts`: the filter is a header pipe with gate-valve handwheels. Opening one turns it multi-turn and routes water down its branch.
- `components/projects-network.component.ts` (`nw-*`, replaces the cards/sight glasses): the projects as a **distribution network**. A water main runs down the section (centre on desktop, left on phones); each project is a branch on a tee with a gate valve. Scroll advances the water front (62 % of the viewport); when it passes a tee the handwheel turns, the branch fills and the card wakes. Each card carries an animated schematic of **its kind of works**, from `Project.work` (`supply` pressure main + gauge + reservoir, `sewer` gravity sewer part-full + manhole, `desal` RO: HP pump, membrane, permeate/brine, `bridge` canal bridge over the river, `vrd` road over water main/sewer/ducts), caption `pj_work_*`, plus the client (`pj_client`). CSS animations only, paused until open.
- Hand-offs: hero pool #0b4c91 → `.pj-net` (#0b4c91 → navy) → `app-hx-wave-edge` #eaf5fd → map `.pj-map` #eaf5fd = `LAST_SECTION_COLOR['/projects']` → footer.
- The head office (`isOffice`) is excluded from the list but stays on the map. Styles: `pj-* / mf-* / sg-*`.

### Project detail (`features/projects/project-detail.component.ts`, `/projects/:id`)
**This page is for reading ONE project. Never add project-to-project navigation.**
1. `components/project-pipe-hero.component.ts`: the project photo inside a PE100 pipe bore. This is the page's only pipe joint.
2. Reading: the owner's `project-story` accordion with `[showGallery]="false"`. A `[storyAside]` **ring** (`.pc`) holds the project's general photo inside a thick light-blue ring, with orange markers on its left rim for location, period, client, category and scope. On laptop+ the ring bleeds off the right edge.
3. `components/project-drop-gallery.component.ts`: "the drop reveals". **Pass it a stable array** (a `computed`).
4. Dossier (`.ds`), from the owner's mockup: a mosaic (big photo, 2×2 orange metric cells, photos) on the left and a tall map on the right. Clicking a mosaic photo opens it in the gallery via `openPhoto(i)`.
5. CTA over `assets/media/projects/cta-dam.webp` (owner-generated).
- **Hand-offs (one water story, no extra pipes):** story (white) → gallery `.dg`: a flipped `app-hx-wave-edge` (white over the deep blue) = going under the surface; gallery (#0b4c91 → #0a3d73 → #0b4c91) → dossier: a wave edge rising into light water; `.ds` is #eaf5fd; the CTA photo emerges from #eaf5fd through `.pd-cta::before` (fade, no hard line); CTA ends navy → footer joint.

### Contact (`features/contact/contact.component.ts`)
SIGAT's work is ~70 % pipe installation, so the page shows **how a water main is laid**, then connects the visitor.
1. `components/contact-laying.component.ts` + `components/pipe-laying-engine.ts`: one-screen hero (owner: **no long scroll, no step labels**): centred title + CTAs, then a wide live window on a trench that **plays by itself and loops** (36 s build, 6 s hold, fade, `restart()`; reduced motion = still frame at p 0.8) through 7 real stages (`LAY_BOUNDS`): excavation → sand bedding (15 cm lifts, plate compactor) → laying & jointing (ductile iron, blue epoxy, cement lining in cutaway; lifted from the bank in slings = damped pendulum driven by hook acceleration; spigot pushed through the EPDM gasket to the white insertion mark) → 90° bend + riser + air valve with a **concrete thrust block** on the outside of the bend → initial backfill to 30 cm over the crown, joints left open → **pressure test** (line valve opened, slow fill with meniscus, air out at the air valve then a spurt; hand pump stroke by stroke to STP = 1.5 × PN10 = 15 bar, held) → final backfill in lifts, asphalt reinstatement, water in service. Excavator arm = 2-link IK; spoil heap volume follows excavation/backfill.
2. `app-wave-pipe` joint (`#8f6f4a` soil → `#eef7fd`): the page's only pipe joint.
3. `components/project-inquiry.component.ts` (`.ci`): the form is "the connection": a vertical glass pipe fills as its 5 steps are completed (`done` / `progress` signals), flange markers turn orange.
   **One door, five routes:** the visitor picks client / supplier / subcontractor / partner / job; each gets its own step-2/3 fields (`FIELDS`), side panel "what happens next", and mailbox (`CONTACT_ROUTES`, subject tag `[SIGAT·<tag>]`). `/contact?type=partner` (or `?type=job&role=j_engineer`) preselects. Delivery: POST to `FORM_ENDPOINT` if set, otherwise a pre-written `mailto:`. Consent checkbox links `/legal#privacy`; honeypot field.
4. `components/contact-office.component.ts` (`.co`, dark blue card), 5. map (`.cm`, `#eaf5fd` = `LAST_SECTION_COLOR['/contact']`).
- Trust / process / featured-project / CTA banner were removed from the page (the installation sequence replaces them).

### Partnerships / HSE / Careers / Legal
- All use `app-page-hero` + `pg-*` blocks (`hydro.css`). Every CTA routes to the contact form with the right `?type=`.
- **SIGAT is NOT ISO certified** — the process is in progress. HSE shows the 3 standards as "Démarche en cours" from `COMPANY_INFO.certifications`. Never claim certification, invented safety statistics, "since 2009" or "Algeria".
- **HSE:** commitments (white → foam) → ISO "in progress" (foam) → `hse-trench.component.ts` (`ht-*`, reuses `crv-*`): a trench made safe by the rules — 1 networks located (cable locator, paint marks), 2 fencing + sign + worker in PPE, 3 trench 1.80 m × 1.00 m shored (> 1.30 m and width ≤ ⅔ depth), panels +15 cm above ground, hydraulic struts pumped out, spoil ≥ 0.40 m from the edge, ladder above the edge, 4 pipe on bedding, backfill, reinstatement, tick. Desktop = pinned scroll sequence (`.ht` 300vh, `overflow: clip` — never `hidden`, it breaks sticky); labels `hse_dim_*`; the SVG is `direction: ltr` so labels keep their anchor in Arabic. CTA on #eaf5fd.
- **Legal:** reading gauge (sight glass filling as you read, a flange per section, sticky) + company identity as a riveted **nameplate** + privacy cards; foam → white → #eaf5fd.
- **Partnerships:** who (white → foam) → why (foam) → `partnerships-joint.component.ts` (reuses `crv-*` section/steps + `jt-*`): a flanged joint made up on site, one stage per partnership step — spool brought up, gasket in, studs tightened in the cross pattern 1-5-3-7-2-6-4-8 (flange-face inset), then water through and the gauge holding. Joint sticky beside the steps on desktop. Enters under a flipped foam wave, leaves through a wave into `.cr-spont` #eaf5fd = `LAST_SECTION_COLOR['/partnerships']`.
- **Careers:** why (foam → white) → openings (white) → `careers-reservoir.component.ts` (`crv-*`): a reinforced-concrete reservoir in section (hatched walls/slabs, inlet main through the roof with a free jet, overflow bellmouth, vent, hatch, outlet + gate valve, level board). Scroll sets the wanted level; it fills at a finite rate while the inlet runs and drains through the outlet when you go back; the 4 hiring stages light as the water passes their marks. Enters under a flipped white wave, leaves through a wave into `.cr-spont` #eaf5fd = `LAST_SECTION_COLOR['/careers']`. Phones: heading → reservoir → stages.
- Legal (`/legal`, `#privacy`): mentions légales from `COMPANY_INFO.legal` (empty = "En cours de mise à jour") + privacy policy under loi organique 2004-63 (INPDP).
- Projects page has a references table (`components/projects-references.component.ts`, `.rf`) from `Project.amount` / `Project.status`.

### About
`features/about/about.component.ts`. Values = `components/values-pump.component.ts`: impeller pump with 6 values orbiting it (Kepler ω ∝ R^-1.5). Its discharge pipe leaves the section sideways. Section id is `values` (Home links to `/about#values`).

## Rules for every change
- **Physics must be credible.** Gravity ~1650 px/s². Use real relations (Torricelli, continuity, test pressure = 1.5 × PS, Fresnel-weak reflections). Never animate water in a way that breaks them.
- **Pipes are used sparingly (owner's request):** the glass pipe appears only under each page's first section (hero) and in the footer (the header has none, owner's request) — plus the owner-requested Home joint values → projects. Never add other pipe joints between sections. Use clean edges or soft gradients.
- **Section hand-off colours:** the next section starts with the colour the previous one ends with. Joints are `app-wave-pipe` with `fillAbove` / `fillBelow`. Home's last section is the pool `#0b4c91`, set in `LAST_SECTION_COLOR` in main-layout.
- Brand: blues `#04294f → #1565c0 → #4fb3ff`, water `#9cdef9 / #ade9fd`, accent orange `#ff7a1a`. Headings use Sora (`.hx-display`), Tajawal for Arabic.
- **Logo:** use the official PNGs `assets/media/logo/sigatlogo-trim.png` (blue) and `sigatlogo-white-trim.png`. Never redraw the logo (the owner rejected the SVG `brand-mark`).
- Every animation needs reduced-motion handling and must pause off-screen (use HydroTicker).
- **Verify visually.** Build, then screenshot with headless Edge over CDP at 1440×900 and 390×844, and check for console errors and horizontal overflow. There's a script pattern in the session scratchpad; recreate it if needed: a static server for `dist/sigat-website/browser`, then `Page.captureScreenshot`.

## Open items
- `SAMPLE_DATA = true` shows "Données indicatives" on references and careers: set false once real data is in.
- TODO from SIGAT: real phone, legal ids (RNE, matricule fiscal, capital, gérant, host), real references (client, value band, status), real openings, company profile PDF, form endpoint, domain (then add Sitemap to `public/robots.txt` and an absolute og:image).
- E-mail is `sigatsigat93@gmail.com` (verified). WhatsApp links to /contact until the phone is set. Social channels are Facebook (real page), LinkedIn, WhatsApp, e-mail and location only; there is no Instagram, TikTok or YouTube.
- Projects 2–6 still use Unsplash stock photos (`imageUrl`). Replace them with real SIGAT field photos (`media.cover`).
- Next pages to bring into the system: Expertise, Projects (pipe joints, water hero, hand-off colours).
