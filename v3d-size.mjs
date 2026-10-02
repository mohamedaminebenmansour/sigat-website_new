// v3d-size.mjs - fast size-only sweep: 10 viewports x 1 language (FR default),
// no orbit-cycle watch. Prints rendered body sizes, content typography, the
// dev audit lines and any overflow/clipping warning. Not part of the app.
//   node v3d-size.mjs [fr|en|ar]
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9447;
const PROFILE = 'C:\\Users\\Lenovo\\Desktop\\sigat-website\\.v3d-size-profile';
const APP_URL = 'http://localhost:4200/';
const LANG = process.argv[2] || 'fr';
const LABEL = { fr: 'FR', en: 'EN', ar: 'عر' }[LANG];

const VIEWPORTS = [
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error('DevTools endpoint never came up');
}

const gather = () => {
  const scene = document.querySelector('.v3d-scene');
  if (!scene) return null;
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
  const sc = scene.getBoundingClientRect();
  const sunRect = rect(sun);
  const haloRect = rect(halo);
  const planetRects = planets.map(rect);
  const pathRects = paths.map(rect);
  const u = unionOf([sunRect, haloRect, ...planetRects, ...pathRects]);

  const cs = getComputedStyle(scene);
  const fit = parseFloat(cs.getPropertyValue('--v3d-fit')) || 0;
  const outer = pathRects.filter(Boolean).sort((a, b) => b.width - a.width)[0];
  const ellipseRatio = outer && outer.height > 0 ? +(outer.width / outer.height).toFixed(3) : null;

  const overflow = [];
  const check = (name, r) => {
    if (!r) return;
    const o = {
      name,
      left: +(sc.x - r.x).toFixed(1), top: +(sc.y - r.y).toFixed(1),
      right: +((r.x + r.width) - (sc.x + sc.width)).toFixed(1),
      bottom: +((r.y + r.height) - (sc.y + sc.height)).toFixed(1),
    };
    if (o.left > 1.5 || o.top > 1.5 || o.right > 1.5 || o.bottom > 1.5) overflow.push(o);
  };
  check('sun', sunRect); check('halo', haloRect);
  planets.forEach((p, i) => check('planet' + (i + 1), planetRects[i]));
  pathRects.forEach((r, i) => check('trace' + (i + 1), r));

  // Exact disc-vs-disc clearance at the frozen relative phases.
  let minGap = Infinity, minPair = '';
  for (let i = 0; i < planetRects.length; i++) {
    for (let j = i + 1; j < planetRects.length; j++) {
      const a = planetRects[i], b = planetRects[j];
      if (!a || !b) continue;
      const d = Math.hypot((a.x + a.width / 2) - (b.x + b.width / 2), (a.y + a.height / 2) - (b.y + b.height / 2));
      const gap = d - (a.width + b.width) / 2;
      if (gap < minGap) { minGap = gap; minPair = (i + 1) + '-' + (j + 1); }
    }
  }

  const de = document.documentElement;
  return {
    scene: { w: Math.round(sc.width), h: Math.round(sc.height) },
    fit: +fit.toFixed(4),
    widthUsagePct: u && sc.width > 0 ? +((u.w / sc.width) * 100).toFixed(1) : null,
    heightUsagePct: u && sc.height > 0 ? +((u.h / sc.height) * 100).toFixed(1) : null,
    inside: !!u && u.x >= sc.x - 1.5 && u.y >= sc.y - 1.5 &&
      u.x + u.w <= sc.x + sc.width + 1.5 && u.y + u.h <= sc.y + sc.height + 1.5,
    overflow,
    hScroll: de.scrollWidth > de.clientWidth + 1,
    sectionH: (() => { const el = document.querySelector('.v3d-scene-section'); if (!el) return 'MISSING'; return Math.round(el.getBoundingClientRect().height) + '/' + (getComputedStyle(el).height || '?'); })(),
    sunD: +(parseFloat(cs.getPropertyValue('--v3d-sun')) * fit).toFixed(1),
    sunTitle: +((parseFloat(cs.getPropertyValue('--v3d-sun-title-size')) || 0) * fit).toFixed(1),
    planetD: planets.map((p) => +((parseFloat(p.style.getPropertyValue('--v3d-pd')) || 0) * fit).toFixed(1)),
    titles: planets.map((p) => +((parseFloat(p.style.getPropertyValue('--v3d-title-size')) || 0) * fit).toFixed(1)),
    descs: planets.map((p) => +((parseFloat(p.style.getPropertyValue('--v3d-desc-size')) || 0) * fit).toFixed(1)),
    icons: planets.map((p) => +((parseFloat(p.style.getPropertyValue('--v3d-icon-size')) || 0) * fit).toFixed(1)),
    ellipseRatio,
    traces: paths.length,
    discGap: +minGap.toFixed(1),
    discPair: minPair,
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
try {
  await waitFor(`http://127.0.0.1:${PORT}/json/version`);
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + msg.params.type + '] ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (msg.params.exceptionDetails.text || ''));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: APP_URL });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await evalPage(`!!document.querySelector('.v3d-planet') && document.querySelectorAll('.v3d-orbit-traces path').length === 6`)) break;
  }
  await evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Change language');
    if (b) b.click(); return 'opened';
  })()`);
  await sleep(350);
  await evalPage(`(() => {
    const o = [...document.querySelectorAll('ul[role="listbox"] button')].find(o => o.textContent.trim() === ${JSON.stringify(LABEL)});
    if (o) o.click(); return 'switched';
  })()`);
  await sleep(1200);

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
    logs.length = 0;
    let data = null; let last = '';
    for (let i = 0; i < 40; i++) {
      await sleep(350);
      data = await evalPage(`(${gather.toString()})()`);
      const key = JSON.stringify(data && [data.fit, data.scene, data.planetD, data.sectionH]);
      if (data && data.fit > 0 && data.traces === 6 && key === last && i >= 3) break;
      last = key;
    }
    const warnings = logs.filter((l) => l.startsWith('[warning]') || l.startsWith('[exception]') || l.startsWith('[error]'))
      .map((l) => l.replace('[warning] [values-3d] ', ''));
    results.push({ viewport: vp.name, data, warnings });
    const d = data;
    console.log(
      `${vp.name.padStart(4)} scene=${d.scene.w}x${d.scene.h} fit=${d.fit} section=${d.sectionH} ` +
      `sun=${d.sunD} sunTitle=${d.sunTitle} ell=${d.ellipseRatio} usage=${d.widthUsagePct}/${d.heightUsagePct}% ` +
      `inside=${d.inside ? 'OK' : 'FAIL'} hScroll=${d.hScroll ? 'FAIL' : 'no'} discGap=${d.discGap}(${d.discPair}) nWarn=${warnings.length}`,
    );
    console.log(`     planets=${d.planetD.join('/')}  titles=${d.titles.join('/')}  descs=${d.descs.join('/')}  icons=${d.icons.join('/')}`);
    for (const w of warnings) console.log('     ! ' + w);
    const audits = logs.filter((l) => /\[values-3d\]/.test(l) && /Sizes:|Contained|Spacing:|Pair clearance/.test(l));
    const lastSizes = audits.filter((l) => l.includes('Sizes:')).slice(-1)[0];
    if (lastSizes) console.log('     ' + lastSizes.replace(/^[^[]*\[values-3d\] /, '').replace(/Â°/g, 'deg'));
    const cont = audits.filter((l) => l.includes('Contained:')).slice(-1)[0];
    if (cont) console.log('     ' + cont.replace(/^[^[]*\[values-3d\] /, '').replace(/Â°/g, 'deg'));
    const pair = audits.filter((l) => l.includes('Pair clearance')).slice(-1)[0];
    if (pair) console.log('     ' + pair.replace(/^[^[]*\[values-3d\] /, '').replace(/Â°/g, 'deg'));
    const spacing = audits.filter((l) => l.includes('Spacing:')).slice(-1)[0];
    if (spacing) console.log('     ' + spacing.replace(/^[^[]*\[values-3d\] /, '').replace(/Â°/g, 'deg'));
  }

  const out = { lang: LANG, results };
  const file = join(tmpdir(), `v3d-size-${LANG}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('\nJSON: ' + file);
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  edge.kill();
  await sleep(600);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}