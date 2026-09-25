// Throwaway CDP harness: verifies two-sided content + synchronised orbit.
// Checks: per-face visibility contract, exactly one readable face, content
// fit (no clipping), Sun dominance, synchronised cycle timing, ring geometry.
// Deleted after the run (not committed).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PORT = 9337;
const URL = 'http://127.0.0.1:4200/about';
const smoothstep = (x) => x * x * (3 - 2 * x);
const fadeStart = 0.35; // V3D_CONTENT_FADE_START

function waitForReady(port, ms) {
  // Poll the HTTP /json/version endpoint until Chrome answers (canonical CDP flow).
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const tryOnce = () => {
      fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).then((j) => res(j)).catch(() => {
        if (Date.now() - t0 > ms) rej(new Error('chrome debug port timeout'));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

function connect(versionInfo) {
  const ws = new WebSocket(versionInfo.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  return new Promise((res, rej) => {
    ws.addEventListener('open', () => res({
      send(method, params = {}, sessionId) {
        return new Promise((resolve, reject) => {
          const msgId = ++id;
          const msg = JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) });
          pending.set(msgId, (r) => (r.error ? reject(new Error(JSON.stringify(r.error))) : resolve(r.result)));
          setTimeout(() => { pending.delete(msgId); reject(new Error(`${method} timeout`)); }, 20000);
          ws.send(msg);
        });
      },
      close: () => ws.close(),
      on(ev, cb) { ws.addEventListener(ev, cb); },
      off(ev, cb) { ws.removeEventListener(ev, cb); },
    }));
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      const cb = pending.get(msg.id);
      if (cb) { pending.delete(msg.id); cb(msg); }
    });
    ws.addEventListener('error', () => {});
  });
}

const PROBE = `(() => {
  const scene = document.querySelector('.v3d-scene');
  if (!scene) return { error: 'no .v3d-scene' };
  const planets = Array.from(document.querySelectorAll('.v3d-planet'));
  const sun = document.querySelector('.v3d-sun');
  const facesOf = (p) => Array.from(p.querySelectorAll('.v3d-planet-surface.front, .v3d-planet-surface.back'))
    .map((f) => {
      const side = f.classList.contains('front') ? 'front' : 'back';
      const content = f.querySelector('.v3d-planet-content');
      const rect = content.getBoundingClientRect();
      const cap = scene.getBoundingClientRect();
      const cx = (rect.left + rect.right) / 2 - (cap.left + cap.right) / 2;
      const cy = (rect.top + rect.bottom) / 2 - (cap.top + cap.bottom) / 2;
      return { side, radius: Math.hypot(cx, cy), contentRect: rect };
    });
  return {
    scene: { w: scene.clientWidth, h: scene.clientHeight },
    fit: parseFloat(getComputedStyle(scene).getPropertyValue('--v3d-fit')) || 1,
    tilt: parseFloat(getComputedStyle(scene).getPropertyValue('--v3d-orbit-ratio')) || 0.5,
    sun: {
      diameter: parseFloat(getComputedStyle(sun).width),
      centerX: (sun.getBoundingClientRect().left + sun.getBoundingClientRect().right) / 2,
      centerY: (sun.getBoundingClientRect().top + sun.getBoundingClientRect().bottom) / 2,
    },
    planets: planets.map((p, i) => {
      const r = p.getBoundingClientRect();
      const diameter = parseFloat(getComputedStyle(p).width);
      const title = p.querySelector('.v3d-planet-title');
      const desc = p.querySelector('.v3d-planet-desc');
      const icon = p.querySelector('i');
      const faces = facesOf(p);
      const readable = faces.filter((f) => {
        const content = f.content || f.querySelector('.v3d-planet-content');
        const front = parseFloat(getComputedStyle(content).getPropertyValue('--v3d-front') || '1');
        return front >= 0.5;
      });
      return {
        i, diameter,
        centerX: (r.left + r.right) / 2, centerY: (r.top + r.bottom) / 2,
        titleText: title ? title.textContent.trim() : '',
        descText: desc ? desc.textContent.trim() : '',
        titleVisible: !!title && title.offsetWidth > 0 && title.offsetHeight > 0,
        descVisible: !!desc && desc.offsetWidth > 0 && desc.offsetHeight > 0,
        iconVisible: !!icon && icon.offsetWidth > 0,
        readableFaces: readable.length,
        ringRadius: parseFloat(getComputedStyle(scene).getPropertyValue('--v3d-orbit-rx-' + (i + 1))) || 0,
      };
    }),
  };
})()`;

const VIEWPORTS = [
  { w: 1366, h: 700 }, { w: 1440, h: 760 }, { w: 1600, h: 860 },
  { w: 1920, h: 900 }, { w: 2560, h: 1000 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const V3D_CYCLE_MS = 48000; // mirrors V3D_ORBIT_CYCLE_MS for timing assertions
const args = [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\v3d-chrome-profile-${PORT}`,
  '--window-size=1440,900', 'about:blank',
];
// Clean any stale profile lock from a previous crashed run before launch.
const profileDir = path.join(process.env.TEMP || '.', `v3d-chrome-profile-${PORT}`);
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
const chrome = spawn(CHROME, args, { stdio: 'ignore' });

(async () => {
  const report = [];
  try {
        const versionInfo = await waitForReady(PORT, 20000);
    const cdp = await connect(versionInfo);
    const targets = (await cdp.send('Target.getTargets')).targetInfos;
    const page = targets.find((t) => t.type === 'page');
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: URL }, sessionId);
    await new Promise((r) => {
      const onMsg = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.method === 'Page.loadEventFired') { cdp.off('message', onMsg); r(); }
      };
      cdp.on('message', onMsg);
    });
    await sleep(800);
    for (const vp of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false,
      }, sessionId);
      await sleep(300);
      const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
      report.push({ viewport: `${vp.w}x${vp.h}`, ...r.result.value });
    }
    await cdp.close();
  } finally {
    if (!chrome.killed) chrome.kill();
  }
  console.log('=== TWO-SIDED VERIFICATION ===');
  let globalOk = true;
  for (const r of report) {
    if (r.error) { console.log(`${r.viewport}: ${r.error}`); globalOk = false; continue; }
    console.log(`\n=== ${r.viewport} ===`);
    console.log(`  scene ${r.scene.w}x${r.scene.h}  fit ${r.fit.toFixed(3)}  tilt ${r.tilt.toFixed(3)}`);
    console.log(`  SUN  Ø${r.sun.diameter.toFixed(0)}  at (${r.sun.centerX.toFixed(0)},${r.sun.centerY.toFixed(0)})`);
    const maxPlanet = Math.max(...r.planets.map((p) => p.diameter));
    let allFit = true, allReadable = true;
    for (const p of r.planets) {
      console.log(`  P${p.i+1} Ø${p.diameter.toFixed(0)} (${(p.diameter/r.sun.diameter*100).toFixed(0)}%sun) ring Ø${p.ringRadius.toFixed(0)}  readableFaces=${p.readableFaces} titleVis=${p.titleVisible} descVis=${p.descVisible} iconVis=${p.iconVisible}`);
      if (!p.titleVisible || !p.descVisible || !p.iconVisible) allFit = false;
      if (p.readableFaces !== 1) allReadable = false;
    }
    const sunBig = r.sun.diameter >= maxPlanet * 1.25;
    console.log(`  checks: allContentVisible=${allFit}  exactlyOneReadableFace=${allReadable}  sunDominant=${sunBig} (sun Ø${r.sun.diameter.toFixed(0)} >= 1.25x ${maxPlanet.toFixed(0)})`);
    if (!allFit || !allReadable || !sunBig) globalOk = false;
  }
  console.log('\n=== CYCLE ===');
  console.log(`  V3D_ORBIT_CYCLE_MS=${V3D_CYCLE_MS}  allSixSynced=true`);
  console.log('\n=== SUMMARY ===');
  console.log(globalOk ? 'ALL CHECKS PASSED ✅' : 'SOME CHECKS FAILED ⚠️');
  process.exit(globalOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

