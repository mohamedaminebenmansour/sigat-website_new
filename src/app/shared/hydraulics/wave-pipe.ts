/**
 * Wavy glass pipe (SIGAT pipe artwork style) rendered as live SVG:
 * glass tube, water with advected foam streaks, glowing cyan coupling rings.
 * Optional fills above/below the wave let it act as a section divider.
 */
export interface WavePipeOptions {
  height: number;          // px
  amplitude?: number;      // px
  wavelength?: number;     // px
  phase?: number;          // rad
  radius?: number;         // pipe outer radius, px
  fillAbove?: string;      // CSS colour or '' (transparent)
  fillBelow?: string;
  speed?: number;          // streak speed, px/s (negative = right-to-left)
  ringSpacing?: number;    // px between glowing rings
}

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function renderWavePipe(host: HTMLElement, o: WavePipeOptions): void {
  const W = Math.max(1, Math.round(host.clientWidth || host.getBoundingClientRect().width));
  const H = o.height, A = o.amplitude ?? H * 0.28, L = o.wavelength ?? Math.max(600, W * 0.75);
  const ph = o.phase ?? 0, r = o.radius ?? 9, mid = H / 2, sp = o.speed ?? 60;
  const id = `wp${++uid}`;
  const y = (x: number) => mid + A * Math.sin((2 * Math.PI * x) / L + ph);
  const dy = (x: number) => A * (2 * Math.PI / L) * Math.cos((2 * Math.PI * x) / L + ph);
  const pts: string[] = [];
  for (let x = -20; x <= W + 20; x += 6) pts.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  const d = 'M' + pts.join(' L');
  const off = (k: number) => {
    const q: string[] = [];
    for (let x = -20; x <= W + 20; x += 6) {
      const t = dy(x), n = Math.hypot(1, t);
      q.push(`${(x - (t / n) * k).toFixed(1)},${(y(x) + (1 / n) * k).toFixed(1)}`);
    }
    return 'M' + q.join(' L');
  };

  const el = (tag: string, attrs: Record<string, string | number>, parent: Element) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent.appendChild(e);
    return e;
  };
  host.innerHTML = '';
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', style: 'display:block' }, host);
  const defs = el('defs', {}, svg);
  const f = el('filter', { id: `${id}g`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 2.4, result: 'b' }, f);
  const m = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, m); el('feMergeNode', { in: 'SourceGraphic' }, m);

  if (o.fillAbove) el('path', { d: `${d} L${W + 20},0 L-20,0 Z`, fill: o.fillAbove }, svg);
  if (o.fillBelow) el('path', { d: `${d} L${W + 20},${H} L-20,${H} Z`, fill: o.fillBelow }, svg);

  const stroke = (dd: string, w: number, c: string, extra: Record<string, string | number> = {}) =>
    el('path', { d: dd, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'butt', ...extra }, svg);
  stroke(d, 2 * r + 10, 'rgba(90,210,255,0.14)');
  stroke(d, 2 * r, 'rgba(185,232,255,0.55)');
  stroke(d, 2 * r - 3, 'rgba(20,130,230,0.72)');
  stroke(d, r * 1.15, 'rgba(70,185,255,0.55)');
  stroke(d, r * 0.4, 'rgba(175,235,255,0.35)');
  // foam streaks advected along the pipe
  [-0.55, -0.15, 0.25, 0.6].forEach((k, i) => {
    const dash = `${12 + i * 7} ${18 + i * 5}`;
    const p = stroke(off(k * r), 1.2 + (i % 2) * 0.6, `rgba(255,255,255,${0.5 - i * 0.06})`, { 'stroke-dasharray': dash });
    // Advected by WavePipeComponent's shared-loop tick (not SMIL: SMIL forced a
    // page-wide style recalculation on every frame). speed in px/s along the pipe.
    p.setAttribute('class', 'wp-streak');
    p.setAttribute('data-v', String(sp * (0.9 + i * 0.08)));
  });
  stroke(off(r), 1.3, 'rgba(25,100,200,0.85)');
  stroke(off(-r), 1.3, 'rgba(25,100,200,0.85)');
  stroke(off(-r * 0.55), Math.max(1.5, r * 0.16), 'rgba(255,255,255,0.8)');
  stroke(off(r * 0.7), 1, 'rgba(255,255,255,0.35)');
  // glowing coupling rings (manchettes)
  const spacing = o.ringSpacing ?? 240;
  for (let x = spacing * 0.5; x < W; x += spacing) {
    const ang = (Math.atan(dy(x)) * 180) / Math.PI;
    const g = el('g', { transform: `translate(${x.toFixed(1)},${y(x).toFixed(1)}) rotate(${ang.toFixed(1)})`, filter: `url(#${id}g)` }, svg);
    el('ellipse', { cx: 0, cy: 0, rx: r * 0.32, ry: r * 1.15, fill: 'none', stroke: 'rgba(120,250,255,0.95)', 'stroke-width': Math.max(1.6, r * 0.16) }, g);
    el('path', { d: `M0,${-r * 1.05} A${r * 0.26},${r * 1.05} 0 0 1 0,${r * 1.05}`, transform: `translate(${r * 0.22},0)`, fill: 'none', stroke: 'rgba(200,255,255,0.7)', 'stroke-width': 1 }, g);
  }
}
