/*
 * TechPrimer "living" diagrams.
 *
 * Takes Mermaid diagram text, reads its structure with Mermaid's own parser, and draws it itself:
 * icon cards, violet/pink palette, packets that travel along connections, hover to trace,
 * replay, pan and zoom. Covers every diagram type the site uses.
 *
 *   TPLiving.render(code, { theme })  ->  Promise<{ el, dispose, kind, stats }>
 *   TPLiving.kindOf(code)             ->  'flow' | 'state' | 'class' | 'sequence' | 'er' | 'mindmap' | 'timeline' | 'quadrant' | 'xychart' | null
 *
 * Needs: window.mermaid (parser only), window.dagre (layout), window.TPIcons (icon set).
 * render() rejects when it cannot draw a diagram, so the caller can fall back to Mermaid.
 */
(function (root) {
  'use strict';

  var I = root.TPIcons;
  var doc = root.document;
  var NS = 'http://www.w3.org/2000/svg';
  var FONT = 'Manrope, system-ui, -apple-system, "Segoe UI", sans-serif';
  var MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  var LFONT = '600 12.5px ' + FONT;   // node labels
  var EFONT = '500 11px ' + FONT;     // edge labels
  var MFONT = '11.5px ' + MONO;       // class members
  var REDUCED = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
  var seq = 0;

  // ------------------------------------------------------------------ styles ---
  var CSS = [
    '.lv-wrap{--lv-accent:#db2777;--lv-accent2:#7c3aed;--lv-line:#ddd7ee;--lv-fg:#241b3a;--lv-muted:#6b6490;--lv-stage:#fff;--lv-btn:#fff;font-family:' + FONT + ';color:var(--lv-fg);margin:0 0 1.2em;line-height:1.4}',
    '.lv-wrap[data-theme="dark"]{--lv-accent:#ff7ab8;--lv-accent2:#b794ff;--lv-line:#2c2542;--lv-fg:#f1edfb;--lv-muted:#a9a2c8;--lv-stage:#0a0812;--lv-btn:#14111f}',
    '.lv-wrap *{box-sizing:border-box}',
    '.lv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px}',
    '.lv-grow{flex:1 1 auto}',
    '.lv-btn{font:inherit;font-size:12.5px;line-height:1.2;padding:6px 12px;border-radius:8px;border:1px solid var(--lv-line);background:var(--lv-btn);color:var(--lv-fg);cursor:pointer;margin:0}',
    '.lv-btn:hover{border-color:var(--lv-accent);color:var(--lv-accent)}',
    '.lv-btn:focus-visible,.lv-node:focus-visible{outline:2px solid var(--lv-accent);outline-offset:2px}',
    '.lv-btn.lv-primary{background:var(--lv-accent);border-color:var(--lv-accent);color:#fff}',
    '.lv-btn.lv-primary:hover{filter:brightness(1.08);color:#fff}',
    '.lv-wrap[data-theme="dark"] .lv-btn.lv-primary,.lv-wrap[data-theme="dark"] .lv-btn.lv-primary:hover{color:#1a0b14}',
    '.lv-btn[disabled]{opacity:.45;cursor:default}',
    '.lv-btn[disabled]:hover{border-color:var(--lv-line);color:var(--lv-fg)}',
    '.lv-lbl{font-size:12px;color:var(--lv-muted);display:inline-flex;align-items:center;gap:6px}',
    '.lv-range{accent-color:var(--lv-accent);width:92px;margin:0}',
    '.lv-select{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:8px;border:1px solid var(--lv-line);background:var(--lv-btn);color:var(--lv-fg)}',
    '.lv-chip{font-size:11.5px;color:var(--lv-muted);border:1px solid var(--lv-line);border-radius:999px;padding:2px 9px;white-space:nowrap}',
    '.lv-box{position:relative;width:100%;min-height:230px;max-height:840px;border:1px solid var(--lv-line);border-radius:12px;overflow:hidden;background:var(--lv-stage);cursor:grab;touch-action:pan-y}',
    '.lv-box.lv-drag{cursor:grabbing}',
    '.lv-box>svg{position:absolute!important;left:0;top:0;width:100%!important;height:100%!important;max-width:none!important;display:block}',
    '.lv-caption{min-height:22px;margin-top:8px;font:12.5px/1.45 ' + MONO + ';color:var(--lv-muted)}',
    '.lv-caption b{color:var(--lv-accent);font-weight:600}',
    '.lv-hint{font-size:12px;color:var(--lv-muted);margin-top:4px}',
    '.lv-node{cursor:pointer;transition:opacity .18s}',
    '.lv-node .lv-card{transition:stroke .18s}',
    '.lv-edge{fill:none;transition:opacity .18s,stroke .18s}',
    '.lv-elabel,.lv-cluster{transition:opacity .18s}',
    '.lv-dim{opacity:.13}',
    '.lv-edge.lv-hot{stroke:var(--lv-accent)!important;stroke-width:2.7px!important}',
    '.lv-node.lv-pin .lv-card{stroke:var(--lv-accent)!important;stroke-width:2.4px!important}',
    '.lv-node.lv-pulse .lv-card{animation:lvPulse 1s ease-out}',
    '@keyframes lvPulse{0%{stroke:var(--lv-accent);stroke-width:4px;filter:drop-shadow(0 0 0 var(--lv-accent))}35%{stroke:var(--lv-accent);stroke-width:3px;filter:drop-shadow(0 0 9px var(--lv-accent))}100%{filter:drop-shadow(0 0 0 transparent)}}',
    '.lv-packet{fill:var(--lv-accent);filter:drop-shadow(0 0 3px var(--lv-accent))}',
    '.lv-halo{fill:var(--lv-accent);opacity:.22}',
    '.lv-burst{fill:var(--lv-accent);filter:drop-shadow(0 0 5px var(--lv-accent))}',
    '.lv-sdim{opacity:.14;transition:opacity .2s}',
    '.lv-scur .lv-mline{stroke:var(--lv-accent)!important;stroke-width:2.8px!important}',
    '.lv-scur .lv-mtext{fill:var(--lv-accent)!important;font-weight:700}',
    '.lv-scur .lv-ncard{stroke:var(--lv-accent)!important;stroke-width:2px!important}',
    '.lv-dot{fill:var(--lv-accent);filter:drop-shadow(0 0 5px var(--lv-accent))}',
    '.lv-ring{fill:var(--lv-accent);transform-box:fill-box;transform-origin:center;animation:lvRing 2.4s ease-out infinite}',
    '@keyframes lvRing{0%{transform:scale(1);opacity:.5}100%{transform:scale(3.2);opacity:0}}',
    '.lv-pt.lv-on .lv-dotpt{stroke:var(--lv-accent)!important;stroke-width:3px!important}',
    '.lv-grow-bar{transform-box:fill-box;transform-origin:bottom;animation:lvGrow .8s cubic-bezier(.2,.8,.2,1) both}',
    '@keyframes lvGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
    '.lv-draw{animation:lvDraw 1.1s ease-out both}',
    '@keyframes lvDraw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}',
    '.lv-wrap{width:100%;min-width:0}',
    '.mermaid-container .lv-wrap{margin:0}',
    '.mermaid-container .lv-box{background:transparent;border-color:transparent}',
    '@media (prefers-reduced-motion:reduce){.lv-node.lv-pulse .lv-card,.lv-ring,.lv-grow-bar,.lv-draw{animation:none}}'
  ].join('\n');
  function injectCss() {
    if (doc.getElementById('lv-style')) return;
    var st = doc.createElement('style');
    st.id = 'lv-style';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  // ------------------------------------------------------------------- utils ---
  function h(tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function s(tag, attrs, kids) {
    var n = doc.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function isDark(opts) {
    if (opts && opts.theme) return opts.theme === 'dark';
    return doc.documentElement.getAttribute('data-theme') === 'dark';
  }
  var mctx = null;
  function tw(str, font) {
    if (!mctx) mctx = doc.createElement('canvas').getContext('2d');
    mctx.font = font;
    return mctx.measureText(str).width;
  }
  function decode(str) {
    return String(str == null ? '' : str).replace(/#quot;/g, '"').replace(/#(\d+);/g, function (m, n) { return String.fromCharCode(+n); });
  }
  /** Plain text lines from a Mermaid label: <br> and \n split lines, other tags dropped. */
  function textLines(raw) {
    var lines = decode(raw).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    return lines.length ? lines : [''];
  }
  function wrapLine(line, maxW, font) {
    var words = line.split(' '), out = [], cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (cur && tw(test, font) > maxW) { out.push(cur); cur = w; } else cur = test;
    });
    if (cur) out.push(cur);
    return out;
  }
  function wrapAll(lines, maxW, font) {
    var out = [];
    lines.forEach(function (l) { wrapLine(l, maxW, font).forEach(function (x) { out.push(x); }); });
    return out.length ? out : [''];
  }
  function maxW(lines, font) { return Math.ceil(Math.max.apply(null, lines.map(function (l) { return tw(l, font); }).concat([0]))); }
  function arr(v) { return v instanceof Map ? Array.from(v.values()) : Array.isArray(v) ? v : v ? Object.keys(v).map(function (k) { return v[k]; }) : []; }
  function parseStyles(list) {
    var o = {};
    (list || []).forEach(function (st) { var i = String(st).indexOf(':'); if (i > 0) o[st.slice(0, i).trim()] = st.slice(i + 1).trim(); });
    return o;
  }

  // ----------------------------------------------------------------- palette ---
  function palette(dark) {
    return dark
      ? { card: '#130f1f', cardLine: '#2e2646', text: '#f1edfb', sub: '#a9a2c8', edge: '#7e769c', cluster: '#0f0b19', clusterLine: '#2b2442', clusterText: '#9a93bd',
          pill: '#0a0812', pillLine: '#2b2442', accent: '#ff7ab8', accent2: '#b794ff', note: '#1b1430', noteLine: '#6b4fb8', stage: '#0a0812' }
      : { card: '#ffffff', cardLine: '#ddd7ee', text: '#241b3a', sub: '#6b6490', edge: '#9a93b8', cluster: '#f7f5fc', clusterLine: '#ddd7ee', clusterText: '#6b6490',
          pill: '#ffffff', pillLine: '#ddd7ee', accent: '#db2777', accent2: '#7c3aed', note: '#f6f0ff', noteLine: '#a98bf0', stage: '#ffffff' };
  }
  function hsl(hex) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var v = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    var r = parseInt(v.slice(0, 2), 16) / 255, g = parseInt(v.slice(2, 4), 16) / 255, b = parseInt(v.slice(4, 6), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    var sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var hue = d === 0 ? 0 : 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    return { h: hue, s: sat, l: l };
  }
  /** Author colours become violet or pink by hue (warm and magenta = pink, the rest = violet); greys stay neutral. */
  function tint(color, dark) {
    var c = hsl(color);
    if (!c) {
      var rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(String(color || ''));
      if (!rgb) return null;
      var hx = '#' + [1, 2, 3].map(function (i) { return ('0' + (+rgb[i]).toString(16)).slice(-2); }).join('');
      c = hsl(hx);
    }
    if (!c) return null;
    if (c.s < 0.12) return dark ? { fill: '#1d1a2b', stroke: '#a9a2c8' } : { fill: '#f1f0f6', stroke: '#8a85a3' };
    var pink = c.h >= 295 || c.h < 80;
    return pink ? (dark ? { fill: '#3a1428', stroke: '#ff7ab8' } : { fill: '#fde7f1', stroke: '#db2777' })
                : (dark ? { fill: '#251a45', stroke: '#b794ff' } : { fill: '#efe8ff', stroke: '#7c3aed' });
  }

  // ------------------------------------------------------------------ engine ---
  /** Moves dots along SVG paths. Pausable, speed-adjustable, idle when off screen. */
  function Engine(host) {
    var items = [], raf = 0, last = 0;
    var self = { speed: 1, running: false, visible: true };
    function frame(ts) {
      raf = 0;
      if (!host.isConnected) { self.running = false; return; }
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.d += it.speed * dt * self.speed;
        if (it.d >= it.len + (it.gap || 0)) {
          if (it.loop) it.d -= it.len + (it.gap || 0);
          else { it.el.remove(); if (it.halo) it.halo.remove(); items.splice(i, 1); if (it.onArrive) it.onArrive(); continue; }
        }
        place(it);
      }
      if (self.running && self.visible) raf = root.requestAnimationFrame(frame);
    }
    function place(it) {
      var d = Math.max(0, Math.min(it.d, it.len));
      var p = it.path.getPointAtLength(d);
      it.el.setAttribute('cx', p.x); it.el.setAttribute('cy', p.y);
      if (it.halo) { it.halo.setAttribute('cx', p.x); it.halo.setAttribute('cy', p.y); }
      var vis = it.d > it.len ? 0 : 1;
      it.el.style.opacity = vis;
      if (it.halo) it.halo.style.opacity = vis ? '' : 0;
    }
    function kick() { if (self.running && self.visible && !raf) { last = 0; raf = root.requestAnimationFrame(frame); } }
    self.add = function (it) { it.len = it.path.getTotalLength(); items.push(it); place(it); kick(); return it; };
    self.start = function () { self.running = true; kick(); };
    self.stop = function () { self.running = false; if (raf) root.cancelAnimationFrame(raf); raf = 0; };
    self.clear = function () { items.forEach(function (it) { it.el.remove(); if (it.halo) it.halo.remove(); }); items = []; };
    if ('IntersectionObserver' in root) {
      new root.IntersectionObserver(function (e) {
        self.visible = e[0].isIntersecting;
        if (self.visible) kick(); else if (raf) { root.cancelAnimationFrame(raf); raf = 0; }
      }).observe(host);
    }
    return self;
  }

  /** Drag to pan, ctrl/cmd + wheel (or buttons) to zoom, by editing the viewBox. */
  function PanZoom(svg, box, base) {
    var cur = { x: base.x, y: base.y, w: base.w, h: base.h };
    var anim = 0;
    function apply() { svg.setAttribute('viewBox', cur.x + ' ' + cur.y + ' ' + cur.w + ' ' + cur.h); }
    function zoom(f, cx, cy) {
      cx = cx == null ? cur.x + cur.w / 2 : cx; cy = cy == null ? cur.y + cur.h / 2 : cy;
      var w = Math.max(base.w / 12, Math.min(base.w * 3, cur.w / f));
      var k = w / cur.w;
      cur = { x: cx - (cx - cur.x) * k, y: cy - (cy - cur.y) * k, w: w, h: cur.h * k };
      apply();
    }
    function scaleOf() { var r = svg.getBoundingClientRect(); return Math.max(cur.w / (r.width || 1), cur.h / (r.height || 1)); }
    function toSvg(ev) {
      var r = svg.getBoundingClientRect(), sc = scaleOf();
      var offX = (r.width - cur.w / sc) / 2, offY = (r.height - cur.h / sc) / 2;
      return { x: cur.x + (ev.clientX - r.left - offX) * sc, y: cur.y + (ev.clientY - r.top - offY) * sc };
    }
    var drag = null;
    box.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || (ev.target.closest && ev.target.closest('.lv-node'))) return;
      drag = { x: ev.clientX, y: ev.clientY, vx: cur.x, vy: cur.y, sc: scaleOf() };
      box.classList.add('lv-drag');
      try { box.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    box.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      cur.x = drag.vx - (ev.clientX - drag.x) * drag.sc;
      cur.y = drag.vy - (ev.clientY - drag.y) * drag.sc;
      apply();
    });
    function end() { drag = null; box.classList.remove('lv-drag'); }
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('wheel', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      var p = toSvg(ev);
      zoom(Math.exp(-ev.deltaY * 0.0022), p.x, p.y);
    }, { passive: false });
    box.addEventListener('dblclick', function (ev) { if (!(ev.target.closest && ev.target.closest('.lv-node'))) api.reset(); });
    var api = {
      base: base,
      zoomIn: function () { zoom(1.35); }, zoomOut: function () { zoom(1 / 1.35); },
      reset: function () { root.cancelAnimationFrame(anim); cur = { x: base.x, y: base.y, w: base.w, h: base.h }; apply(); },
      to: function (t, dur) {
        root.cancelAnimationFrame(anim);
        if (REDUCED || !dur) { cur = { x: t.x, y: t.y, w: t.w, h: t.h }; apply(); return; }
        var from = { x: cur.x, y: cur.y, w: cur.w, h: cur.h }, t0 = root.performance.now();
        (function step(now) {
          var k = Math.min(1, (now - t0) / dur); k = 1 - Math.pow(1 - k, 3);
          cur = { x: from.x + (t.x - from.x) * k, y: from.y + (t.y - from.y) * k, w: from.w + (t.w - from.w) * k, h: from.h + (t.h - from.h) * k };
          apply();
          if (k < 1) anim = root.requestAnimationFrame(step);
        })(t0);
      }
    };
    return api;
  }

  // ------------------------------------------------------------------ chrome ---
  function btn(label, title, fn, primary) {
    var b = h('button', { class: 'lv-btn' + (primary ? ' lv-primary' : ''), type: 'button', text: label, title: title || '' });
    b.addEventListener('click', fn);
    return b;
  }
  /** Common frame: toolbar, pan/zoom stage with the diagram's aspect ratio, caption. */
  function frame(dark, svg, bounds, extraBar) {
    var wrap = h('div', { class: 'lv-wrap', 'data-theme': dark ? 'dark' : 'light' });
    var bar = h('div', { class: 'lv-bar' });
    var box = h('div', { class: 'lv-box' });
    var cap = h('div', { class: 'lv-caption' });
    var m = 24;
    var base = { x: bounds.x0 - m, y: bounds.y0 - m, w: bounds.x1 - bounds.x0 + m * 2, h: bounds.y1 - bounds.y0 + m * 2 };
    svg.setAttribute('viewBox', base.x + ' ' + base.y + ' ' + base.w + ' ' + base.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('xmlns', NS);
    box.style.aspectRatio = Math.round(base.w) + ' / ' + Math.round(base.h);
    box.appendChild(svg);
    var pz = PanZoom(svg, box, base);
    wrap.appendChild(bar); wrap.appendChild(box); wrap.appendChild(cap);
    return { wrap: wrap, bar: bar, box: box, cap: cap, pz: pz, base: base };
  }
  function zoomButtons(bar, pz) {
    bar.appendChild(btn('−', 'Zoom out', pz.zoomOut));
    bar.appendChild(btn('+', 'Zoom in', pz.zoomIn));
    bar.appendChild(btn('Fit', 'Fit to view', pz.reset));
  }
  function speedControl(bar, engine) {
    var r = h('input', { type: 'range', min: '0.3', max: '3', step: '0.1', value: '1', class: 'lv-range', 'aria-label': 'Animation speed' });
    r.addEventListener('input', function () { engine.speed = parseFloat(r.value); });
    bar.appendChild(h('label', { class: 'lv-lbl' }, ['Speed', r]));
  }
  function motionToggle(bar, engine) {
    var b = btn(REDUCED ? '▶ Play motion' : '⏸ Pause motion', 'Pause or resume the moving dots', function () { set(!engine.running); });
    function set(on) { if (on) engine.start(); else engine.stop(); b.textContent = on ? '⏸ Pause motion' : '▶ Play motion'; }
    bar.appendChild(b);
    return set;
  }

  // =============================================================== SCENE (graphs) ===
  // Nodes: { id, kind, label, icon, tint, parent, ... }   Edges: { from, to, label, dash, thick, head, tail, packets }
  var NODE = {};

  function iconBadge(g, cx, cy, icon, dark, r) {
    var col = I.colors(icon, dark ? 'dark' : 'light');
    g.appendChild(s('circle', { cx: cx, cy: cy, r: r, fill: col.bg }));
    var sz = Math.round(r * 1.16);
    var ic = s('svg', { x: cx - sz / 2, y: cy - sz / 2, width: sz, height: sz, viewBox: '0 0 24 24', stroke: col.fg, fill: 'none', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    ic.innerHTML = I.body(icon);
    g.appendChild(ic);
  }
  function cardColors(n, P, dark) {
    var fill = P.card, stroke = P.cardLine;
    if (n.tint) { fill = n.tint.fill; stroke = n.tint.stroke; }
    else if (n.icon) stroke = I.colors(n.icon, dark ? 'dark' : 'light').fg + (dark ? '66' : '55');
    return { fill: fill, stroke: stroke };
  }
  function tspans(parent, lines, x, dy) {
    lines.forEach(function (l, k) { parent.appendChild(s('tspan', { x: x, dy: k ? dy : 0, text: l })); });
  }

  NODE.card = {
    measure: function (n) {
      var lines = n.lines || (n.lines = wrapAll(textLines(n.label), 150, LFONT));
      var sub = n.subLines || [];
      var w = Math.max(n.icon ? 108 : 92, maxW(lines.concat(sub), LFONT) + 30);
      n.w = w;
      n.h = (n.icon ? 14 + 38 + 8 : 14) + lines.length * 16 + (sub.length ? sub.length * 15 + 4 : 0) + 12;
    },
    draw: function (g, n, x, y, P, dark) {
      var c = cardColors(n, P, dark);
      g.appendChild(s('rect', { class: 'lv-card', x: x, y: y, width: n.w, height: n.h, rx: 14, fill: c.fill, stroke: c.stroke, 'stroke-width': 1.4 }));
      var cx = x + n.w / 2, ty = y + 14;
      if (n.icon) { iconBadge(g, cx, y + 33, n.icon, dark, 19); ty = y + 60; }
      var t = s('text', { x: cx, y: ty + 12, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, 'font-family': FONT, fill: P.text });
      tspans(t, n.lines, cx, 16);
      g.appendChild(t);
      if (n.subLines && n.subLines.length) {
        var st = s('text', { x: cx, y: ty + 12 + n.lines.length * 16 + 3, 'text-anchor': 'middle', 'font-size': 11, 'font-family': FONT, fill: P.sub });
        tspans(st, n.subLines, cx, 15);
        g.appendChild(st);
      }
    }
  };
  NODE.start = {
    measure: function (n) { n.w = 20; n.h = 20; },
    draw: function (g, n, x, y, P) { g.appendChild(s('circle', { class: 'lv-card', cx: x + 10, cy: y + 10, r: 9, fill: P.accent2, stroke: P.accent2, 'stroke-width': 1.4 })); }
  };
  NODE.end = {
    measure: function (n) { n.w = 26; n.h = 26; },
    draw: function (g, n, x, y, P) {
      g.appendChild(s('circle', { class: 'lv-card', cx: x + 13, cy: y + 13, r: 11, fill: P.card, stroke: P.accent2, 'stroke-width': 2 }));
      g.appendChild(s('circle', { cx: x + 13, cy: y + 13, r: 6, fill: P.accent2 }));
    }
  };
  NODE.choice = {
    measure: function (n) { n.w = 40; n.h = 40; },
    draw: function (g, n, x, y, P, dark) {
      g.appendChild(s('path', { class: 'lv-card', d: 'M' + (x + 20) + ',' + y + ' L' + (x + 40) + ',' + (y + 20) + ' L' + (x + 20) + ',' + (y + 40) + ' L' + x + ',' + (y + 20) + ' Z', fill: P.card, stroke: P.accent2, 'stroke-width': 1.8 }));
    }
  };
  NODE.bar = {
    measure: function (n) { n.w = 84; n.h = 10; },
    draw: function (g, n, x, y, P) { g.appendChild(s('rect', { class: 'lv-card', x: x, y: y, width: n.w, height: n.h, rx: 5, fill: P.accent2, stroke: P.accent2 })); }
  };
  NODE.note = {
    measure: function (n) {
      n.lines = wrapAll(textLines(n.label), 230, '12px ' + FONT);
      n.w = maxW(n.lines, '12px ' + FONT) + 28;
      n.h = n.lines.length * 16 + 22;
    },
    draw: function (g, n, x, y, P) {
      g.appendChild(s('path', { class: 'lv-card', d: 'M' + x + ',' + y + ' H' + (x + n.w - 12) + ' L' + (x + n.w) + ',' + (y + 12) + ' V' + (y + n.h) + ' H' + x + ' Z', fill: P.note, stroke: P.noteLine, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
      var t = s('text', { x: x + 14, y: y + 20, 'font-size': 12, 'font-family': FONT, fill: P.text });
      tspans(t, n.lines, x + 14, 16);
      g.appendChild(t);
    }
  };
  NODE.pill = {
    measure: function (n) {
      var f = (n.level === 0 ? '700 14px ' : '600 12.5px ') + FONT;
      n.f = f;
      n.lines = wrapAll(textLines(n.label), n.level === 0 ? 200 : 190, f);
      var iconW = n.icon ? 26 : 0;
      n.w = maxW(n.lines, f) + 34 + iconW;
      n.h = n.lines.length * 17 + 20;
    },
    draw: function (g, n, x, y, P, dark) {
      var t = n.tint || { fill: P.card, stroke: P.cardLine };
      var root0 = n.level === 0;
      g.appendChild(s('rect', { class: 'lv-card', x: x, y: y, width: n.w, height: n.h, rx: n.h / 2, fill: root0 ? P.accent2 : t.fill, stroke: root0 ? P.accent2 : t.stroke, 'stroke-width': 1.5 }));
      var tx = x + (n.icon ? 18 + 26 : n.w / 2);
      if (n.icon) iconBadge(g, x + 22, y + n.h / 2, n.icon, dark, 11);
      var txt = s('text', { x: n.icon ? x + 40 : x + n.w / 2, y: y + 15 + (n.h - n.lines.length * 17 - 20) / 2 + 3, 'text-anchor': n.icon ? 'start' : 'middle', 'font-size': root0 ? 14 : 12.5, 'font-weight': root0 ? 700 : 600, 'font-family': FONT, fill: root0 ? (dark ? '#1a0b2e' : '#ffffff') : P.text });
      tspans(txt, n.lines, n.icon ? x + 40 : x + n.w / 2, 17);
      g.appendChild(txt);
    }
  };
  NODE.class = {
    measure: function (n) {
      var title = wrapAll(textLines(n.label), 220, '700 13px ' + FONT);
      n.title = title;
      var ann = n.annotations || [];
      var rows = (n.attrs || []).concat(n.methods || []);
      var wmem = Math.max.apply(null, rows.map(function (r) { return tw(r.text, MFONT); }).concat([0]));
      n.w = Math.max(158, Math.ceil(Math.max(wmem + 26, maxW(title, '700 13px ' + FONT) + 62, ann.length ? 110 : 0)));
      n.headH = 22 + title.length * 17 + (ann.length ? 15 : 0) + 6;
      n.h = n.headH + (n.attrs.length ? n.attrs.length * 17 + 12 : 0) + (n.methods.length ? n.methods.length * 17 + 12 : 0) + (!n.attrs.length && !n.methods.length ? 8 : 0);
    },
    draw: function (g, n, x, y, P, dark) {
      var col = I.colors(n.icon, dark ? 'dark' : 'light');
      g.appendChild(s('rect', { class: 'lv-card', x: x, y: y, width: n.w, height: n.h, rx: 12, fill: P.card, stroke: col.fg + (dark ? '77' : '66'), 'stroke-width': 1.4 }));
      g.appendChild(s('path', { d: 'M' + x + ',' + (y + n.headH) + ' V' + (y + 12) + ' Q' + x + ',' + y + ' ' + (x + 12) + ',' + y + ' H' + (x + n.w - 12) + ' Q' + (x + n.w) + ',' + y + ' ' + (x + n.w) + ',' + (y + 12) + ' V' + (y + n.headH) + ' Z', fill: col.bg }));
      iconBadge(g, x + 22, y + n.headH / 2, n.icon, dark, 12);
      var ty = y + 17;
      if (n.annotations.length) {
        g.appendChild(s('text', { x: x + 42, y: ty, 'font-size': 10.5, 'font-style': 'italic', 'font-family': FONT, fill: P.sub, text: '«' + n.annotations.join(', ') + '»' }));
        ty += 15;
      }
      var t = s('text', { x: x + 42, y: ty + 3, 'font-size': 13, 'font-weight': 700, 'font-family': FONT, fill: P.text });
      tspans(t, n.title, x + 42, 17);
      g.appendChild(t);
      var cy = y + n.headH;
      function block(list) {
        if (!list.length) return;
        g.appendChild(s('line', { x1: x, y1: cy, x2: x + n.w, y2: cy, stroke: P.cardLine, 'stroke-width': 1 }));
        list.forEach(function (r, k) {
          g.appendChild(s('text', { x: x + 12, y: cy + 17 + k * 17 - 1, 'font-size': 11.5, 'font-family': MONO, fill: P.text, 'font-style': r.abstract ? 'italic' : 'normal', 'text-decoration': r.stat ? 'underline' : 'none', text: r.text }));
        });
        cy += list.length * 17 + 12;
      }
      block(n.attrs); block(n.methods);
    }
  };
  NODE.entity = {
    measure: function (n) {
      var rows = n.rows;
      var wT = Math.max.apply(null, rows.map(function (r) { return tw(r.type, MFONT); }).concat([0]));
      var wN = Math.max.apply(null, rows.map(function (r) { return tw(r.name, MFONT); }).concat([0]));
      var wK = rows.some(function (r) { return r.keys; }) ? 34 : 0;
      n.cols = { t: 12, nme: 12 + wT + 14, k: 12 + wT + 14 + wN + 14 };
      n.w = Math.max(170, Math.ceil(n.cols.k + wK + 12), maxW([n.label], '700 13px ' + FONT) + 64);
      n.headH = 44;
      n.h = n.headH + (rows.length ? rows.length * 19 + 12 : 6);
    },
    draw: function (g, n, x, y, P, dark) {
      var col = I.colors(n.icon, dark ? 'dark' : 'light');
      g.appendChild(s('rect', { class: 'lv-card', x: x, y: y, width: n.w, height: n.h, rx: 12, fill: P.card, stroke: col.fg + (dark ? '77' : '66'), 'stroke-width': 1.4 }));
      g.appendChild(s('path', { d: 'M' + x + ',' + (y + n.headH) + ' V' + (y + 12) + ' Q' + x + ',' + y + ' ' + (x + 12) + ',' + y + ' H' + (x + n.w - 12) + ' Q' + (x + n.w) + ',' + y + ' ' + (x + n.w) + ',' + (y + 12) + ' V' + (y + n.headH) + ' Z', fill: col.bg }));
      iconBadge(g, x + 24, y + n.headH / 2, n.icon, dark, 13);
      g.appendChild(s('text', { x: x + 46, y: y + n.headH / 2 + 5, 'font-size': 13, 'font-weight': 700, 'font-family': FONT, fill: P.text, text: n.label }));
      if (n.rows.length) g.appendChild(s('line', { x1: x, y1: y + n.headH, x2: x + n.w, y2: y + n.headH, stroke: P.cardLine }));
      n.rows.forEach(function (r, k) {
        var ry = y + n.headH + 18 + k * 19 - 3;
        g.appendChild(s('text', { x: x + n.cols.t, y: ry, 'font-size': 11.5, 'font-family': MONO, fill: P.sub, text: r.type }));
        g.appendChild(s('text', { x: x + n.cols.nme, y: ry, 'font-size': 11.5, 'font-family': MONO, fill: P.text, text: r.name }));
        if (r.keys) g.appendChild(s('text', { x: x + n.cols.k, y: ry, 'font-size': 10, 'font-weight': 700, 'font-family': FONT, fill: P.accent, text: r.keys }));
      });
    }
  };

  function addMarkers(defs, uid, P) {
    function mk(name, vb, w, h, refX, body) {
      var m = s('marker', { id: uid + '-' + name, viewBox: vb, refX: refX, refY: h / 2, markerWidth: w, markerHeight: h, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      m.innerHTML = body;
      defs.appendChild(m);
    }
    mk('arrow', '0 0 10 10', 9, 9, 9, '<path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/>');
    mk('open', '0 0 10 10', 9, 9, 9, '<path d="M1,1 L9,5 L1,9" fill="none" stroke="context-stroke" stroke-width="1.5"/>');
    mk('tri', '0 0 14 12', 14, 12, 13, '<path d="M1,1 L13,6 L1,11 z" fill="' + P.card + '" stroke="context-stroke" stroke-width="1.4"/>');
    mk('diamond', '0 0 18 10', 18, 10, 17, '<path d="M1,5 L9,1 L17,5 L9,9 z" fill="context-stroke" stroke="context-stroke"/>');
    mk('diamondOpen', '0 0 18 10', 18, 10, 17, '<path d="M1,5 L9,1 L17,5 L9,9 z" fill="' + P.card + '" stroke="context-stroke" stroke-width="1.3"/>');
    mk('cross', '0 0 10 10', 10, 10, 8, '<path d="M1,1 L9,9 M9,1 L1,9" stroke="context-stroke" stroke-width="1.6"/>');
    mk('circle', '0 0 10 10', 9, 9, 8, '<circle cx="5" cy="5" r="3.6" fill="' + P.card + '" stroke="context-stroke" stroke-width="1.4"/>');
  }

  function smoothPath(pts) {
    var d = 'M' + pts[0].x + ',' + pts[0].y;
    if (pts.length === 2) return d + ' L' + pts[1].x + ',' + pts[1].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1.x + (p2.x - p0.x) / 6) + ',' + (p1.y + (p2.y - p0.y) / 6) + ' ' + (p2.x - (p3.x - p1.x) / 6) + ',' + (p2.y - (p3.y - p1.y) / 6) + ' ' + p2.x + ',' + p2.y;
    }
    return d;
  }

  function layoutScene(scene, byId) {
    var dir = { TD: 'TB', TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' }[scene.direction] || 'TB';
    function attempt(compound) {
      var g = new root.dagre.graphlib.Graph({ compound: compound, multigraph: true });
      g.setGraph({ rankdir: dir, nodesep: scene.nodesep || 54, ranksep: scene.ranksep || (scene.clusters.length ? 92 : 80), edgesep: 24, marginx: 24, marginy: 24 });
      g.setDefaultEdgeLabel(function () { return {}; });
      if (compound) {
        scene.clusters.forEach(function (c) { g.setNode(c.id, {}); });
        scene.clusters.forEach(function (c) { if (c.parent) g.setParent(c.id, c.parent); });
      }
      scene.nodes.forEach(function (n) { g.setNode(n.id, { width: n.w, height: n.h }); if (compound && n.parent) g.setParent(n.id, n.parent); });
      scene.edges.forEach(function (e, i) {
        if (!byId[e.from] || !byId[e.to]) return;
        g.setEdge(e.from, e.to, e.lw ? { width: e.lw, height: 8 + 14 * e.lines.length, labelpos: 'c' } : {}, 'e' + i);
      });
      root.dagre.layout(g);
      return g;
    }
    var g, flat = false;
    try { g = attempt(true); } catch (err) { g = attempt(false); flat = true; }
    return { g: g, flat: flat };
  }

  function renderScene(scene, dark, opts) {
    opts = opts || {};
    var P = palette(dark);
    var uid = 'lv' + (++seq);
    var byId = {};
    scene.nodes.forEach(function (n) { byId[n.id] = n; (NODE[n.kind] || NODE.card).measure(n, P); });
    scene.edges.forEach(function (e) {
      e.lines = e.label ? wrapAll(textLines(e.label), 200, EFONT) : [];
      e.lw = e.lines.length ? maxW(e.lines, EFONT) + 16 : 0;
    });
    var lay = layoutScene(scene, byId);
    var dg = lay.g;

    var svg = s('svg', { role: 'img', 'aria-label': scene.title || 'Diagram' });
    var defs = s('defs');
    addMarkers(defs, uid, P);
    svg.appendChild(defs);
    var layerC = s('g'), layerE = s('g'), layerL = s('g'), layerP = s('g'), layerN = s('g');
    [layerC, layerE, layerL, layerP, layerN].forEach(function (l) { svg.appendChild(l); });

    var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    function grow(x0, y0, x1, y1) { b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); }

    // positions
    var pos = {};
    scene.nodes.forEach(function (n) { var p = dg.node(n.id); pos[n.id] = { x: p.x, y: p.y }; });

    // clusters
    var depth = {};
    function dOf(id) { var c = scene.clusters.filter(function (x) { return x.id === id; })[0]; return c && c.parent ? 1 + dOf(c.parent) : 0; }
    scene.clusters.forEach(function (c) { depth[c.id] = dOf(c.id); });
    function childBox(cid) {
      var bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      scene.nodes.forEach(function (n) { if (n.parent === cid) { var p = pos[n.id]; bb.x0 = Math.min(bb.x0, p.x - n.w / 2); bb.y0 = Math.min(bb.y0, p.y - n.h / 2); bb.x1 = Math.max(bb.x1, p.x + n.w / 2); bb.y1 = Math.max(bb.y1, p.y + n.h / 2); } });
      scene.clusters.forEach(function (c) { if (c.parent === cid) { var cb = childBox(c.id); if (cb.x1 > cb.x0) { bb.x0 = Math.min(bb.x0, cb.x0 - 18); bb.y0 = Math.min(bb.y0, cb.y0 - 40); bb.x1 = Math.max(bb.x1, cb.x1 + 18); bb.y1 = Math.max(bb.y1, cb.y1 + 16); } } });
      return bb;
    }
    scene.clusters.slice().sort(function (a, c) { return depth[a.id] - depth[c.id]; }).forEach(function (c) {
      var x0, y0, x1, y1;
      if (!lay.flat) {
        var n = dg.node(c.id);
        x0 = n.x - n.width / 2 - 18; y0 = n.y - n.height / 2 - 40; x1 = n.x + n.width / 2 + 18; y1 = n.y + n.height / 2 + 16;
      } else {
        var cb = childBox(c.id);
        if (!(cb.x1 > cb.x0)) return;
        x0 = cb.x0 - 18; y0 = cb.y0 - 40; x1 = cb.x1 + 18; y1 = cb.y1 + 16;
      }
      var fill = P.cluster, line = P.clusterLine;
      var t = c.tint;
      if (t) { fill = t.fill; line = t.stroke + (dark ? '88' : '99'); }
      var cg = s('g', { class: 'lv-cluster', 'data-id': c.id });
      cg.appendChild(s('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 16, fill: fill, 'fill-opacity': t && !dark ? 0.7 : 1, stroke: line, 'stroke-width': 1 }));
      cg.appendChild(s('text', { x: x0 + 16, y: y0 + 24, 'font-size': 11, 'font-weight': 700, 'letter-spacing': '.06em', 'font-family': FONT, fill: P.clusterText, text: textLines(c.label).join(' ').toUpperCase() }));
      layerC.appendChild(cg);
      grow(x0, y0, x1, y1);
    });

    // edges
    var edgeEls = [], labelEls = [];
    scene.edges.forEach(function (e, i) {
      if (!byId[e.from] || !byId[e.to] || e.hidden) return;
      var de = dg.edge({ v: e.from, w: e.to, name: 'e' + i });
      if (!de || !de.points || !de.points.length) return;
      var pts = de.points.length === 1 ? [de.points[0], de.points[0]] : de.points;
      var path = s('path', { class: 'lv-edge', d: smoothPath(pts), stroke: P.edge, 'stroke-width': e.thick ? 3 : 1.7 });
      if (e.dash) path.setAttribute('stroke-dasharray', '5 5');
      if (e.head && e.head !== 'none') path.setAttribute('marker-end', 'url(#' + uid + '-' + e.head + ')');
      if (e.tail && e.tail !== 'none') path.setAttribute('marker-start', 'url(#' + uid + '-' + e.tail + ')');
      layerE.appendChild(path);
      edgeEls[i] = path;
      pts.forEach(function (p) { grow(p.x, p.y, p.x, p.y); });
      if (e.lines.length) {
        var w = e.lw, hh = 8 + e.lines.length * 14;
        var lg = s('g', { class: 'lv-elabel' }, [s('rect', { x: de.x - w / 2, y: de.y - hh / 2, width: w, height: hh, rx: 9, fill: P.pill, stroke: P.pillLine })]);
        var tx = s('text', { x: de.x, y: de.y - (e.lines.length - 1) * 7 + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 500, 'font-family': FONT, fill: P.sub });
        tspans(tx, e.lines, de.x, 14);
        lg.appendChild(tx);
        layerL.appendChild(lg);
        labelEls[i] = lg;
        grow(de.x - w / 2, de.y - hh / 2, de.x + w / 2, de.y + hh / 2);
      }
      [['labelStart', pts[0], pts[1]], ['labelEnd', pts[pts.length - 1], pts[pts.length - 2]]].forEach(function (k) {
        if (!e[k[0]]) return;
        var p = k[1], q = k[2], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
        var ex = p.x + dx / len * 18 - dy / len * 10, ey = p.y + dy / len * 18 + dx / len * 10;
        layerL.appendChild(s('text', { x: ex, y: ey + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, 'font-family': MONO, fill: P.accent, text: e[k[0]] }));
      });
    });

    // nodes
    var nodeEls = {};
    scene.nodes.forEach(function (n) {
      var p = pos[n.id];
      var x = p.x - n.w / 2, y = p.y - n.h / 2;
      var g = s('g', { class: 'lv-node', 'data-id': n.id, tabindex: 0, role: 'button', 'aria-label': (n.ariaLabel || textLines(n.label).join(' ')) });
      (NODE[n.kind] || NODE.card).draw(g, n, x, y, P, dark);
      layerN.appendChild(g);
      nodeEls[n.id] = g;
      grow(x, y, x + n.w, y + n.h);
    });
    if (b.x1 < b.x0) { b.x0 = 0; b.y0 = 0; b.x1 = 200; b.y1 = 100; }

    var fr = frame(dark, svg, b);
    var engine = Engine(fr.box);

    // ambient packets
    var packetCount = 0;
    edgeEls.forEach(function (path, i) {
      var e = scene.edges[i];
      if (!path || e.packets === false) return;
      var len = path.getTotalLength();
      var n = len > 380 ? 2 : 1;
      for (var k = 0; k < n; k++) {
        var halo = s('circle', { r: 7, class: 'lv-halo' });
        var dot = s('circle', { r: 3.4, class: 'lv-packet' });
        layerP.appendChild(halo); layerP.appendChild(dot);
        engine.add({ path: path, el: dot, halo: halo, speed: 62 + (i % 4) * 14, loop: true, gap: 50, d: (((k / n) + (i * 0.31)) % 1) * (len + 50) });
        packetCount++;
      }
    });

    // trace on hover, pin on click
    function nameOf(id) { var n = byId[id]; return n ? (n.caption || textLines(n.label).join(' ')) : id; }
    var idleCap = 'Hover a node to trace its path, click to pin' + (scene.noReplay ? '.' : ', or press <b>Replay</b>.');
    fr.cap.innerHTML = idleCap;
    var adj = { out: {}, inn: {} };
    scene.edges.forEach(function (e) {
      if (!byId[e.from] || !byId[e.to] || e.from === e.to) return;
      (adj.out[e.from] = adj.out[e.from] || []).push(e.to);
      (adj.inn[e.to] = adj.inn[e.to] || []).push(e.from);
    });
    function reach(id, table) {
      var seen = {}, st = [id];
      while (st.length) { var cur = st.pop(); (table[cur] || []).forEach(function (n) { if (!seen[n] && n !== id) { seen[n] = 1; st.push(n); } }); }
      return seen;
    }
    var pinned = null, replaying = false, token = 0;
    function trace(id) {
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove('lv-dim'); });
      edgeEls.forEach(function (el, i) { if (el) { el.classList.remove('lv-dim', 'lv-hot'); if (labelEls[i]) labelEls[i].classList.remove('lv-dim'); } });
      if (!id) { fr.cap.innerHTML = idleCap; return; }
      var down = reach(id, adj.out), up = reach(id, adj.inn);
      var inSet = function (x) { return x === id || up[x] || down[x]; };
      Object.keys(nodeEls).forEach(function (k) { if (!inSet(k)) nodeEls[k].classList.add('lv-dim'); });
      scene.edges.forEach(function (e, i) {
        var el = edgeEls[i]; if (!el) return;
        var u = (e.from === id || up[e.from]) && (e.to === id || up[e.to]);
        var d = (e.from === id || down[e.from]) && (e.to === id || down[e.to]);
        if (u || d) el.classList.add('lv-hot'); else { el.classList.add('lv-dim'); if (labelEls[i]) labelEls[i].classList.add('lv-dim'); }
      });
      var ups = Object.keys(up).map(nameOf), downs = Object.keys(down).map(nameOf);
      function list(a) { return a.length ? a.length + ' (' + a.slice(0, 4).join(', ') + (a.length > 4 ? ', …' : '') + ')' : 'nothing'; }
      fr.cap.innerHTML = '<b>' + nameOf(id) + '</b> · fed by ' + list(ups) + ' · feeds ' + list(downs);
    }
    Object.keys(nodeEls).forEach(function (id) {
      var el = nodeEls[id];
      el.addEventListener('mouseenter', function () { if (!pinned && !replaying) trace(id); });
      el.addEventListener('mouseleave', function () { if (!pinned && !replaying) trace(null); });
      el.addEventListener('focus', function () { if (!pinned && !replaying) trace(id); });
      el.addEventListener('blur', function () { if (!pinned && !replaying) trace(null); });
      el.addEventListener('click', function () {
        if (replaying) return;
        if (pinned === id) { pinned = null; el.classList.remove('lv-pin'); trace(null); return; }
        if (pinned) nodeEls[pinned].classList.remove('lv-pin');
        pinned = id; el.classList.add('lv-pin'); trace(id);
      });
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.dispatchEvent(new root.MouseEvent('click')); } });
    });

    // replay: a request ripples from the entry points through the graph
    var replayBtn = null;
    function pulse(id) {
      var el = nodeEls[id]; if (!el) return;
      el.classList.remove('lv-pulse'); void el.getBoundingClientRect(); el.classList.add('lv-pulse');
      setTimeout(function () { el.classList.remove('lv-pulse'); }, 1100);
    }
    function replay() {
      if (replaying) return;
      if (pinned) { nodeEls[pinned].classList.remove('lv-pin'); pinned = null; }
      trace(null);
      replaying = true;
      var my = ++token;
      var visited = {}, sent = {}, pending = 0;
      if (replayBtn) replayBtn.disabled = true;
      function done() {
        if (my !== token) return;
        replaying = false; if (replayBtn) replayBtn.disabled = false;
        fr.cap.innerHTML = 'Replay finished: <b>' + Object.keys(visited).length + '</b> of ' + scene.nodes.length + ' nodes reached.';
      }
      function visit(id, via) {
        if (visited[id] || my !== token) return;
        visited[id] = true;
        pulse(id);
        fr.cap.innerHTML = (via ? '<b>' + nameOf(via) + '</b> → ' : 'Start: ') + '<b>' + nameOf(id) + '</b>';
        scene.edges.forEach(function (e, i) {
          if (e.from !== id || sent[i] || !edgeEls[i]) return;
          sent[i] = true; pending++;
          var dot = s('circle', { r: 5.5, class: 'lv-burst' });
          layerP.appendChild(dot);
          setTimeout(function () {
            if (my !== token) { dot.remove(); return; }
            engine.add({ path: edgeEls[i], el: dot, speed: REDUCED ? 5000 : 260, loop: false, d: 0, onArrive: function () { pending--; visit(e.to, id); if (!pending) setTimeout(done, 700); } });
            if (!engine.running) engine.start();
          }, 260);
        });
        if (!pending) setTimeout(done, 700);
      }
      var hasIn = {};
      scene.edges.forEach(function (e) { if (e.from !== e.to && byId[e.to]) hasIn[e.to] = 1; });
      var srcs = scene.nodes.filter(function (n) { return !hasIn[n.id]; }).map(function (n) { return n.id; });
      if (!srcs.length && scene.nodes.length) srcs = [scene.nodes[0].id];
      srcs.forEach(function (id) { visit(id, null); });
    }

    var setMotion = null;
    if (!scene.noReplay) { replayBtn = btn('▶ Replay', 'Send a request through the diagram', function () { if (!engine.running) setMotion(true); replay(); }, true); fr.bar.appendChild(replayBtn); }
    setMotion = motionToggle(fr.bar, engine);
    speedControl(fr.bar, engine);
    fr.bar.appendChild(h('span', { class: 'lv-grow' }));
    zoomButtons(fr.bar, fr.pz);
    setMotion(!REDUCED);

    return {
      el: fr.wrap,
      dispose: function () { token++; engine.stop(); engine.clear(); },
      stats: { nodes: scene.nodes.length, edges: scene.edges.length, clusters: scene.clusters.length, packets: packetCount, flat: lay.flat, bounds: b }
    };
  }

  // ============================================================ EXTRACTORS (graphs) ===
  var CONTEXT_OK = { queue: 1, worker: 1, database: 1, cache: 1, bucket: 1, server: 1 };
  function iconFor(label, shape, clusterLabels) {
    var own = I.pick(label, shape);
    if (own) return own;
    for (var i = 0; i < clusterLabels.length; i++) {
      var ci = I.pick(clusterLabels[i], null);
      if (ci && CONTEXT_OK[ci]) return ci;
    }
    return null;
  }

  function parse(code) {
    var api = root.mermaid && root.mermaid.mermaidAPI;
    if (!api || !api.getDiagramFromText) return Promise.reject(new Error('Mermaid parser unavailable'));
    return api.getDiagramFromText(code);
  }

  var FLOW_HEAD = { arrow_point: 'arrow', arrow_open: 'none', arrow_cross: 'cross', arrow_circle: 'circle', double_arrow_point: 'arrow', double_arrow_cross: 'cross', double_arrow_circle: 'circle' };
  function flowScene(code, dark) {
    return parse(code).then(function (d) {
      var db = d.db;
      var verts = arr(db.getVertices());
      var classDefs = {};
      arr(db.getClasses ? db.getClasses() : []).forEach(function (c) { classDefs[c.id] = c.styles || []; });
      var subs = (db.getSubGraphs ? db.getSubGraphs() : []) || [];
      var parentOf = {}, clusterIds = {};
      subs.forEach(function (sg) { clusterIds[sg.id] = 1; (sg.nodes || []).forEach(function (n) { parentOf[n] = sg.id; }); });
      var clusterStyle = {};
      var clusterLabel = {};
      subs.forEach(function (sg) { clusterLabel[sg.id] = textLines(sg.title).join(' '); });
      function stylesOf(v) {
        var list = [];
        (v.classes || []).forEach(function (cn) { list = list.concat(classDefs[cn] || []); });
        return parseStyles(list.concat(v.styles || []));
      }
      verts.forEach(function (v) { if (clusterIds[v.id]) clusterStyle[v.id] = stylesOf(v); });
      var nodes = verts.filter(function (v) { return !clusterIds[v.id]; }).map(function (v) {
        var label = String(v.text != null && v.text !== '' ? v.text : v.id);
        var chain = [], pid = parentOf[v.id], hops = 0;
        while (pid && hops++ < 4) { chain.push(clusterLabel[pid] || ''); pid = parentOf[pid]; }
        var icon = iconFor(label, v.type, chain);
        var st = stylesOf(v);
        var lines = textLines(label);
        if (icon) lines = textLines(label.replace(EMOJI, ''));
        var n = { id: v.id, kind: 'card', label: lines.join('\n'), icon: icon, tint: st.fill ? tint(st.fill, dark) : null, parent: parentOf[v.id] || null };
        return n;
      });
      var edges = db.getEdges().map(function (e) {
        var dbl = /^double_/.test(e.type || '');
        var head = FLOW_HEAD[e.type] || 'arrow';
        return { from: e.start, to: e.end, label: textLines(e.text).join('\n') === '' ? '' : textLines(e.text).join('\n'), dash: e.stroke === 'dotted', thick: e.stroke === 'thick', head: head, tail: dbl ? head : 'none', hidden: e.stroke === 'invisible' };
      });
      var clusters = subs.map(function (sg) {
        var st = clusterStyle[sg.id] || {};
        return { id: sg.id, label: clusterLabel[sg.id] || sg.id, parent: parentOf[sg.id] || null, tint: st.fill ? tint(st.fill, dark) : null };
      });
      return { kind: 'flow', direction: db.getDirection ? db.getDirection() : 'TB', nodes: nodes, edges: edges, clusters: clusters };
    });
  }

  function stateScene(code, dark) {
    return parse(code).then(function (d) {
      var db = d.db;
      var data = db.getData();
      var groups = {};
      data.nodes.forEach(function (n) { if (n.isGroup) groups[n.id] = n; });
      var nodes = [], clusters = [];
      data.nodes.forEach(function (n) {
        var parent = n.parentId || null;
        if (n.isGroup) {
          if (n.shape === 'noteGroup') return; // the note itself carries the text
          clusters.push({ id: n.id, label: n.label || n.id, parent: parent && groups[parent] && groups[parent].shape !== 'noteGroup' ? parent : null });
          return;
        }
        if (parent && groups[parent] && groups[parent].shape === 'noteGroup') parent = null;
        var base = { id: n.id, parent: parent };
        if (n.shape === 'stateStart') nodes.push(Object.assign(base, { kind: 'start', label: 'start', ariaLabel: 'Start' }));
        else if (n.shape === 'stateEnd') nodes.push(Object.assign(base, { kind: 'end', label: 'end', ariaLabel: 'End' }));
        else if (n.shape === 'choice') nodes.push(Object.assign(base, { kind: 'choice', label: n.label || 'choice' }));
        else if (n.shape === 'forkJoin' || n.shape === 'fork' || n.shape === 'join') nodes.push(Object.assign(base, { kind: 'bar', label: 'fork/join' }));
        else if (n.shape === 'note') nodes.push(Object.assign(base, { kind: 'note', label: n.label || '' }));
        else if (n.shape === 'divider') return;
        else {
          var label = String(n.label != null && n.label !== '' ? n.label : n.id);
          var icon = I.pick(label, null);
          nodes.push(Object.assign(base, { kind: 'card', label: textLines(icon ? label.replace(EMOJI, '') : label).join('\n'), icon: icon }));
        }
      });
      var ids = {}; nodes.forEach(function (n) { ids[n.id] = 1; });
      var edges = data.edges.map(function (e) {
        var isNote = e.arrowhead === 'none' || e.arrowTypeEnd === 'none';
        return { from: e.start, to: e.end, label: textLines(e.label || '').join('\n') === '' ? '' : textLines(e.label || '').join('\n'), dash: isNote, head: isNote ? 'none' : 'arrow', tail: 'none', packets: !isNote };
      });
      return { kind: 'state', direction: (db.getDirection && db.getDirection()) || 'TB', nodes: nodes, edges: edges, clusters: clusters, nodesep: 60 };
    });
  }

  function genericName(s0) { return String(s0 || '').replace(/~(.+?)~/g, '<$1>'); }
  var CLASS_END = { 0: 'diamondOpen', 1: 'tri', 2: 'diamond', 3: 'open', 4: 'circle' };
  function classScene(code, dark) {
    return parse(code).then(function (d) {
      var db = d.db;
      var classes = arr(db.getClasses());
      var nodes = classes.map(function (c) {
        var fmt = function (m) {
          return { text: genericName(String(m.text || m.id || '')).replace(/\\/g, ''), abstract: m.classifier === '*', stat: m.classifier === '$' };
        };
        var ann = (c.annotations || []).map(String);
        var name = genericName(c.label || c.id);
        var icon = I.pick(name, null) || (ann.indexOf('interface') >= 0 ? 'api' : ann.indexOf('enumeration') >= 0 || ann.indexOf('enum') >= 0 ? 'sliders' : ann.indexOf('abstract') >= 0 ? 'registry' : 'service');
        return { id: c.id, kind: 'class', label: name, caption: name, icon: icon, annotations: ann, attrs: (c.members || []).map(fmt), methods: (c.methods || []).map(fmt) };
      });
      var have = {}; nodes.forEach(function (n) { have[n.id] = 1; });
      var edges = [];
      arr(db.getRelations()).forEach(function (r) {
        var rel = r.relation || {};
        var t1 = CLASS_END[rel.type1] || 'none', t2 = CLASS_END[rel.type2] || 'none';
        var plain = t1 === 'none' && (t2 === 'none' || t2 === 'open');
        var lab = function (v) { return v && v !== 'none' ? String(v) : ''; };
        edges.push({ from: r.id1, to: r.id2, label: lab(r.title), labelStart: lab(r.relationTitle1), labelEnd: lab(r.relationTitle2), dash: rel.lineType === 1, head: t2, tail: t1, packets: plain });
        if (!have[r.id1] || !have[r.id2]) edges.pop();
      });
      var notes = db.getNotes ? arr(db.getNotes()) : [];
      notes.forEach(function (nt) {
        if (!have[nt.class]) return;
        nodes.push({ id: 'note:' + nt.id, kind: 'note', label: nt.text, caption: 'Note' });
        edges.push({ from: 'note:' + nt.id, to: nt.class, dash: true, head: 'none', tail: 'none', packets: false });
      });
      var clusters = [];
      var nsRaw = db.getNamespaces ? db.getNamespaces() : null;
      arr(nsRaw).forEach(function (ns) {
        clusters.push({ id: 'ns:' + ns.id, label: ns.id, parent: null });
        arr(ns.classes).forEach(function (c) { var n = nodes.filter(function (x) { return x.id === (c.id || c); })[0]; if (n) n.parent = 'ns:' + ns.id; });
      });
      return { kind: 'class', direction: (db.getDirection && db.getDirection()) || 'TB', nodes: nodes, edges: edges, clusters: clusters, nodesep: 60, ranksep: 90 };
    });
  }

  var CARD = { ZERO_OR_ONE: '0..1', ZERO_OR_MORE: '0..*', ONE_OR_MORE: '1..*', ONLY_ONE: '1', MD_PARENT: 'parent' };
  function erScene(code) {
    return parse(code).then(function (d) {
      var db = d.db;
      var ents = arr(db.getEntities());
      var byId = {};
      var nodes = ents.map(function (e) {
        byId[e.id] = e;
        var icon = I.pick(e.label || e.alias || '', null) || 'database';
        return { id: e.id, kind: 'entity', label: e.alias || e.label, caption: e.alias || e.label, icon: icon,
          rows: (e.attributes || []).map(function (a) { return { type: String(a.type || ''), name: String(a.name || ''), keys: (a.keys || []).join(',') }; }) };
      });
      var edges = arr(db.getRelationships()).filter(function (r) { return byId[r.entityA] && byId[r.entityB]; }).map(function (r) {
        return { from: r.entityA, to: r.entityB, label: r.roleA || '', labelStart: CARD[r.relSpec.cardB] || '', labelEnd: CARD[r.relSpec.cardA] || '', dash: r.relSpec.relType === 'NON_IDENTIFYING', head: 'none', tail: 'none', packets: true };
      });
      return { kind: 'er', direction: 'TB', nodes: nodes, edges: edges, clusters: [], nodesep: 70, ranksep: 100 };
    });
  }

  function mindmapScene(code, dark) {
    return parse(code).then(function (d) {
      var tree = d.db.getMindmap();
      var nodes = [], edges = [];
      var branch = 0;
      var palette2 = [
        dark ? { fill: '#251a45', stroke: '#b794ff' } : { fill: '#efe8ff', stroke: '#7c3aed' },
        dark ? { fill: '#3a1428', stroke: '#ff7ab8' } : { fill: '#fde7f1', stroke: '#db2777' },
        dark ? { fill: '#301848', stroke: '#d8a4ff' } : { fill: '#f4e8ff', stroke: '#9333ea' },
        dark ? { fill: '#421a35', stroke: '#ff9ccf' } : { fill: '#ffe8f4', stroke: '#ec4899' }
      ];
      (function walk(node, parent, level, tintIdx) {
        var id = 'm' + node.id;
        var label = textLines(node.descr || node.nodeId).join('\n');
        var icon = level === 0 ? null : I.pick(label, null);
        nodes.push({ id: id, kind: 'pill', label: icon ? textLines(label.replace(EMOJI, '')).join('\n') : label, icon: icon, level: level, tint: palette2[tintIdx % palette2.length] });
        if (parent) edges.push({ from: parent, to: id, head: 'none', tail: 'none', packets: true });
        (node.children || []).forEach(function (c, i) { walk(c, id, level + 1, level === 0 ? branch++ : tintIdx); });
      })(tree, null, 0, 0);
      return { kind: 'mindmap', direction: 'LR', nodes: nodes, edges: edges, clusters: [], nodesep: 26, ranksep: 70 };
    });
  }

  // ============================================================== SEQUENCE ===
  var T = { SOLID: 0, DOTTED: 1, NOTE: 2, SOLID_CROSS: 3, DOTTED_CROSS: 4, SOLID_OPEN: 5, DOTTED_OPEN: 6, LOOP_START: 10, LOOP_END: 11, ALT_START: 12, ALT_ELSE: 13, ALT_END: 14,
    OPT_START: 15, OPT_END: 16, ACTIVE_START: 17, ACTIVE_END: 18, PAR_START: 19, PAR_AND: 20, PAR_END: 21, RECT_START: 22, RECT_END: 23, SOLID_POINT: 24, DOTTED_POINT: 25,
    AUTONUMBER: 26, CRITICAL_START: 27, CRITICAL_OPTION: 28, CRITICAL_END: 29, BREAK_START: 30, BREAK_END: 31, PAR_OVER_START: 32 };
  var FRAME_KIND = {}; FRAME_KIND[T.LOOP_START] = 'loop'; FRAME_KIND[T.ALT_START] = 'alt'; FRAME_KIND[T.OPT_START] = 'opt'; FRAME_KIND[T.PAR_START] = 'par'; FRAME_KIND[T.PAR_OVER_START] = 'par';
  FRAME_KIND[T.CRITICAL_START] = 'critical'; FRAME_KIND[T.BREAK_START] = 'break'; FRAME_KIND[T.RECT_START] = 'rect';
  var FRAME_END = {}; FRAME_END[T.LOOP_END] = 1; FRAME_END[T.ALT_END] = 1; FRAME_END[T.OPT_END] = 1; FRAME_END[T.PAR_END] = 1; FRAME_END[T.CRITICAL_END] = 1; FRAME_END[T.BREAK_END] = 1; FRAME_END[T.RECT_END] = 1;
  var FRAME_MID = {}; FRAME_MID[T.ALT_ELSE] = 'else'; FRAME_MID[T.PAR_AND] = 'and'; FRAME_MID[T.CRITICAL_OPTION] = 'option';

  function sequenceModel(code) {
    return parse(code).then(function (d) {
      var db = d.db;
      var actorsRaw = db.getActors();
      var names = Object.keys(actorsRaw instanceof Map ? Object.fromEntries(actorsRaw) : actorsRaw);
      var get = function (k) { return actorsRaw instanceof Map ? actorsRaw.get(k) : actorsRaw[k]; };
      var actors = names.map(function (k) {
        var a = get(k);
        var label = String(a.description != null && a.description !== '' ? a.description : a.name);
        var kind = a.type === 'actor' ? 'actor' : 'participant';
        var icon = kind === 'actor' ? 'user' : (I.pick(label, null) || 'service');
        return { id: k, label: icon && !(kind === 'actor') ? label.replace(EMOJI, '').trim() || label : label.replace(EMOJI, '').trim() || label, icon: icon, kind: kind };
      });
      var msgs = db.getMessages();
      return { kind: 'sequence', actors: actors, messages: msgs, title: (db.getDiagramTitle && db.getDiagramTitle()) || '' };
    });
  }

  function renderSequence(model, dark) {
    var P = palette(dark);
    var uid = 'lv' + (++seq);
    var actors = model.actors;
    if (!actors.length) throw new Error('No participants');
    var ix = {}; actors.forEach(function (a, i) { ix[a.id] = i; });
    var N = actors.length;

    // actor cards
    actors.forEach(function (a) {
      a.lines = wrapAll(textLines(a.label), 150, LFONT);
      a.w = Math.max(116, maxW(a.lines, LFONT) + 30);
      a.h = 14 + 38 + 8 + a.lines.length * 16 + 12;
    });
    var headH = Math.max.apply(null, actors.map(function (a) { return a.h; }));

    // flatten the message list into drawable items
    var items = [], stack = [], autoNum = null, step = 1;
    model.messages.forEach(function (m) {
      var t = m.type;
      if (t === T.AUTONUMBER) { var cfg = m.message || {}; autoNum = (cfg.visible === false || cfg.start == null) ? null : +cfg.start; step = +cfg.step || 1; return; }
      if (t === T.NOTE) {
        var placement = m.placement; // 0 left of, 1 right of, 2 over
        var a = ix[m.from], b = m.to != null && ix[m.to] != null ? ix[m.to] : a;
        if (a == null) return;
        var lines = wrapAll(textLines(m.message), 250, '12px ' + FONT);
        items.push({ t: 'note', place: placement, a: Math.min(a, b), b: Math.max(a, b), lines: lines, w: maxW(lines, '12px ' + FONT) + 28 });
        return;
      }
      if (FRAME_KIND[t]) { var fr0 = { t: 'open', kind: FRAME_KIND[t], label: String(m.message || ''), id: items.length }; stack.push(fr0); items.push(fr0); return; }
      if (FRAME_MID[t]) { items.push({ t: 'mid', kind: FRAME_MID[t], label: String(m.message || '') }); return; }
      if (FRAME_END[t]) { var top = stack.pop(); items.push({ t: 'close', open: top }); return; }
      if (t === T.ACTIVE_START || t === T.ACTIVE_END) { if (ix[m.from] != null) items.push({ t: 'act', on: t === T.ACTIVE_START, a: ix[m.from] }); return; }
      if (ix[m.from] == null || ix[m.to] == null) return;
      var ml = wrapAll(textLines(m.message), 360, '12px ' + FONT);
      var num = null;
      if (autoNum != null) { num = autoNum; autoNum += step; }
      items.push({ t: 'msg', from: ix[m.from], to: ix[m.to], lines: ml, type: t, num: num, w: maxW(ml, '12px ' + FONT) });
    });
    // blocks left open by a parse quirk are closed at the end
    while (stack.length) items.push({ t: 'close', open: stack.pop() });

    // horizontal layout: gaps between neighbouring lifelines
    var gap = [];
    for (var k = 0; k < N - 1; k++) gap[k] = (actors[k].w + actors[k + 1].w) / 2 + 28;
    var reqs = [];
    var extraLeft = 0, extraRight = 0;
    items.forEach(function (it) {
      if (it.t === 'msg') {
        if (it.from === it.to) { if (it.from < N - 1) reqs.push({ i: it.from, j: it.from + 1, need: it.w + 96 }); else extraRight = Math.max(extraRight, it.w + 96); }
        else reqs.push({ i: Math.min(it.from, it.to), j: Math.max(it.from, it.to), need: it.w + 64 });
      } else if (it.t === 'note') {
        if (it.place === 2) {
          if (it.a === it.b) { if (it.a > 0) reqs.push({ i: it.a - 1, j: it.a, need: it.w / 2 + 40 }); if (it.a < N - 1) reqs.push({ i: it.a, j: it.a + 1, need: it.w / 2 + 40 }); extraLeft = Math.max(extraLeft, it.a === 0 ? it.w / 2 : 0); extraRight = Math.max(extraRight, it.a === N - 1 ? it.w / 2 : 0); }
          else reqs.push({ i: it.a, j: it.b, need: it.w + 24 });
        } else if (it.place === 1) { if (it.a < N - 1) reqs.push({ i: it.a, j: it.a + 1, need: it.w + 50 }); else extraRight = Math.max(extraRight, it.w + 30); }
        else { if (it.a > 0) reqs.push({ i: it.a - 1, j: it.a, need: it.w + 50 }); else extraLeft = Math.max(extraLeft, it.w + 30); }
      }
    });
    reqs.sort(function (p, q) { return (p.j - p.i) - (q.j - q.i); });
    reqs.forEach(function (r) {
      var sum = 0; for (var g = r.i; g < r.j; g++) sum += gap[g];
      if (sum < r.need) { var add = (r.need - sum) / (r.j - r.i); for (var g2 = r.i; g2 < r.j; g2++) gap[g2] += add; }
    });
    var X = [], x0 = Math.max(actors[0].w / 2, extraLeft) + 30;
    for (var q = 0; q < N; q++) X[q] = q === 0 ? x0 : X[q - 1] + gap[q - 1];

    // vertical layout
    var y = headH + 30;
    var LH = 16;
    items.forEach(function (it) {
      it.y = y;
      if (it.t === 'msg') {
        var th = it.lines.length * LH;
        it.textY = y; it.ay = y + th + 8;
        it.h = th + (it.from === it.to ? 40 : 30);
        y += it.h;
      } else if (it.t === 'note') { it.h = it.lines.length * LH + 18; y += it.h + 14; }
      else if (it.t === 'open') { y += 34; }
      else if (it.t === 'mid') { y += 34; }
      else if (it.t === 'close') { y += 12; it.endY = y - 4; }
      else if (it.t === 'act') { it.ay = y; }
    });
    var footY = y + 16;

    // frame extents (union of the actors used inside)
    var openRef = {};
    stack = [];
    items.forEach(function (it) {
      if (it.t === 'open') { it.lo = 1e9; it.hi = -1e9; it.startY = it.y; stack.push(it); }
      else if (it.t === 'close') { var o = it.open; if (o) o.endY = it.endY; stack.pop(); }
      else if (stack.length) {
        var top2 = stack[stack.length - 1];
        var lo = it.t === 'msg' ? Math.min(it.from, it.to) : it.t === 'note' ? it.a : null;
        var hi = it.t === 'msg' ? Math.max(it.from, it.to) : it.t === 'note' ? it.b : null;
        if (lo != null) stack.forEach(function (f) { f.lo = Math.min(f.lo, lo); f.hi = Math.max(f.hi, hi); });
        void top2;
      }
    });

    // ---- draw
    var svg = s('svg', { role: 'img', 'aria-label': model.title || 'Sequence diagram' });
    var defs = s('defs'); addMarkers(defs, uid, P); svg.appendChild(defs);
    var layerBg = s('g'), layerLife = s('g'), layerAct = s('g'), layerMsg = s('g'), layerCards = s('g'), layerDots = s('g');
    [layerBg, layerLife, layerAct, layerMsg, layerCards, layerDots].forEach(function (l) { svg.appendChild(l); });
    var B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    function grow(a, b0, c, d0) { B.x0 = Math.min(B.x0, a); B.y0 = Math.min(B.y0, b0); B.x1 = Math.max(B.x1, c); B.y1 = Math.max(B.y1, d0); }

    // frames (loop / alt / ...), drawn first so messages sit on top
    var frameStack = [], depthOf = 0;
    items.forEach(function (it) {
      if (it.t === 'open') { it.depth = frameStack.length; frameStack.push(it); }
      else if (it.t === 'close') { frameStack.pop(); }
    });
    items.forEach(function (it) {
      if (it.t !== 'open' || it.hi < it.lo || it.endY == null) return;
      var inset = (4 - Math.min(3, it.depth)) * 5;
      var fx0 = X[it.lo] - actors[it.lo].w / 2 - 6 - inset + 4, fx1 = X[it.hi] + actors[it.hi].w / 2 + 6 + inset - 4;
      var hasSelf = items.some(function (m) { return m.t === 'msg' && m.from === m.to && m.y >= it.startY && m.y <= it.endY && (m.from === it.hi); });
      if (hasSelf) fx1 += 70;
      if (it.kind === 'rect') {
        var tt = tint(it.label, dark) || { fill: dark ? '#251a45' : '#efe8ff', stroke: P.accent2 };
        layerBg.appendChild(s('rect', { x: fx0, y: it.startY, width: fx1 - fx0, height: it.endY - it.startY, rx: 10, fill: tt.fill, 'fill-opacity': dark ? 0.55 : 0.6 }));
        return;
      }
      var cg = s('g');
      cg.appendChild(s('rect', { x: fx0, y: it.startY, width: fx1 - fx0, height: it.endY - it.startY, rx: 12, fill: 'none', stroke: P.accent2, 'stroke-opacity': 0.55, 'stroke-width': 1.3 }));
      var tab = it.kind;
      var tabW = tw(tab, '700 11px ' + FONT) + 18;
      cg.appendChild(s('path', { d: 'M' + fx0 + ',' + it.startY + ' H' + (fx0 + tabW) + ' V' + (it.startY + 18) + ' L' + (fx0 + tabW - 8) + ',' + (it.startY + 24) + ' H' + fx0 + ' Z', fill: P.accent2, 'fill-opacity': dark ? 0.9 : 1 }));
      cg.appendChild(s('text', { x: fx0 + 9, y: it.startY + 16, 'font-size': 11, 'font-weight': 700, 'font-family': FONT, fill: dark ? '#1a0b2e' : '#fff', text: tab }));
      if (it.label) cg.appendChild(s('text', { x: fx0 + tabW + 10, y: it.startY + 17, 'font-size': 12, 'font-family': FONT, fill: P.sub, text: '[' + decode(it.label) + ']' }));
      layerBg.appendChild(cg);
      grow(fx0, it.startY, fx1, it.endY);
    });
    items.forEach(function (it) {
      if (it.t !== 'mid') return;
      // divider across the nearest enclosing frame
      var fr1 = null;
      items.forEach(function (o) { if (o.t === 'open' && o.startY <= it.y && o.endY != null && o.endY >= it.y && o.hi >= o.lo) fr1 = o; });
      if (!fr1) return;
      var inset = (4 - Math.min(3, fr1.depth)) * 5;
      var fx0 = X[fr1.lo] - actors[fr1.lo].w / 2 - 6 - inset + 4, fx1 = X[fr1.hi] + actors[fr1.hi].w / 2 + 6 + inset - 4;
      layerBg.appendChild(s('line', { x1: fx0, y1: it.y + 10, x2: fx1, y2: it.y + 10, stroke: P.accent2, 'stroke-opacity': 0.5, 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }));
      layerBg.appendChild(s('text', { x: fx0 + 10, y: it.y + 27, 'font-size': 12, 'font-family': FONT, fill: P.sub, text: '[' + (it.label ? decode(it.label) : it.kind) + ']' }));
    });

    // lifelines
    actors.forEach(function (a, i) {
      layerLife.appendChild(s('line', { x1: X[i], y1: headH, x2: X[i], y2: footY, stroke: P.cardLine, 'stroke-width': 1.6, 'stroke-dasharray': '5 5' }));
    });

    // activation bars
    var actStack = actors.map(function () { return []; }), lastAy = headH + 40;
    items.forEach(function (it) {
      if (it.t === 'msg') lastAy = it.ay;
      if (it.t === 'act') {
        if (it.on) actStack[it.a].push(lastAy - 4);
        else { var st = actStack[it.a].pop(); if (st != null) layerAct.appendChild(s('rect', { x: X[it.a] - 5 + actStack[it.a].length * 4, y: st, width: 10, height: Math.max(8, lastAy + 4 - st), rx: 3, fill: P.note, stroke: P.accent2, 'stroke-width': 1.2 })); }
      }
    });
    actStack.forEach(function (stk, i) { stk.forEach(function (st) { layerAct.appendChild(s('rect', { x: X[i] - 5, y: st, width: 10, height: Math.max(8, footY - 20 - st), rx: 3, fill: P.note, stroke: P.accent2, 'stroke-width': 1.2 })); }); });

    // messages and notes (each a step group)
    var steps = [];
    function arrowAttrs(type) {
      var dash = (type === T.DOTTED || type === T.DOTTED_CROSS || type === T.DOTTED_OPEN || type === T.DOTTED_POINT);
      var head = (type === T.SOLID || type === T.DOTTED) ? 'arrow' : (type === T.SOLID_CROSS || type === T.DOTTED_CROSS) ? 'cross' : (type === T.SOLID_POINT || type === T.DOTTED_POINT) ? 'open' : 'none';
      return { dash: dash, head: head };
    }
    items.forEach(function (it) {
      if (it.t === 'msg') {
        var g = s('g', { class: 'lv-step' });
        var aa = arrowAttrs(it.type);
        var self = it.from === it.to;
        var x1 = X[it.from], x2 = X[it.to];
        var d, tx, ta;
        if (self) {
          d = 'M' + x1 + ',' + (it.ay - 8) + ' h46 q10,0 10,10 v12 q0,10 -10,10 h-44';
          tx = x1 + 66; ta = 'start';
        } else {
          var dir0 = x2 > x1 ? 1 : -1;
          d = 'M' + (x1 + dir0 * 2) + ',' + it.ay + ' L' + (x2 - dir0 * 2) + ',' + it.ay;
          tx = (x1 + x2) / 2; ta = 'middle';
        }
        var line = s('path', { class: 'lv-mline', d: d, fill: 'none', stroke: P.edge, 'stroke-width': 1.7 });
        if (aa.dash) line.setAttribute('stroke-dasharray', '6 5');
        if (aa.head !== 'none') line.setAttribute('marker-end', 'url(#' + uid + '-' + aa.head + ')');
        g.appendChild(line);
        var text = s('text', { class: 'lv-mtext', x: tx, y: self ? it.textY + 14 : it.textY + 12, 'text-anchor': ta, 'font-size': 12, 'font-family': FONT, fill: P.text });
        tspans(text, it.lines, tx, LH);
        g.appendChild(text);
        if (it.num != null) {
          g.appendChild(s('circle', { cx: x1 + (self ? -14 : (x2 > x1 ? 14 : -14)), cy: it.ay - (self ? 0 : 0), r: 8, fill: P.accent2 }));
          g.appendChild(s('text', { x: x1 + (self ? -14 : (x2 > x1 ? 14 : -14)), y: it.ay + 3.5, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700, 'font-family': FONT, fill: dark ? '#1a0b2e' : '#fff', text: String(it.num) }));
        }
        layerMsg.appendChild(g);
        it.el = g; it.path = line; it.cap = { from: actors[it.from].label, to: actors[it.to].label, text: it.lines.join(' ') };
        steps.push(it);
        grow(Math.min(x1, x2) - 20, it.y, Math.max(x1, x2) + (self ? 70 + it.w : 20), it.y + it.h);
      } else if (it.t === 'note') {
        var cxm, w = it.w;
        if (it.place === 2) cxm = (X[it.a] + X[it.b]) / 2, w = Math.max(w, X[it.b] - X[it.a] + 24);
        else if (it.place === 1) cxm = X[it.a] + 14 + w / 2;
        else cxm = X[it.a] - 14 - w / 2;
        var ng = s('g', { class: 'lv-step' });
        ng.appendChild(s('path', { class: 'lv-ncard', d: 'M' + (cxm - w / 2) + ',' + it.y + ' H' + (cxm + w / 2 - 10) + ' L' + (cxm + w / 2) + ',' + (it.y + 10) + ' V' + (it.y + it.h) + ' H' + (cxm - w / 2) + ' Z', fill: P.note, stroke: P.noteLine, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
        var nt = s('text', { x: cxm, y: it.y + 20, 'text-anchor': 'middle', 'font-size': 12, 'font-family': FONT, fill: P.text });
        tspans(nt, it.lines, cxm, LH);
        ng.appendChild(nt);
        layerMsg.appendChild(ng);
        it.el = ng; it.cx = cxm; it.cap = { note: it.lines.join(' ') };
        steps.push(it);
        grow(cxm - w / 2, it.y, cxm + w / 2, it.y + it.h);
      }
    });

    // participant cards, top and bottom
    function actorCard(a, i, yTop) {
      var g = s('g', { class: 'lv-actor' });
      var x = X[i] - a.w / 2;
      g.appendChild(s('rect', { class: 'lv-card', x: x, y: yTop, width: a.w, height: a.h, rx: 14, fill: P.card, stroke: I.colors(a.icon || 'service', dark ? 'dark' : 'light').fg + (dark ? '66' : '55'), 'stroke-width': 1.4 }));
      var cx = X[i];
      var ty = yTop + 14;
      if (a.icon) { iconBadge(g, cx, yTop + 33, a.icon, dark, 19); ty = yTop + 60; }
      var t = s('text', { x: cx, y: ty + 12, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, 'font-family': FONT, fill: P.text });
      tspans(t, a.lines, cx, 16);
      g.appendChild(t);
      layerCards.appendChild(g);
      grow(x, yTop, x + a.w, yTop + a.h);
    }
    actors.forEach(function (a, i) { actorCard(a, i, 0); actorCard(a, i, footY); });
    var fullB = { x0: B.x0, y0: B.y0, x1: B.x1, y1: B.y1 };
    if (extraRight) fullB.x1 = Math.max(fullB.x1, X[N - 1] + extraRight);

    var fr = frame(dark, svg, fullB);
    var engine = { speed: 1 };
    var idx = -1, playing = false, timer = 0, dot = null;
    var counter = h('span', { class: 'lv-chip', text: 'Step 0 / ' + steps.length });
    function clearStep() { steps.forEach(function (st) { st.el.classList.remove('lv-sdim', 'lv-scur'); }); }
    function cameraTo(st) {
      var bse = fr.base;
      var span = st.t === 'msg' ? Math.abs(X[st.to] - X[st.from]) : 300;
      var cx = st.t === 'msg' ? (X[st.from] + X[st.to]) / 2 : st.cx;
      var w = Math.min(bse.w, Math.max(span + 460, 900));
      var hh = w * 0.56;
      if (bse.w <= w * 1.05 && bse.h <= hh * 1.4) { fr.pz.reset(); return; }
      var y0 = st.y;
      fr.pz.to({ x: Math.max(bse.x, Math.min(bse.x + bse.w - w, cx - w / 2)), y: Math.max(bse.y, Math.min(bse.y + bse.h - hh, y0 - hh * 0.4)), w: w, h: hh }, 450);
    }
    function travel(st) {
      if (dot) { dot.remove(); dot = null; }
      if (REDUCED || st.t !== 'msg') return;
      var d = s('circle', { r: 5.5, class: 'lv-dot' });
      layerDots.appendChild(d); dot = d;
      var len = st.path.getTotalLength(), t0 = root.performance.now(), dur = 700 / engine.speed;
      (function stepFn(now) {
        if (dot !== d) return;
        var k = Math.min(1, (now - t0) / dur), p = st.path.getPointAtLength(len * k);
        d.setAttribute('cx', p.x); d.setAttribute('cy', p.y);
        if (k < 1) root.requestAnimationFrame(stepFn); else setTimeout(function () { if (dot === d) { d.remove(); dot = null; } }, 250);
      })(t0);
    }
    function show(i, animate) {
      idx = Math.max(-1, Math.min(steps.length - 1, i));
      clearStep();
      if (idx < 0) { fr.cap.innerHTML = 'Press <b>Play</b> or <b>Next</b> to walk through the ' + steps.length + ' steps.'; counter.textContent = 'Step 0 / ' + steps.length; fr.pz.reset(); if (dot) { dot.remove(); dot = null; } return; }
      steps.forEach(function (st, k) { if (k > idx) st.el.classList.add('lv-sdim'); else if (k === idx) st.el.classList.add('lv-scur'); });
      var st = steps[idx];
      counter.textContent = 'Step ' + (idx + 1) + ' / ' + steps.length;
      fr.cap.innerHTML = st.t === 'msg' ? '<b>' + st.cap.from + '</b> ' + (st.from === st.to ? '↻' : '→') + ' <b>' + st.cap.to + '</b>: ' + st.cap.text : 'Note: ' + st.cap.note;
      cameraTo(st);
      if (animate) travel(st);
    }
    function tick() {
      if (!playing) return;
      if (idx >= steps.length - 1) { setPlaying(false); return; }
      show(idx + 1, true);
      timer = setTimeout(tick, 1250 / engine.speed);
    }
    var playBtn = btn('▶ Play', 'Walk through the steps', function () { setPlaying(!playing); }, true);
    function setPlaying(on) {
      playing = on; clearTimeout(timer);
      playBtn.textContent = on ? '⏸ Pause' : '▶ Play';
      if (on) { if (idx >= steps.length - 1) show(-1); timer = setTimeout(tick, 150); }
    }
    fr.bar.appendChild(playBtn);
    fr.bar.appendChild(btn('⏮ Reset', 'Back to the start', function () { setPlaying(false); show(-1); }));
    fr.bar.appendChild(btn('◀ Prev', 'Previous step', function () { setPlaying(false); show(idx - 1, false); }));
    fr.bar.appendChild(btn('Next ▶', 'Next step', function () { setPlaying(false); show(idx + 1, true); }));
    var sel = h('select', { class: 'lv-select', 'aria-label': 'Speed' }, [h('option', { value: '0.5', text: '0.5×' }), h('option', { value: '1', text: '1×', selected: 'selected' }), h('option', { value: '2', text: '2×' }), h('option', { value: '4', text: '4×' })]);
    sel.addEventListener('change', function () { engine.speed = parseFloat(sel.value); });
    fr.bar.appendChild(h('label', { class: 'lv-lbl' }, ['Speed', sel]));
    fr.bar.appendChild(h('span', { class: 'lv-grow' }));
    fr.bar.appendChild(counter);
    zoomButtons(fr.bar, fr.pz);
    show(-1);
    return {
      el: fr.wrap,
      dispose: function () { playing = false; clearTimeout(timer); if (dot) dot.remove(); },
      stats: { nodes: N, edges: steps.length, steps: steps.length, clusters: 0, packets: 0, bounds: fullB }
    };
  }

  // =============================================================== TIMELINE ===
  function timelineModel(code) {
    return parse(code).then(function (d) {
      var tasks = d.db.getTasks();
      return { kind: 'timeline', tasks: tasks.map(function (t) { return { label: String(t.task || '').trim(), section: String(t.section || ''), events: (t.events || []).map(function (e) { return String(e).trim(); }) }; }) };
    });
  }
  function renderTimeline(model, dark) {
    var P = palette(dark);
    var tasks = model.tasks;
    if (!tasks.length) throw new Error('Empty timeline');
    var uid = 'lv' + (++seq);
    var cols = tasks.map(function (t) {
      var pl = wrapAll([t.label], 170, '700 13px ' + FONT);
      var ev = t.events.map(function (e) { return wrapAll(textLines(e), 190, LFONT); });
      var w = Math.max(maxW(pl, '700 13px ' + FONT) + 34, Math.max.apply(null, ev.map(function (l) { return maxW(l, LFONT) + 30; }).concat([0])), 150);
      return { t: t, pl: pl, ev: ev, w: w };
    });
    var svg = s('svg', { role: 'img', 'aria-label': 'Timeline' });
    var defs = s('defs'); addMarkers(defs, uid, P); svg.appendChild(defs);
    var layerBand = s('g'), layerAxis = s('g'), layerP = s('g'), layerN = s('g');
    [layerBand, layerAxis, layerP, layerN].forEach(function (l) { svg.appendChild(l); });
    var B = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    function grow(a, b0, c, d0) { B.x0 = Math.min(B.x0, a); B.y0 = Math.min(B.y0, b0); B.x1 = Math.max(B.x1, c); B.y1 = Math.max(B.y1, d0); }
    var hasSections = tasks.some(function (t) { return t.section; });
    var axisY = hasSections ? 96 : 56;
    var x = 30, xs = [];
    cols.forEach(function (c) { c.x = x + c.w / 2; xs.push(c.x); x += c.w + 26; });
    var axis = s('path', { d: 'M' + (xs[0] - cols[0].w / 2) + ',' + axisY + ' L' + (x - 10) + ',' + axisY, stroke: P.edge, 'stroke-width': 2, fill: 'none', 'marker-end': 'url(#' + uid + '-arrow)' });
    layerAxis.appendChild(axis);
    grow(xs[0] - cols[0].w / 2, axisY - 30, x, axisY + 30);
    var tintCycle = [dark ? { fill: '#251a45', stroke: '#b794ff' } : { fill: '#efe8ff', stroke: '#7c3aed' }, dark ? { fill: '#3a1428', stroke: '#ff7ab8' } : { fill: '#fde7f1', stroke: '#db2777' }];
    // section bands
    if (hasSections) {
      var i0 = 0, secIdx = 0;
      while (i0 < cols.length) {
        var sec = cols[i0].t.section, i1 = i0;
        while (i1 + 1 < cols.length && cols[i1 + 1].t.section === sec) i1++;
        var xa = cols[i0].x - cols[i0].w / 2, xb = cols[i1].x + cols[i1].w / 2, tt = tintCycle[secIdx++ % 2];
        layerBand.appendChild(s('rect', { x: xa, y: 14, width: xb - xa, height: 30, rx: 15, fill: tt.fill, stroke: tt.stroke, 'stroke-width': 1.3 }));
        layerBand.appendChild(s('text', { x: (xa + xb) / 2, y: 34, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, 'font-family': FONT, fill: P.text, text: sec || ' ' }));
        i0 = i1 + 1;
      }
    }
    var groups = [];
    cols.forEach(function (c, i) {
      var g = s('g', { class: 'lv-node', tabindex: 0, role: 'button', 'aria-label': c.t.label });
      var pw = c.w - 10, ph = c.pl.length * 17 + 16;
      g.appendChild(s('line', { x1: c.x, y1: axisY, x2: c.x, y2: axisY + 40, stroke: P.edge, 'stroke-width': 1.3, 'stroke-dasharray': '3 3' }));
      g.appendChild(s('rect', { class: 'lv-card', x: c.x - pw / 2, y: axisY - ph / 2, width: pw, height: ph, rx: ph / 2, fill: P.accent2, stroke: P.accent2 }));
      var t = s('text', { x: c.x, y: axisY - ph / 2 + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, 'font-family': FONT, fill: dark ? '#1a0b2e' : '#fff' });
      tspans(t, c.pl, c.x, 17); g.appendChild(t);
      var ey = axisY + 40;
      c.ev.forEach(function (lines, k) {
        var ew = c.w - 6, eh = lines.length * 16 + 22;
        var icon = I.pick(lines.join(' '), null);
        var col = k % 2 ? tintCycle[1] : tintCycle[0];
        g.appendChild(s('rect', { class: 'lv-card', x: c.x - ew / 2, y: ey, width: ew, height: eh, rx: 12, fill: P.card, stroke: col.stroke + (dark ? '88' : '77'), 'stroke-width': 1.3 }));
        var et = s('text', { x: c.x, y: ey + 22, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, 'font-family': FONT, fill: P.text });
        tspans(et, lines, c.x, 16); g.appendChild(et);
        void icon;
        ey += eh + 10;
      });
      layerN.appendChild(g);
      groups.push(g);
      grow(c.x - c.w / 2, 0, c.x + c.w / 2, ey);
    });
    if (B.y0 > 0) B.y0 = 0;
    var fr = frame(dark, svg, B);
    var engine = Engine(fr.box);
    var dotHalo = s('circle', { r: 8, class: 'lv-halo' }), dotEl = s('circle', { r: 3.8, class: 'lv-packet' });
    layerP.appendChild(dotHalo); layerP.appendChild(dotEl);
    engine.add({ path: axis, el: dotEl, halo: dotHalo, speed: 90, loop: true, gap: 60, d: 0 });
    var token = 0, replaying = false;
    fr.cap.innerHTML = 'Press <b>Replay</b> to walk along the timeline.';
    var replayBtn = btn('▶ Replay', 'Walk along the timeline', function () {
      if (replaying) return;
      replaying = true; replayBtn.disabled = true;
      var my = ++token;
      groups.forEach(function (g, i) {
        setTimeout(function () {
          if (my !== token) return;
          g.classList.remove('lv-pulse'); void g.getBoundingClientRect(); g.classList.add('lv-pulse');
          fr.cap.innerHTML = '<b>' + cols[i].t.label + '</b>' + (cols[i].t.events.length ? ' · ' + cols[i].t.events.join(' · ') : '');
          fr.pz.to({ x: Math.max(fr.base.x, Math.min(fr.base.x + fr.base.w - Math.min(fr.base.w, 900), cols[i].x - 450)), y: fr.base.y, w: Math.min(fr.base.w, 900), h: fr.base.h * Math.min(1, 900 / fr.base.w) }, 400);
          if (i === groups.length - 1) setTimeout(function () { if (my === token) { replaying = false; replayBtn.disabled = false; fr.pz.reset(); } }, 1100);
        }, i * 1100);
      });
    }, true);
    fr.bar.appendChild(replayBtn);
    var setMotion = motionToggle(fr.bar, engine);
    speedControl(fr.bar, engine);
    fr.bar.appendChild(h('span', { class: 'lv-grow' }));
    zoomButtons(fr.bar, fr.pz);
    setMotion(!REDUCED);
    return { el: fr.wrap, dispose: function () { token++; engine.stop(); engine.clear(); }, stats: { nodes: cols.length, edges: 0, clusters: 0, packets: 1, bounds: B } };
  }

  // ================================================================ QUADRANT ===
  function quadrantModel(code) {
    return parse(code).then(function (d) { return { kind: 'quadrant', data: d.db.getQuadrantData() }; });
  }
  function renderQuadrant(model, dark) {
    var P = palette(dark);
    var q = model.data;
    if (!q || !q.quadrants || !q.quadrants.length) throw new Error('No quadrant data');
    var x0 = Math.min.apply(null, q.quadrants.map(function (r) { return r.x; })), y0 = Math.min.apply(null, q.quadrants.map(function (r) { return r.y; }));
    var x1 = Math.max.apply(null, q.quadrants.map(function (r) { return r.x + r.width; })), y1 = Math.max.apply(null, q.quadrants.map(function (r) { return r.y + r.height; }));
    var W = x1 - x0, H = y1 - y0;
    var S = 1.25;                       // draw scale
    var ox = 70, oy = 70;
    function X(v) { return ox + (v - x0) * S; }
    function Y(v) { return oy + (v - y0) * S; }
    var svg = s('svg', { role: 'img', 'aria-label': (q.title && q.title.text) || 'Quadrant chart' });
    var layerA = s('g'), layerPts = s('g');
    svg.appendChild(layerA); svg.appendChild(layerPts);
    var tints = [dark ? { fill: '#251a45', stroke: '#b794ff' } : { fill: '#f1eaff', stroke: '#7c3aed' }, dark ? { fill: '#3a1428', stroke: '#ff7ab8' } : { fill: '#fde9f3', stroke: '#db2777' }];
    // quadrants: Mermaid orders them top-right, top-left, bottom-left, bottom-right
    var qNames = [];
    q.quadrants.forEach(function (r, i) {
      var t = (i === 0 || i === 2) ? tints[0] : tints[1];
      layerA.appendChild(s('rect', { x: X(r.x) + 2, y: Y(r.y) + 2, width: r.width * S - 4, height: r.height * S - 4, rx: 16, fill: t.fill, 'fill-opacity': dark ? 0.7 : 0.8, stroke: t.stroke, 'stroke-opacity': 0.5, 'stroke-width': 1.2 }));
      var txt = String((r.text && r.text.text) || '');
      qNames.push(txt);
      layerA.appendChild(s('text', { x: X(r.x) + r.width * S / 2, y: Y(r.y) + 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, 'font-family': FONT, fill: P.text, 'fill-opacity': 0.85, text: txt }));
    });
    (q.axisLabels || []).forEach(function (a) {
      var t = s('text', { x: X(a.x), y: Y(a.y), 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, 'font-family': FONT, fill: P.sub, text: String(a.text || '') });
      if (a.rotation) t.setAttribute('transform', 'rotate(' + a.rotation + ' ' + X(a.x) + ' ' + Y(a.y) + ')');
      layerA.appendChild(t);
    });
    if (q.title && q.title.text) layerA.appendChild(s('text', { x: ox + W * S / 2, y: 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, 'font-family': FONT, fill: P.text, text: String(q.title.text) }));
    var pts = [];
    (q.points || []).forEach(function (p, i) {
      var cx = X(p.x), cy = Y(p.y);
      var g = s('g', { class: 'lv-node lv-pt', tabindex: 0, role: 'button', 'aria-label': String(p.text && p.text.text) });
      var ring = s('circle', { class: 'lv-ring', cx: cx, cy: cy, r: 6, style: 'animation-delay:' + (i * 0.37) + 's' });
      g.appendChild(ring);
      g.appendChild(s('circle', { class: 'lv-dotpt lv-card', cx: cx, cy: cy, r: 7, fill: i % 2 ? P.accent2 : P.accent, stroke: P.card, 'stroke-width': 2 }));
      var label = String((p.text && p.text.text) || '');
      var tx = s('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, 'font-family': FONT, fill: P.text, text: label });
      g.appendChild(tx);
      layerPts.appendChild(g);
      pts.push({ g: g, label: label, x: p.x, y: p.y });
    });
    var B = { x0: 0, y0: 0, x1: ox + W * S + 70, y1: oy + H * S + 70 };
    var fr = frame(dark, svg, B);
    function quadrantOf(p) {
      var mx = x0 + W / 2, my = y0 + H / 2;
      var right = p.x >= mx, top = p.y < my;
      return qNames[top ? (right ? 0 : 1) : (right ? 3 : 2)] || '';
    }
    var token = 0;
    fr.cap.innerHTML = 'Hover or tab to a point, or press <b>Replay</b>.';
    pts.forEach(function (p) {
      var on = function () { p.g.classList.add('lv-on'); fr.cap.innerHTML = '<b>' + p.label + '</b> · ' + quadrantOf(p); };
      var off = function () { p.g.classList.remove('lv-on'); fr.cap.innerHTML = 'Hover or tab to a point, or press <b>Replay</b>.'; };
      p.g.addEventListener('mouseenter', on); p.g.addEventListener('mouseleave', off); p.g.addEventListener('focus', on); p.g.addEventListener('blur', off);
    });
    var rb = btn('▶ Replay', 'Visit each point', function () {
      var my = ++token;
      pts.forEach(function (p, i) {
        setTimeout(function () {
          if (my !== token) return;
          pts.forEach(function (o) { o.g.classList.remove('lv-on'); });
          p.g.classList.add('lv-on'); fr.cap.innerHTML = '<b>' + p.label + '</b> · ' + quadrantOf(p);
        }, i * 900);
      });
      setTimeout(function () { if (my === token) { pts.forEach(function (o) { o.g.classList.remove('lv-on'); }); } }, pts.length * 900 + 600);
    }, true);
    fr.bar.appendChild(rb);
    fr.bar.appendChild(h('span', { class: 'lv-grow' }));
    zoomButtons(fr.bar, fr.pz);
    return { el: fr.wrap, dispose: function () { token++; }, stats: { nodes: pts.length, edges: 0, clusters: 4, packets: 0, bounds: B } };
  }

  // ================================================================ XY CHART ===
  function xyModel(code) {
    return parse(code).then(function (d) { return { kind: 'xychart', data: d.db.getXYChartData() }; });
  }
  function niceTicks(min, max) {
    var span = max - min || 1, raw = span / 5, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
    var step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow, out = [];
    for (var v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  function renderXY(model, dark) {
    var P = palette(dark);
    var d = model.data;
    if (!d || !d.plots || !d.plots.length) throw new Error('No chart data');
    var cats = d.xAxis && d.xAxis.categories ? d.xAxis.categories.map(String) : null;
    var first = d.plots[0].data;
    if (!cats) cats = first.map(function (p) { return String(p[0]); });
    var yMin = d.yAxis && d.yAxis.min != null ? +d.yAxis.min : 0;
    var yMax = d.yAxis && d.yAxis.max != null ? +d.yAxis.max : Math.max.apply(null, [].concat.apply([], d.plots.map(function (p) { return p.data.map(function (v) { return +v[1]; }); })));
    var ticks = niceTicks(yMin, yMax);
    yMax = Math.max(yMax, ticks[ticks.length - 1]);
    var W = Math.max(520, cats.length * 70 + 120), H = 300, L = 70, Rm = 24, Tp = d.title ? 56 : 28, Bt = 56;
    var cw = W - L - Rm, ch = H - Tp - Bt;
    function xAt(i) { return L + cw * (i + 0.5) / cats.length; }
    function yAt(v) { return Tp + ch - (v - yMin) / (yMax - yMin || 1) * ch; }
    var svg = s('svg', { role: 'img', 'aria-label': d.title || 'Chart' });
    var layerG = s('g'), layerD = s('g');
    svg.appendChild(layerG); svg.appendChild(layerD);
    if (d.title) layerG.appendChild(s('text', { x: W / 2, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, 'font-family': FONT, fill: P.text, text: d.title }));
    ticks.forEach(function (v) {
      layerG.appendChild(s('line', { x1: L, y1: yAt(v), x2: W - Rm, y2: yAt(v), stroke: P.cardLine, 'stroke-width': 1 }));
      layerG.appendChild(s('text', { x: L - 10, y: yAt(v) + 4, 'text-anchor': 'end', 'font-size': 11.5, 'font-family': MONO, fill: P.sub, text: String(v) }));
    });
    cats.forEach(function (c, i) { layerG.appendChild(s('text', { x: xAt(i), y: H - Bt + 22, 'text-anchor': 'middle', 'font-size': 11.5, 'font-family': FONT, fill: P.sub, text: c })); });
    if (d.yAxis && d.yAxis.title) { var yt = s('text', { x: 18, y: Tp + ch / 2, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, 'font-family': FONT, fill: P.sub, text: d.yAxis.title }); yt.setAttribute('transform', 'rotate(-90 18 ' + (Tp + ch / 2) + ')'); layerG.appendChild(yt); }
    if (d.xAxis && d.xAxis.title) layerG.appendChild(s('text', { x: L + cw / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, 'font-family': FONT, fill: P.sub, text: d.xAxis.title }));
    var bw = Math.min(46, cw / cats.length * 0.6);
    var anim = [];
    var tips = [];
    d.plots.forEach(function (p, pi) {
      var col = pi % 2 ? P.accent : P.accent2;
      if (p.type === 'bar') {
        p.data.forEach(function (v, i) {
          var idx = p.data.length === cats.length ? i : cats.indexOf(String(v[0])); if (idx < 0) idx = i;
          var top = yAt(+v[1]);
          var r = s('rect', { class: 'lv-grow-bar', x: xAt(idx) - bw / 2, y: top, width: bw, height: Math.max(0, yAt(yMin) - top), rx: 6, fill: col, 'fill-opacity': 0.85 });
          layerD.appendChild(r); anim.push({ el: r, cls: 'lv-grow-bar' }); tips.push({ x: xAt(idx), y: top, t: v[0] + ': ' + v[1] });
        });
      } else {
        var pts = p.data.map(function (v, i) { var idx = p.data.length === cats.length ? i : cats.indexOf(String(v[0])); if (idx < 0) idx = i; return { x: xAt(idx), y: yAt(+v[1]), t: v[0] + ': ' + v[1] }; });
        var dd = pts.map(function (q2, i) { return (i ? 'L' : 'M') + q2.x + ',' + q2.y; }).join(' ');
        var len = 0; pts.forEach(function (q2, i) { if (i) len += Math.hypot(q2.x - pts[i - 1].x, q2.y - pts[i - 1].y); });
        var path = s('path', { class: 'lv-draw', d: dd, fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': len, style: '--len:' + len });
        layerD.appendChild(path); anim.push({ el: path, cls: 'lv-draw' });
        pts.forEach(function (q2) { layerD.appendChild(s('circle', { cx: q2.x, cy: q2.y, r: 4.5, fill: P.card, stroke: col, 'stroke-width': 2.4 })); tips.push(q2); });
      }
    });
    var B = { x0: 0, y0: 0, x1: W, y1: H };
    var fr = frame(dark, svg, B);
    fr.cap.innerHTML = 'Press <b>Replay</b> to draw the chart again.';
    var rb = btn('▶ Replay', 'Draw the chart again', function () {
      anim.forEach(function (a) { a.el.classList.remove(a.cls); void a.el.getBoundingClientRect(); a.el.classList.add(a.cls); });
    }, true);
    fr.bar.appendChild(rb);
    fr.bar.appendChild(h('span', { class: 'lv-grow' }));
    zoomButtons(fr.bar, fr.pz);
    return { el: fr.wrap, dispose: function () {}, stats: { nodes: tips.length, edges: 0, clusters: 0, packets: 0, bounds: B } };
  }

  // ========================================================== public interface ===
  function kindOf(code) {
    var c = String(code || '').replace(/^\s*---[\s\S]*?---\s*\n/, '').split('\n').filter(function (l) { var t = l.trim(); return t && t.indexOf('%%') !== 0; });
    var first = (c[0] || '').trim().split(/[\s{]/)[0];
    if (/^(graph|flowchart|flowchart-elk)$/.test(first)) return 'flow';
    if (/^stateDiagram(-v2)?$/.test(first)) return 'state';
    if (/^classDiagram(-v2)?$/.test(first)) return 'class';
    if (first === 'sequenceDiagram') return 'sequence';
    if (first === 'erDiagram') return 'er';
    if (first === 'mindmap') return 'mindmap';
    if (first === 'timeline') return 'timeline';
    if (first === 'quadrantChart') return 'quadrant';
    if (/^xychart(-beta)?$/.test(first)) return 'xychart';
    return null;
  }

  function fontsReady() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var p = Promise.all([doc.fonts.load('600 12.5px Manrope'), doc.fonts.load('700 13px Manrope')]).catch(function () {});
    return Promise.race([p, new Promise(function (res) { setTimeout(res, 700); })]);
  }

  function render(code, opts) {
    var kind = kindOf(code);
    if (!kind) return Promise.reject(new Error('Unsupported diagram type'));
    if (!root.dagre && kind !== 'sequence' && kind !== 'timeline' && kind !== 'quadrant' && kind !== 'xychart') return Promise.reject(new Error('Layout library unavailable'));
    injectCss();
    var dark = isDark(opts);
    return fontsReady().then(function () {
      var build;
      if (kind === 'flow') build = flowScene(code, dark).then(function (sc) { return renderScene(sc, dark); });
      else if (kind === 'state') build = stateScene(code, dark).then(function (sc) { return renderScene(sc, dark); });
      else if (kind === 'class') build = classScene(code, dark).then(function (sc) { return renderScene(sc, dark); });
      else if (kind === 'er') build = erScene(code, dark).then(function (sc) { return renderScene(sc, dark); });
      else if (kind === 'mindmap') build = mindmapScene(code, dark).then(function (sc) { return renderScene(sc, dark); });
      else if (kind === 'sequence') build = sequenceModel(code).then(function (m) { return renderSequence(m, dark); });
      else if (kind === 'timeline') build = timelineModel(code).then(function (m) { return renderTimeline(m, dark); });
      else if (kind === 'quadrant') build = quadrantModel(code).then(function (m) { return renderQuadrant(m, dark); });
      else build = xyModel(code).then(function (m) { return renderXY(m, dark); });
      return build.then(function (r) {
        var bad = /\s(?:d|x|y|cx|cy|x1|x2|y1|y2|width|height|transform|viewBox|r|rx|points)="[^"]*(?:NaN|undefined|Infinity)[^"]*"/.exec(r.el.innerHTML);
        if (bad) throw new Error('Drawing produced invalid geometry: ' + bad[0].slice(0, 80));
        r.kind = kind;
        return r;
      });
    });
  }

  root.TPLiving = { render: render, kindOf: kindOf, supports: function (c) { return !!kindOf(c); } };
})(window);
