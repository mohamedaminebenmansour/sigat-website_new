// Temporary STEP-2 verification probe: headless Edge + CDP against the
// running dev server. Captures the component's dev-mode validator console
// output and the rendered geometry at 4 viewports. Not part of the app.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9445;
const PROFILE = 'C:\\Users\\Lenovo\\Desktop\\sigat-website\\.v3d-edge-profile';
const APP_URL = 'http://localhost:4200/';
const VIEWPORTS = [
  { name: 'tablet  834x1112', w: 834, h: 1112 },
  { name: 'laptop 1440x900', w: 1440, h: 900 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs = 20000) {
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

const gather = () => {
  const r = (el) =>
    el ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
  const scene = document.querySelector('.v3d-scene');
  const sun = document.querySelector('.v3d-sun');
  const planets = [...document.querySelectorAll('.v3d-planet')];
  const cs = scene ? getComputedStyle(scene) : null;
  const sc = r(scene);
  const sunR = r(sun);
  const spheres = planets.map((p) => r(p.querySelector('.v3d-planet-sphere')));
  const inside = spheres.filter((s) => s && sc).every((s) => s.x >= sc.x - 1 && s.y >= sc.y - 1 && s.x + s.w <= sc.x + sc.w + 1 && s.y + s.h <= sc.y + sc.h + 1);
  return {
    scene: sc,
    fit: cs ? cs.getPropertyValue('--v3d-fit').trim() : null,
    aspect: cs ? cs.getPropertyValue('--v3d-scene-aspect').trim() : null,
    sunVar: cs ? cs.getPropertyValue('--v3d-sun').trim() : null,
    sunTitle: cs ? cs.getPropertyValue('--v3d-sun-title-size').trim() : null,
    pd: planets.map((p) => p.style.getPropertyValue('--v3d-pd')),
    titles: planets.map((p) => p.style.getPropertyValue('--v3d-title-size')),
    traces: document.querySelectorAll('.v3d-orbits path').length,
    sun: sunR,
    allPlanetsInsideScene: inside,
    scrollH: document.documentElement.scrollHeight,
  };
};

const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions',`--remote-debugging-port=${PORT}`,`--user-data-dir=${PROFILE}`,'about:blank'], { stdio: 'ignore' });
let ws; let msgId = 0;
const pending = new Map(); const logs = [];
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 20000);
  });
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

  for (const vp of VIEWPORTS) {
    logs.length = 0;
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: APP_URL });
    let last = ''; let data = null;
    for (let i = 0; i < 30; i++) {
      await sleep(600);
      data = await send('Runtime.evaluate', { expression: `(${gather.toString()})()`, returnByValue: true });
      const d = data.result.value;
      const key = JSON.stringify([d.fit, d.scene, d.pd, d.sunVar]);
      // stable twice in a row AND at least ~2.4s of settle time (the aspect
      // feature changes the scene height once, which re-triggers the pass).
      if (key === last && d.fit && i >= 3) break;
      last = key;
    }
    const d = data.result.value;
    console.log('=== ' + vp.name + ' ===');
    console.log(`scene=${d.scene?.w}x${d.scene?.h} fit=${d.fit} aspect=${d.aspect} sunØ=${d.sunVar} sunTitle=${d.sunTitle}`);
    console.log(`planets pd=${d.pd.join(',')} titles=${d.titles.join(',')}`);
    console.log(`CHECK containment=${d.allPlanetsInsideScene ? 'OK' : 'FAIL'} traces=${d.traces}`);
    const v = logs.filter((l) => l.includes('values-3d'));
    for (const line of v) {
      if (/Sizes:|Spacing:|Sun content overlap|Trace coincidence/.test(line)) console.log('  ' + line);
    }
    const warns = v.filter((l) => l.startsWith('[warning]'));
    const exceptions = logs.filter((l) => l.startsWith('[exception]') || l.startsWith('[error]'));
    console.log('  WARNINGS: ' + (warns.length ? warns.map((w) => w.replace('[warning] [values-3d] ', '')).join(' || ') : 'none'));
    if (exceptions.length) console.log('  ERRORS: ' + exceptions.join(' || '));
    console.log('');
  }
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  edge.kill();
  await sleep(800);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}
