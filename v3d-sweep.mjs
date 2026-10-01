// v3d-sweep.mjs - measurement harness for the Values3d redesign.
// Headless Edge + CDP against the running dev server (ng serve, dev mode,
// so the component's [values-3d] audits log to console).
//
// Sweep: 10 target viewports x FR / EN / AR. Per cell: scene rect, fit,
// width usage (DOM union of rings + bodies), containment, horizontal scroll,
// Sun centring, rendered sizes, projected ellipse ratio + dev audit lines.
// Modes: full (default) = matrix + 50s full-orbit-cycle watch + drift check;
//        --quick         = 3 viewports x FR only.
// Not part of the app.
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9446;
const PROFILE = 'C:\\Users\\Lenovo\\Desktop\\sigat-website\\.v3d-sweep-profile';
const APP_URL = 'http://localhost:4200/';
const MODE = process.argv.includes('--quick') ? 'quick' : 'full';

const VIEWPORTS_FULL = [
  { name: '320', w: 320, h: 568 },
  { name: '360', w: 360, h: 640 },
  { name: '390', w: 390, h: 844 },
  { name: '430', w: 430, h: 932 },
  { name: '768', w: 768, h: 1024 },
  { name: '834', w: 834, h: 1112 },
  { name: '1024', w: 1024, h: 768 },
  { name: '1280', w: 1280, h: 800 },
  { name: '1440', w: 1440, h: 900 },
  { name: '1920', w: 1920, h: 1080 },
];
const VIEWPORTS_QUICK = [
  { name: '390', w: 390, h: 844 },
  { name: '1440', w: 1440, h: 900 },
  { name: '1920', w: 1920, h: 1080 },
];
const VIEWPORTS = MODE === 'quick' ? VIEWPORTS_QUICK : VIEWPORTS_FULL;
const LANG_SWITCH_VIEWPORT = { w: 1440, h: 900 }; // desktop header selector (>=768)
const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'عر' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error('DevTools endpoint never came up: ' + url);
}
// ---- in-page gatherer (serialized; no closure over node scope) ----------
const gather = () => {
  const scene = document.querySelector('.v3d-scene');
  if (!scene) return null;
  const sc = scene.getBoundingClientRect();
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const unionOf = (rects) => {
    const list = rects.filter(Boolean);
    if (!list.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of list) {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const sun = document.querySelector('.v3d-sun');
  const halo = document.querySelector('.v3d-sun-halo');
  const planets = [...document.querySelectorAll('.v3d-planet')];
  const paths = [...document.querySelectorAll('.v3d-orbit-traces path')];
  const sunRect = rect(sun);
  const haloRect = rect(halo);
  const planetRects = planets.map(rect);
  const pathRects = paths.map(rect);
  const u = unionOf([sunRect, haloRect, ...planetRects, ...pathRects]);

  const cs = getComputedStyle(scene);
  const fit = parseFloat(cs.getPropertyValue('--v3d-fit')) || 0;
  // Projected ellipse of the OUTER ring: major/minor = 1/cos(alpha).
  const outer = pathRects.filter(Boolean).sort((a, b) => b.width - a.width)[0];
  const ellipseRatio = outer && outer.height > 0 ? +(outer.width / outer.height).toFixed(3) : null;

  const insideDbg = u
    ? {
        dxLeft: +(u.x - sc.x).toFixed(1),
        dyTop: +(u.y - sc.y).toFixed(1),
        dxRight: +((sc.x + sc.width) - (u.x + u.w)).toFixed(1),
        dyBottom: +((sc.y + sc.height) - (u.y + u.h)).toFixed(1),
        ux: +u.x.toFixed(1), uy: +u.y.toFixed(1), uw: +u.w.toFixed(1), uh: +u.h.toFixed(1),
        sx: +sc.x.toFixed(1), sy: +sc.y.toFixed(1), sw: +sc.width.toFixed(1), sh: +sc.height.toFixed(1),
      }
    : null;

  const inside = u
    ? u.x >= sc.x - 1.5 && u.y >= sc.y - 1.5 &&
      u.x + u.w <= sc.x + sc.width + 1.5 && u.y + u.h <= sc.y + sc.height + 1.5
    : false;

  // WHO overflows, and by how much (scene px).
  const overflow = [];
  const check = (name, r) => {
    if (!r) return;
    const over = {
      name,
      left: +(sc.x - r.x).toFixed(1),
      top: +(sc.y - r.y).toFixed(1),
      right: +((r.x + r.width) - (sc.x + sc.width)).toFixed(1),
      bottom: +((r.y + r.height) - (sc.y + sc.height)).toFixed(1),
    };
    if (over.left > 1.5 || over.top > 1.5 || over.right > 1.5 || over.bottom > 1.5) overflow.push(over);
  };
  check('sun', sunRect);
  check('halo', haloRect);
  planets.forEach((p, i) => check('planet' + (i + 1), planetRects[i]));
  pathRects.forEach((r, i) => check('trace' + (i + 1), r));
  check('dots', rect(document.querySelector('.v3d-dots')));

  const sunCentered = sunRect
    ? {
        dx: +((sunRect.x + sunRect.width / 2) - (sc.x + sc.width / 2)).toFixed(1),
        dy: +((sunRect.y + sunRect.height / 2) - (sc.y + sc.height / 2)).toFixed(1),
      }
    : null;

  const sunVar = cs.getPropertyValue('--v3d-sun').trim();
  const sunD = sunVar ? parseFloat(sunVar) * fit : 0;
  const planetD = planets.map((p) => (parseFloat(p.style.getPropertyValue('--v3d-pd')) || 0) * fit);
  const titles = planets.map((p) => (parseFloat(p.style.getPropertyValue('--v3d-title-size')) || 0) * fit);
  const descs = planets.map((p) => (parseFloat(p.style.getPropertyValue('--v3d-desc-size')) || 0) * fit);

  // Instantaneous pairwise disc overlap (this phase only), scene px.
  let worstPairOverlap = 0;
  let worstPair = '';
  for (let i = 0; i < planetRects.length; i++) {
    for (let j = i + 1; j < planetRects.length; j++) {
      const a = planetRects[i], b = planetRects[j];
      if (!a || !b) continue;
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ox > 0 && oy > 0 && Math.min(ox, oy) > worstPairOverlap) {
        worstPairOverlap = Math.min(ox, oy);
        worstPair = (i + 1) + '-' + (j + 1);
      }
    }
  }

  const de = document.documentElement;
  return {
    scene: { w: Math.round(sc.width), h: Math.round(sc.height) },
    fit: +fit.toFixed(4),
    lang: de.lang,
    dir: de.dir,
    widthUsagePct: u && sc.width > 0 ? +((u.w / sc.width) * 100).toFixed(1) : null,
    heightUsagePct: u && sc.height > 0 ? +((u.h / sc.height) * 100).toFixed(1) : null,
    union: u ? { w: Math.round(u.w), h: Math.round(u.h) } : null,
    inside,
    insideParts: u
      ? [u.x >= sc.x - 1.5, u.y >= sc.y - 1.5, u.x + u.w <= sc.x + sc.width + 1.5, u.y + u.h <= sc.y + sc.height + 1.5]
      : null,
    insideDbg,
    overflow,
    sceneRect: { x: Math.round(sc.x), y: Math.round(sc.y) },
    hScroll: de.scrollWidth > de.clientWidth + 1,
    sunCentered,
    sunD: +sunD.toFixed(1),
    planetD: planetD.map((v) => +v.toFixed(1)),
    titlePx: titles.map((v) => +v.toFixed(1)),
    descPx: descs.map((v) => +v.toFixed(1)),
    ellipseRatio,
    traces: paths.length,
    worstPairOverlap: +worstPairOverlap.toFixed(1),
    worstPair,
  };
};

const edge = spawn(EDGE, [
  '--headless=new', '--no-proxy-server', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

let ws; let msgId = 0;
const pending = new Map(); const logs = [];
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 30000);
  });
}
async function evalPage(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

const results = [];
const failures = [];

function record(cell) {
  results.push(cell);
  const warn = cell.warnings.length;
  console.log(
    `${cell.lang} ${cell.viewport}: fit=${cell.data?.fit} usage=${cell.data?.widthUsagePct}% ` +
    `inside=${cell.data?.inside ? 'OK' : 'FAIL'} hScroll=${cell.data?.hScroll ? 'FAIL' : 'no'} ` +
    `sun=${cell.data?.sunD} ellipse=${cell.data?.ellipseRatio} warn=${warn} | ` +
    `scene=${JSON.stringify(cell.data?.sceneRect)} union=${JSON.stringify(cell.data?.union)} ` +
    `nOverflow=${cell.data?.overflow?.length ?? '?'} dbg=${JSON.stringify(cell.data?.insideDbg)} ` +
    `parts=${JSON.stringify(cell.data?.insideParts)}`,
  );
  if (!cell.data) { failures.push(`${cell.lang} ${cell.viewport}: no data`); return; }
  if (!cell.data.inside) {
    const who = (cell.data.overflow || []).map((o) => `${o.name}(l${o.left} t${o.top} r${o.right} b${o.bottom})`).join(' ');
    failures.push(`${cell.lang} ${cell.viewport}: bodies outside scene -> ${who}`);
  }
  if (cell.data.hScroll) failures.push(`${cell.lang} ${cell.viewport}: horizontal scroll`);
  if (cell.data.traces !== 6) failures.push(`${cell.lang} ${cell.viewport}: traces=${cell.data.traces}`);
  if (warn > 0) failures.push(`${cell.lang} ${cell.viewport}: ${warn} console warnings: ${cell.warnings.join(' | ')}`);
  for (const a of cell.audits) if (/FAIL|BROKEN|REQUIREMENT/.test(a)) failures.push(`${cell.lang} ${cell.viewport}: ${a}`);
}

async function settleAndGather() {
  let data = null;
  let last = '';
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    data = await evalPage(`(${gather.toString()})()`);
    const key = JSON.stringify(data && [data.fit, data.scene, data.sunD, data.planetD, data.widthUsagePct]);
    if (data && data.fit > 0 && data.traces === 6 && key === last && i >= 3) return data;
    last = key;
  }
  return data;
}

async function switchLanguage(label) {
  await evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Change language');
    if (!b) return 'no-trigger';
    b.click(); return 'opened';
  })()`);
  await sleep(350);
  const res = await evalPage(`(() => {
    const opts = [...document.querySelectorAll('ul[role="listbox"] button')];
    const t = opts.find(o => o.textContent.trim() === ${JSON.stringify(label)});
    if (!t) return 'no-option:' + opts.map(o => o.textContent.trim()).join(',');
    t.click(); return 'switched';
  })()`);
  await sleep(900); // onLangChange -> rAF -> full size pipeline
  return res;
}

try {
  await waitFor(`http://127.0.0.1:${PORT}/json/version`);
  const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: 'PUT' });
  const target = await targetRes.json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (msg.params.exceptionDetails.text || ''));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: LANG_SWITCH_VIEWPORT.w, height: LANG_SWITCH_VIEWPORT.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: APP_URL });

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const ok = await evalPage(`!!document.querySelector('.v3d-planet') && document.querySelectorAll('.v3d-orbit-traces path').length === 6`);
    if (ok) break;
  }

  const cycleWatch = [];
  const driftLog = [];

  for (const lang of LANGS) {
    if (MODE === 'quick' && lang.code !== 'fr') break;
    await send('Emulation.setDeviceMetricsOverride', { width: LANG_SWITCH_VIEWPORT.w, height: LANG_SWITCH_VIEWPORT.h, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
    let switched = 'unchanged';
    const cur = await evalPage(`document.documentElement.lang`);
    if (cur !== lang.code) switched = await switchLanguage(lang.label);
    if (switched.startsWith('no-')) console.log(`WARN language ${lang.code}: ${switched}`);

    let baseline1440 = null;
    for (const vp of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
      logs.length = 0;
      const data = await settleAndGather();
      const audits = logs.filter((l) => l.includes('[values-3d]') && /Sizes:|Spacing:|Sun content overlap|Contained/.test(l));
      const warnings = logs
        .filter((l) => l.startsWith('[warning]') || l.startsWith('[exception]') || l.startsWith('[error]'))
        .map((l) => l.replace('[warning] ', ''));
      record({ lang: lang.code, viewport: vp.name, w: vp.w, h: vp.h, data, audits, warnings });
      if (vp.w === 1440) baseline1440 = JSON.stringify([data?.fit, data?.sunD, data?.planetD]);
    }

    // RESIZE DRIFT: 1440 -> 1920 -> 1440 must return to the SAME numbers.
    if (baseline1440 && MODE === 'full') {
      await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
      await sleep(1200);
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const after = await settleAndGather();
      const key = JSON.stringify([after?.fit, after?.sunD, after?.planetD]);
      driftLog.push({ lang: lang.code, identical: key === baseline1440 });
      if (key !== baseline1440) failures.push(`drift ${lang.code}: sizes changed after resize round-trip`);
    }

    // FULL ORBIT CYCLE watch (fr only): 50s > the 48s cycle.
    if (lang.code === 'fr' && MODE === 'full') {
      await send('Emulation.setDeviceMetricsOverride', { width: LANG_SWITCH_VIEWPORT.w, height: LANG_SWITCH_VIEWPORT.h, deviceScaleFactor: 1, mobile: false });
      await sleep(1500);
      console.log('--- full orbit cycle watch (50s @1440x900 fr) ---');
      let minInside = true;
      let minUsage = 100; let maxUsage = 0;
      let maxPair = 0;
      for (let t = 0; t < 25; t++) {
        logs.length = 0;
        const d = await evalPage(`(${gather.toString()})()`);
        if (d) {
          if (!d.inside) minInside = false;
          if (d.widthUsagePct != null) { minUsage = Math.min(minUsage, d.widthUsagePct); maxUsage = Math.max(maxUsage, d.widthUsagePct); }
          maxPair = Math.max(maxPair, d.worstPairOverlap);
        }
        for (const l of logs) if (/\[values-3d\]/.test(l) && /FAIL|BROKEN|REQUIREMENT/.test(l)) failures.push(`cycle t=${t}: ${l}`);
        cycleWatch.push({ t: t * 2, inside: d?.inside, usage: d?.widthUsagePct, pair: d?.worstPairOverlap });
        await sleep(2000);
      }
      console.log(`cycle: inside(all)=${minInside} usage=${minUsage.toFixed(1)}-${maxUsage.toFixed(1)}% worstPairOverlap=${maxPair.toFixed(1)}px`);
      if (!minInside) failures.push('cycle: bodies left the scene during a full revolution');
    }
  }

  const out = { mode: MODE, results, cycleWatch, driftLog, failures };
  const file = join(tmpdir(), `v3d-sweep-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('\n=== FAILURES (' + failures.length + ') ===');
  for (const f of failures) console.log(' - ' + f);
  console.log('JSON: ' + file);

  console.log('\n=== WIDTH USAGE % (DOM union of rings+bodies+sun / scene) ===');
  const vps = VIEWPORTS.map((v) => v.name);
  console.log('lang   ' + vps.map((n) => n.padStart(6)).join(''));
  for (const lang of LANGS) {
    const row = vps.map((n) => {
      const c = results.find((r) => r.lang === lang.code && r.viewport === n);
      return (c?.data?.widthUsagePct ?? '-').toString().padStart(6);
    });
    console.log(lang.code.padEnd(6) + row.join(''));
  }
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  edge.kill();
  await sleep(800);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

