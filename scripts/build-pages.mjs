/**
 * GitHub Pages post-build preparation.
 *
 * Angular's application builder writes the browser app to
 * dist/<project>/browser. For GitHub Pages we need, in that same folder:
 *
 * 1. .nojekyll   -> stops Jekyll from ignoring files starting with "_"
 *                   (protects generated assets/chunks).
 * 2. 404.html    -> SPA deep-link fallback. GitHub Pages serves this file for
 *                   any unknown path (e.g. /sigat-website_new/projects/1).
 *                   Because index.html carries an ABSOLUTE base href
 *                   (/sigat-website_new/), when the fallback boots Angular the
 *                   router reads the real URL and mounts the correct route.
 *                   PathLocationStrategy is preserved (no hash routing).
 *
 * This script performs only file surgery inside the generated output;
 * it does not modify sources or component code.
 */
import { existsSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist', 'sigat-website', 'browser');
const indexHtml = join(browserDir, 'index.html');

if (!existsSync(indexHtml)) {
  console.error(`[build-pages] ERROR: generated index.html not found at ${indexHtml}`);
  console.error('[build-pages] Run "ng build" first.');
  process.exit(1);
}

// 1. Disable Jekyll processing for the published site.
writeFileSync(join(browserDir, '.nojekyll'), '');

// 2. SPA fallback for GitHub Pages deep links.
copyFileSync(indexHtml, join(browserDir, '404.html'));

// Verify the base href actually contains the project path.
const html = readFileSync(indexHtml, 'utf8');
if (!html.includes('base href="/sigat-website_new/"')) {
  console.error(
    '[build-pages] WARNING: base href is not "/sigat-website_new/". ' +
      'Build with: ng build --base-href=/sigat-website_new/'
  );
} else {
  console.log('[build-pages] base href OK (/sigat-website_new/)');
}

console.log('[build-pages] Wrote .nojekyll and 404.html into dist/sigat-website/browser');
