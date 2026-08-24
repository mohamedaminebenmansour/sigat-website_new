# Fix Asset Loading 404s for Media Showcase

## Root Cause Analysis

### Evidence Collected
1. **angular.json** asset configuration is correct:
   - `src/assets` → `assets` output
   - `public` → root output
2. **Build output verification** (`dist/sigat-website/browser/assets/`):
   - `assets/i18n/fr.json` EXISTS
   - `assets/media/hero/20240428_154504.jpg` EXISTS
   - `assets/media/hero/AEP ouled khalfallah (1).mp4` EXISTS (1.2 GB)
3. **public/** directory exists with only `favicon.ico` — no conflict
4. **Media data** (`media.data.ts`) uses absolute paths: `/assets/media/hero/...`
5. **Translate loader** (`app.config.ts`) uses prefix: `./assets/i18n/`
6. **Base href** (`index.html`): `/`
7. **`ng build` succeeds** and copies all assets correctly

### Identified Issues

**Issue 1 — Video filename is URL-unsafe**
- Current filename: `AEP ouled khalfallah (1).mp4`
- Contains spaces and parentheses
- Browsers/servers may fail to match the request path against the physical file due to URL encoding mismatches
- User explicitly suggested: `AEP-ouled-khalfallah-01.mp4`

**Issue 2 — Translate loader uses relative prefix `./`**
- Current prefix: `./assets/i18n/`
- The `./` makes it a relative URL. With `<base href="/">` it resolves to `/assets/i18n/`, but in some environments or if base-href changes, this can break.
- Should be: `assets/i18n/`

**Issue 3 — Image paths are correct but may have been affected by the same dev-server/path resolution issue**
- Since `ng build` output confirms images ARE copied, the configuration is correct.
- Any image 404s are likely a consequence of the same serving/path resolution problem, not a distinct configuration error.

## Plan

### Step 1: Rename video file to URL-safe name
- Rename: `src/assets/media/hero/AEP ouled khalfallah (1).mp4` → `src/assets/media/hero/AEP-ouled-khalfallah-01.mp4`

### Step 2: Update media data configuration
- File: `src/app/features/media-showcase/data/media.data.ts`
- Change video `src` from `/assets/media/hero/AEP ouled khalfallah (1).mp4` to `/assets/media/hero/AEP-ouled-khalfallah-01.mp4`
- Change video `poster` to use the same renamed file or keep existing poster (keep existing poster `20240428_154504.jpg`)

### Step 3: Fix translate loader prefix
- File: `src/app/app.config.ts`
- Change `prefix: './assets/i18n/'` to `prefix: 'assets/i18n/'`

### Step 4: Verify build output
- Run `ng build`
- Confirm `dist/sigat-website/browser/assets/media/hero/AEP-ouled-khalfallah-01.mp4` exists
- Confirm `dist/sigat-website/browser/assets/i18n/fr.json` exists
- Confirm image files are still present

### Step 5: Verify with dev server
- Run `ng serve`
- Test URLs:
  - `http://localhost:4200/assets/i18n/fr.json`
  - `http://localhost:4200/assets/media/hero/20240428_154504.jpg`
  - `http://localhost:4200/assets/media/hero/AEP-ouled-khalfallah-01.mp4`

## Constraints
- Do NOT modify layout, animations, dots, social media positioning, statistics, navbar, typography, responsive design, or component architecture.
- Do NOT replace local media with external URLs.
- Only modify asset paths/filenames and the translate loader prefix.

## Expected Outcome
- All assets served correctly from `/assets/...`
- Video filename is URL-safe
- Translate loader uses a robust non-relative prefix
- `ng build` copies all assets to `dist/sigat-website/browser/assets/`
