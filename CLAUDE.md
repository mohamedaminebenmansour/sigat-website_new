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
| Header (blue bar, official white logo, glass pipe along bottom edge) | `src/app/layout/components/header.component.ts` |
| Footer (water background, wavy pipe; `above` = colour of the page's last section) | `src/app/layout/components/footer.component.ts` |
| **Company contact data (single source)** | `src/app/core/company/company-info.ts` |
| Social links (read company-info) | `src/app/core/social/social-links.ts` |
| Company values (6, shared by Home + About) | `src/app/features/about/components/values.data.ts` |
| Company figures (15+, 120+, 500 km+, 300+) | `src/app/features/media-showcase/data/company-stats.data.ts` |
| Translations (always edit all 3) | `src/assets/i18n/{fr,en,ar}.json` |
| Design tokens + all `hx-*` / `ww-*` / `vp-*` CSS | `src/styles/hydro.css` |

### Home (`src/app/features/home/home.component.ts`)
Story: **where SIGAT's water comes from**, shown as a real installation.
1. `sections/home-hero.component.ts`: sticky video. Wave-equation water rises with scroll. Below it is the page's only pipe joint.
2. `sections/home-water-scene.component.ts` + `sections/water-scene-engine.ts` (the owner's favourite design, **no photo**). The cycle is **FILL → DROPS → HOLD → SINK**:
   - the ring reservoir **starts empty**. The pump fills it (water climbs the J and pours from the gooseneck) up to the HIGH switch;
   - 5 drops form at the left leg, carrying 15+, 120+, 500 km+, 300+ and 2010 (founding year, key `ws_founded`). Each drains the ring by 1/5, becomes a low-riding buoy, and launches a **travelling wave packet** (c = 300 px/s). On the first cycle, **the wave that reaches letter i makes it rise** out of the water; afterwards the waves just lift each letter as they pass;
   - HOLD 5 s, then the buoys sink one after another, and the pump refills;
   - touch and mouse: a tap drops heavy water from the top of the view (big splash, waves both ways); a drag leaves a wake and pushes the letters it crosses (spring + sloshing). Phones show figures only on the buoys;
   - the letters are 3D crystal: an 8-layer extrusion, bevel light and inner shadow, glow, inner water with light lines and a travelling glint. Letter tops sit at the ring bottom;
   - no caustic lines above the water; "Notre Histoire" is written on the water; it emits `tailX` for the pump riser;
   - perf: sticky band canvas at DPR 1, pre-rendered sky and sprites, underwater light at half resolution. Glass pipes animate through HydroTicker. **Never use SVG SMIL `<animate>`** (it caused page-wide style recalculation every frame).
3. `about/components/values-pump.component.ts` with `[riserX]="riserX()" [source]="true"`: wet well → suction line with foot valve/strainer → **our own drawn centrifugal pump** (centred, all values visible) → discharge header. The header rises, takes an elbow, then a horizontal run with **swing check valve → gate valve with handwheel → electromagnetic flow meter with a live m³/h reading → pressure gauge on a tee**, then an elbow up to the logo's J. Fittings are blue-epoxy ductile iron with PN16 flanges, drawn in `drawFittings()`. The heading moves to the right when the riser is on the left. The About page uses the same component with default inputs.
   **Pump physics (keep consistent):** the discharge is vertical, on the LEFT of the casing, so rotation is **clockwise** (in a volute the flow leaves tangentially in the direction of rotation). The impeller blades are backward-curved, θ(r) = θ0 − k·ln(r/r1). Casing flow, swirl and value orbits all turn clockwise. Outside the pump the flow is a free vortex: ω ∝ 1/r². Each value is linked to the pump by a log-spiral streamline. No text labels on the drawing (owner's request).
4. `sections/home-projects.component.ts`, then 5. `sections/home-tap.component.ts`.
- "Le réseau" and "Le chantier" were **removed** at the owner's request.
- The old `water-world` engine and the photo version (`home-about`, `home-logo-reservoir`, `assets/media/home`) were removed or are unused.

### Expertise (`features/expertise/expertise.component.ts`)
- Data: `MockDataService.getExpertise()`. The model has translatable `slug / titleKey / descriptionKey / detailKeys` (i18n prefix `exp_*`). Legacy English `title/description/details` are still used by `expertise-detail.component.ts`.
- Page order:
  1. Hero: field photo, with the glass pipe as its lower edge.
  2. `components/expertise-hub.component.ts`: SVG ring main + glass drop. The drop's free surface is a damped oscillator. Selecting a node sends a droplet down its spoke, and the node ripples on arrival. Auto-cycles until the user interacts.
  3. Pipe joint, then `components/expertise-flow.component.ts`: zig-zag cards threaded on an S-bend pipe measured from the card positions. The water front follows scroll, and an icon tile fills when the water passes its card.
- Styles: `xp-* / xh-* / xf-*` in `hydro.css`. Checked at 390, 834, 1440 and 1920 px.

### Projects (`features/projects/projects.component.ts`)
"Where the water arrives". The site's pipe ends here.
- `components/projects-hero.component.ts`: a black PE100 main with blue stripes (potable-water code), running partly full. The free overfall from its invert follows a projectile path and thins as it accelerates (q = h·v). The edges are aerated, the jet breaks into drops, and it plunges into a pool whose deep colour (`#0a3d73`) starts the next section.
- `components/projects-manifold.component.ts`: the filter is a header pipe with gate-valve handwheels. Opening one turns it multi-turn and routes water down its branch.
- `components/sight-glass-card.component.ts`: each project sits behind a bolted flanged sight glass with a flow rotor. Hover raises the level and speeds up the rotor. Pipe stubs join the cards in a row.
- The head office (`isOffice`) is excluded from the list but stays on the map. Styles: `pj-* / mf-* / sg-*`.

### Project detail (`features/projects/project-detail.component.ts`, `/projects/:id`)
**This page is for reading ONE project. Never add project-to-project navigation.**
1. `components/project-pipe-hero.component.ts`: the project photo inside a PE100 pipe bore. This is the page's only pipe joint.
2. Reading: the owner's `project-story` accordion with `[showGallery]="false"`. A `[storyAside]` **ring** (`.pc`) holds the project's general photo inside a thick light-blue ring, with orange markers on its left rim for location, period, client, category and scope. On laptop+ the ring bleeds off the right edge.
3. `components/project-drop-gallery.component.ts`: "the drop reveals". **Pass it a stable array** (a `computed`).
4. Dossier (`.ds`), from the owner's mockup: a mosaic (big photo, 2×2 orange metric cells, photos) on the left and a tall map on the right. Clicking a mosaic photo opens it in the gallery via `openPhoto(i)`.
5. CTA over `assets/media/projects/cta-dam.webp` (owner-generated).

### About
`features/about/about.component.ts`. Values = `components/values-pump.component.ts`: impeller pump with 6 values orbiting it (Kepler ω ∝ R^-1.5). Its discharge pipe leaves the section sideways. Section id is `values` (Home links to `/about#values`).

## Rules for every change
- **Physics must be credible.** Gravity ~1650 px/s². Use real relations (Torricelli, continuity, test pressure = 1.5 × PS, Fresnel-weak reflections). Never animate water in a way that breaks them.
- **Pipes are used sparingly (owner's request):** the glass pipe appears only in the header, under each page's first section (hero), and in the footer. Never add pipe joints between other sections. Use clean edges or soft gradients.
- **Section hand-off colours:** the next section starts with the colour the previous one ends with. Joints are `app-wave-pipe` with `fillAbove` / `fillBelow`. Home's last section is the pool `#0b4c91`, set in `LAST_SECTION_COLOR` in main-layout.
- Brand: blues `#04294f → #1565c0 → #4fb3ff`, water `#9cdef9 / #ade9fd`, accent orange `#ff7a1a`. Headings use Sora (`.hx-display`), Tajawal for Arabic.
- **Logo:** use the official PNGs `assets/media/logo/sigatlogo-trim.png` (blue) and `sigatlogo-white-trim.png`. Never redraw the logo (the owner rejected the SVG `brand-mark`).
- Every animation needs reduced-motion handling and must pause off-screen (use HydroTicker).
- **Verify visually.** Build, then screenshot with headless Edge over CDP at 1440×900 and 390×844, and check for console errors and horizontal overflow. There's a script pattern in the session scratchpad; recreate it if needed: a static server for `dist/sigat-website/browser`, then `Page.captureScreenshot`.

## Open items
- Real phone and e-mail are TODO in `company-info.ts`. WhatsApp links to /contact until the phone is set. Social channels are Facebook (real page), LinkedIn, WhatsApp, e-mail and location only; there is no Instagram, TikTok or YouTube.
- Projects 2–6 still use Unsplash stock photos (`imageUrl`). Replace them with real SIGAT field photos (`media.cover`).
- Next pages to bring into the system: Expertise, Projects, Contact (pipe joints, water hero, hand-off colours).
