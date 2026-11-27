(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    let step;
    if (norm >= 5) step = 10 * mag; else if (norm >= 2) step = 5 * mag; else if (norm >= 1) step = 2 * mag; else step = mag;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + 1e-9; v += step) ticks.push(v);
    return { ticks: ticks, min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step };
  }
  function fmtTick(v) {
    const a = Math.abs(v);
    if (a >= 1000) return (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k€';
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  }

  // Line chart. series: [{points:[{x,y,label}], color, dashed, width}]
  // xLabels: array aligned with points index positions given by point.x as index? We accept points with numeric x (index into labels).
  function lineChart(container, opts) {
    container.innerHTML = '';
    const W = opts.width || Math.max(320, container.clientWidth || 600);
    const H = opts.height || 260;
    const padL = 64, padR = 16, padT = 14, padB = 30;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart', role: 'img' }, container);
    const labels = opts.labels || [];
    let min = Infinity, max = -Infinity;
    const allSeries = opts.series || [];
    for (const s of allSeries) for (const p of s.points) { if (p.y < min) min = p.y; if (p.y > max) max = p.y; }
    if (!allSeries.length || !isFinite(min)) { min = 0; max = 1; }
    const t = niceTicks(min, max, 5);
    min = t.min; max = t.max;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = labels.length || 1;
    function X(i) { return padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw); }
    function Y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }
    // grid + y labels
    for (const v of t.ticks) {
      const y = Y(v);
      el('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: '#e5e7eb', 'stroke-width': 1 }, svg);
      const txt = el('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#6b7280' }, svg);
      txt.textContent = fmtTick(v);
    }
    // zero line emphasized
    if (min < 0 && max > 0) {
      el('line', { x1: padL, x2: W - padR, y1: Y(0), y2: Y(0), stroke: '#ef4444', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, svg);
    }
    // x labels (subset)
    const step = Math.ceil(n / Math.max(1, Math.floor(iw / 70)));
    for (let i = 0; i < n; i += step) {
      const txt = el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#6b7280' }, svg);
      txt.textContent = labels[i] || '';
    }
    for (const s of allSeries) {
      if (!s.points.length) continue;
      const pts = s.points.map(function (p, i) { return X(i) + ',' + Y(p.y); }).join(' ');
      el('polyline', {
        points: pts, fill: 'none', stroke: s.color || '#2563eb',
        'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.dashed ? '6 4' : 'none',
      }, svg);
      s.points.forEach(function (p, i) {
        if (s.dots === false) return;
        const gi = p.i != null ? p.i : i;
        const c = el('circle', { cx: X(gi), cy: Y(p.y), r: s.dotR || 2.2, fill: s.color || '#2563eb' }, svg);
        const title = el('title', {}, c);
        title.textContent = (p.label || labels[gi] || '') + ' : ' + Core.fmtEUR(p.y);
      });
    }
    return svg;
  }

  // Vertical bars. items: [{label, value, color}]
  function barChart(container, items, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const W = opts.width || Math.max(320, container.clientWidth || 600);
    const H = opts.height || 240;
    const padL = 56, padR = 10, padT = 16, padB = 64;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart' }, container);
    let max = 0;
    for (const it of items) if (Math.abs(it.value) > max) max = Math.abs(it.value);
    if (max === 0) max = 1;
    const iw = W - padL - padR, ih = H - padT - padB;
    const bw = items.length ? iw / items.length : iw;
    function Y(v) { return padT + ih - (Math.abs(v) / max) * (ih - 20); }
    const zeroY = padT + ih;
    el('line', { x1: padL, x2: W - padR, y1: zeroY, y2: zeroY, stroke: '#9ca3af', 'stroke-width': 1 }, svg);
    const step = Math.ceil(items.length / Math.max(1, Math.floor(iw / 90)));
    items.forEach(function (it, i) {
      const x = padL + i * bw + bw * 0.15;
      const w = bw * 0.7;
      const v = it.value;
      const y = v >= 0 ? Y(v) : zeroY;
      const h = Math.max(1, Math.abs(Y(v) - zeroY));
      el('rect', { x: x, y: y, width: w, height: h, rx: 3, fill: it.color || '#2563eb' }, svg);
      const title = el('title', {}, svg.lastChild);
      title.textContent = it.label + ' : ' + Core.fmtEUR(v);
      if (i % step === 0) {
        const txt = el('text', {
          x: x + w / 2, y: H - 46, 'text-anchor': 'end', 'font-size': 9.5, fill: '#6b7280',
          transform: 'rotate(-32 ' + (x + w / 2) + ' ' + (H - 46) + ')',
        }, svg);
        txt.textContent = it.label.length > 18 ? it.label.slice(0, 17) + '…' : it.label;
      }
      const vt = el('text', { x: x + w / 2, y: v >= 0 ? y - 4 : y + h + 11, 'text-anchor': 'middle', 'font-size': 9, fill: '#374151' }, svg);
      vt.textContent = (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: v % 1000 ? 2 : 0 }) + 'k';
    });
    return svg;
  }

  // Donut. segments: [{label, value, color}]
  function donut(container, segments, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const size = opts.size || 180, stroke = 26;
    const svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, class: 'donut' }, container);
    const total = segments.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
    const r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
    el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: '#f3f4f6', 'stroke-width': stroke }, svg);
    if (total <= 0) {
      const t = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 12, fill: '#9ca3af' }, svg);
      t.textContent = 'Aucune donnée';
      return svg;
    }
    let angle = -Math.PI / 2;
    for (const s of segments) {
      const v = Math.max(0, s.value);
      if (v <= 0) continue;
      const frac = v / total;
      const a2 = angle + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      el('path', {
        d: 'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2,
        fill: 'none', stroke: s.color || '#2563eb', 'stroke-width': stroke,
      }, svg);
      const title = el('title', {}, svg.lastChild);
      title.textContent = s.label + ' : ' + Core.fmtEUR(v) + ' (' + Math.round(frac * 100) + ' %)';
      angle = a2;
    }
    const ct = el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#111827' }, svg);
    ct.textContent = Core.fmtEUR(total);
    const cl = el('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 9, fill: '#6b7280' }, svg);
    cl.textContent = opts.centerLabel || 'Total';
    return svg;
  }

  root.Charts = { lineChart: lineChart, barChart: barChart, donut: donut, niceTicks: niceTicks };
})(typeof self !== 'undefined' ? self : globalThis);
