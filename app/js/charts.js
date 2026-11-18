// A small line chart in plain SVG, drawn at the width it is given so the text
// stays the same size on a phone and on a desktop. One y-axis, a crosshair
// with a tooltip, optional reference lines and a shaded normal range.
//
// Views call chartSlot() while building their HTML. mountCharts() then draws
// every slot once the HTML is in the page, and again when the window resizes.

import { escapeHtml } from './util.js';

const registry = new Map();

export function clearCharts() {
  registry.clear();
}

/**
 * spec = {
 *   height, unit, digits,
 *   series: [{ name, color, dashed, area, points: [{ x, y }] }],
 *   xTicks: [{ x, label }],
 *   xLabel: (x) => string            tooltip heading
 *   lines:  [{ y, label }]           horizontal reference lines
 *   band:   { from, to }             shaded normal range
 *   vline:  { x, label }             vertical marker, e.g. "i dag"
 *   yMin, yMax                       optional fixed axis ends
 *   label                            description for screen readers
 * }
 */
export function chartSlot(key, spec) {
  registry.set(key, spec);
  const legend = spec.series.length > 1
    ? `<div class="chart-legend">${spec.series
        .map((s) => `<span><i class="swatch${s.dashed ? ' swatch--dashed' : ''}" style="--c:${s.color}"></i>${escapeHtml(s.name)}</span>`)
        .join('')}</div>`
    : '';
  return `${legend}<div class="chart" data-chart="${key}" style="height:${spec.height || 220}px" role="img" aria-label="${escapeHtml(spec.label || '')}"></div>`;
}

export function mountCharts(root = document) {
  root.querySelectorAll('[data-chart]').forEach((el) => {
    const spec = registry.get(el.dataset.chart);
    if (spec) draw(el, spec);
  });
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

function draw(el, spec) {
  const width = el.clientWidth;
  const height = spec.height || 220;
  if (width < 40) return;
  const m = { left: 46, right: 14, top: 26, bottom: 28 };
  const digits = spec.digits ?? 1;
  const nf = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const all = spec.series.flatMap((s) => s.points);
  if (!all.length) {
    el.innerHTML = '<p class="muted">Inga mätvärden att visa.</p>';
    return;
  }
  const xs = all.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ys = all.map((p) => p.y).concat((spec.lines || []).map((l) => l.y));
  let yLo = spec.yMin ?? Math.min(...ys);
  let yHi = spec.yMax ?? Math.max(...ys);
  const pad = (yHi - yLo || Math.abs(yHi) || 1) * 0.12;
  if (spec.yMin == null) yLo -= pad;
  if (spec.yMax == null) yHi += pad;
  const ticks = niceTicks(yLo, yHi);
  yLo = Math.min(yLo, ticks[0]);
  yHi = Math.max(yHi, ticks[ticks.length - 1]);

  const px = (x) => m.left + ((x - x0) / (x1 - x0 || 1)) * (width - m.left - m.right);
  const py = (y) => m.top + (1 - (y - yLo) / (yHi - yLo || 1)) * (height - m.top - m.bottom);
  const bottom = height - m.bottom;
  const f = (n) => n.toFixed(1);

  let out = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  if (spec.band) {
    const top = py(Math.min(spec.band.to, yHi));
    const base = py(Math.max(spec.band.from, yLo));
    out += `<rect class="c-band" x="${m.left}" y="${f(top)}" width="${width - m.left - m.right}" height="${f(Math.max(0, base - top))}"/>`;
  }
  for (const t of ticks) {
    out += `<line class="c-grid" x1="${m.left}" x2="${width - m.right}" y1="${f(py(t))}" y2="${f(py(t))}"/>`;
    out += `<text class="c-tick" x="${m.left - 8}" y="${f(py(t) + 4)}" text-anchor="end">${nf.format(t)}</text>`;
  }
  out += `<text class="c-unit" x="${m.left - 8}" y="11" text-anchor="end">${escapeHtml(spec.unit || '')}</text>`;

  let lastLabelEnd = -Infinity;
  for (const t of spec.xTicks || []) {
    if (t.x < x0 || t.x > x1) continue;
    const x = px(t.x);
    const w = t.label.length * 6.5;
    if (x - w / 2 < lastLabelEnd + 6 || x + w / 2 > width) continue;
    lastLabelEnd = x + w / 2;
    out += `<text class="c-tick" x="${f(x)}" y="${height - 8}" text-anchor="middle">${escapeHtml(t.label)}</text>`;
  }

  if (spec.vline && spec.vline.x >= x0 && spec.vline.x <= x1) {
    const x = px(spec.vline.x);
    out += `<line class="c-vline" x1="${f(x)}" x2="${f(x)}" y1="${m.top}" y2="${bottom}"/>`;
    out += `<text class="c-ref" x="${f(x + 5)}" y="${m.top + 10}">${escapeHtml(spec.vline.label)}</text>`;
  }
  for (const l of spec.lines || []) {
    const y = py(l.y);
    out += `<line class="c-refline" x1="${m.left}" x2="${width - m.right}" y1="${f(y)}" y2="${f(y)}"/>`;
  }

  for (const s of spec.series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${f(px(p.x))} ${f(py(p.y))}`).join('');
    if (s.area) {
      out += `<path d="${d}L${f(px(s.points[s.points.length - 1].x))} ${bottom}L${f(px(s.points[0].x))} ${bottom}Z" fill="${s.color}" opacity="0.1"/>`;
    }
    out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.200" stroke-linejoin="round" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="6 5"' : ''}/>`;
  }

  // Labels go on top of the data so their white halo keeps them readable.
  for (const l of spec.lines || []) {
    out += `<text class="c-ref" x="${m.left + 4}" y="${f(py(l.y) - 5)}">${escapeHtml(l.label)}</text>`;
  }
  out += `<line class="c-cross" x1="0" x2="0" y1="${m.top}" y2="${bottom}" visibility="hidden"/>`;
  out += spec.series.map((s) => `<circle class="c-dot" r="4.500" fill="${s.color}" visibility="hidden"/>`).join('');
  out += '</svg><div class="chart-tip" hidden></div>';
  el.innerHTML = out;

  // --- Hover: crosshair snaps to the nearest reading ---
  const cross = el.querySelector('.c-cross');
  const dots = [...el.querySelectorAll('.c-dot')];
  const tip = el.querySelector('.chart-tip');
  const nearest = (points, x) => {
    let best = null;
    let dist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    return best;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
    tip.hidden = true;
  };
  const show = (ev) => {
    const rect = el.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    if (mx < m.left - 10 || mx > width - m.right + 10) return hide();
    const xVal = x0 + ((mx - m.left) / (width - m.left - m.right)) * (x1 - x0);
    const anchor = nearest(all, xVal);
    const tolerance = (x1 - x0) / 60;
    const rows = [];
    spec.series.forEach((s, i) => {
      const p = nearest(s.points, anchor.x);
      if (p && Math.abs(p.x - anchor.x) <= tolerance) {
        dots[i].setAttribute('cx', f(px(p.x)));
        dots[i].setAttribute('cy', f(py(p.y)));
        dots[i].setAttribute('visibility', 'visible');
        rows.push(`<div><i class="swatch${s.dashed ? ' swatch--dashed' : ''}" style="--c:${s.color}"></i>${spec.series.length > 1 ? `${escapeHtml(s.name)} ` : ''}<b>${nf.format(p.y)} ${escapeHtml(spec.unit || '')}</b></div>`);
      } else {
        dots[i].setAttribute('visibility', 'hidden');
      }
    });
    const cx = px(anchor.x);
    cross.setAttribute('x1', f(cx));
    cross.setAttribute('x2', f(cx));
    cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="chart-tip__head">${escapeHtml(spec.xLabel ? spec.xLabel(anchor.x) : '')}</div>${rows.join('')}`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(4, cx - tw / 2), width - tw - 4)}px`;
  };
  el.onpointermove = show;
  el.onpointerdown = show;
  el.onpointerleave = hide;
}
