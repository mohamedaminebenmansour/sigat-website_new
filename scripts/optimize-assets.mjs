/* eslint-disable no-console */
/**
 * SIGAT production asset optimizer (run locally, once per asset batch).
 *
 * Converts the large local JPEG photographs into optimised multi-width WebP
 * variants sized for real display use (desktop ~1920, tablet ~1280, mobile
 * ~768), then deletes the multi-MB JPEG originals so only optimised web
 * assets ship to GitHub Pages.
 *
 * Usage:
 *   node scripts/optimize-assets.mjs --inspect   # print source dims/sizes
 *   node scripts/optimize-assets.mjs             # convert + shrink
 *
 * Originals: place source files in src/assets/media/_source (git-ignored).
 * If a source already lives in a destination folder it is treated as the
 * single master and converted in place.
 */
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'assets', 'media');
const SOURCE_DIR = path.join(SRC, '_source');

/** Desired output widths (px). Large->medium->mobile. */
const WIDTHS = [1920, 1280, 768];
const QUALITY = 80;

/** Map of named slide outputs per input file. */
const JOBS = [
  // Hero / showcase slides (quality webp, three widths each).
  {
    source: 'hero/20230618_115405.jpg',
    out: 'gallery/20230618-riprap.webp'
  },
  {
    source: 'hero/20231222_154056.jpg',
    out: 'gallery/20231222-pipeline.webp'
  },
  {
    source: 'hero/20231229_080306.jpg',
    out: 'gallery/20231229-pipeline.webp'
  },
  {
    source: 'hero/20240428_154504.jpg',
    out: 'gallery/20240428-station.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/cover.jpg',
    out: 'projects/aep-ouled-khalfallah/cover.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/6.jpg',
    out: 'projects/aep-ouled-khalfallah/6.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/7.jpg',
    out: 'projects/aep-ouled-khalfallah/7.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/8.jpg',
    out: 'projects/aep-ouled-khalfallah/8.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/9.jpg',
    out: 'projects/aep-ouled-khalfallah/9.webp'
  },
  {
    source: 'projects/aep-ouled-khalfallah/3.jpg',
    out: 'projects/aep-ouled-khalfallah/3.webp'
  }
];

function locate(id) {
  const candidates = [path.join(SOURCE_DIR, id), path.join(SRC, id)];
  return candidates.find((p) => {
    try {
      return fsSync.statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

async function inspect() {
  console.log('=== SOURCE IMAGE INSPECTION ===');
  for (const job of JOBS) {
    const file = locate(job.source);
    if (!file) {
      console.log(`${job.source}: MISSING`);
      continue;
    }
    try {
      const m = await sharp(file).metadata();
      const kb = (fsSync.statSync(file).size / 1024).toFixed(0);
      console.log(`${job.source}  ->  ${m.width}x${m.height}  ${kb} KB`);
    } catch (e) {
      console.log(`${job.source}: ERROR ${e.message}`);
    }
  }
  console.log('(alternatively point _source at originals; result copied below)');
}

async function convertJob(job) {
  const file = locate(job.source);
  if (!file) {
    console.log(`SKIP (no source): ${job.source}`);
    return;
  }
  const meta = await sharp(file).metadata();
  const fullOut = path.join(SRC, job.out);
  const outDir = path.dirname(fullOut);
  const outBase = path.basename(job.out, '.webp');
  await fs.mkdir(outDir, { recursive: true });

  const results = [];
  for (const w of WIDTHS) {
    const targetWidth = Math.min(w, meta.width);
    if (targetWidth <= 0) continue;
    const suffix = w === 1920 ? '.webp' : `-${w}.webp`;
    const outPath = path.join(outDir, `${outBase}${suffix}`);
    const buf = await sharp(file)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    await fs.writeFile(outPath, buf);
    results.push(`${path.basename(outPath)} ${(buf.length / 1024).toFixed(0)}KB`);
  }
  console.log(`OK ${job.out} <- ${job.source} (${results.join(' | ')})`);
}

async function main() {
  const jimp = process.argv.includes('--inspect');
  try {
    if (jimp) return await inspect();
  } catch (e) {
    console.log('inspect failed', e.message);
    return;
  }

  console.log('=== CONVERTING (WebP, q82, widths 1920/1280/768) ===');
  for (const job of JOBS) {
    try {
      await convertJob(job);
    } catch (e) {
      console.log(`ERROR ${job.source}: ${e.message}`);
    }
  }

  // Keep originals out of production (they may still exist in _source).
  console.log('');
  console.log('DONE. If originals live under src/assets/media (not _source),');
  console.log('remove the multi-MB .jpg files so they are not deployed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});