/* eslint-disable */
/**
 * Tech Primer — Chapter Mind Map (renderer)
 *
 * Render-only. The heading tree for every chapter is precomputed at build
 * time by scripts/build-mindmaps.mjs and shipped as mindmaps.js, which
 * declares window.AllWebMindMapData. This file just looks up the tree by
 * (sectionId, chapterId), paints colours onto branches, lays them out,
 * and renders the result as HTML pills with an SVG connector layer
 * underneath.
 *
 * Why split into precompute + render:
 *   - The previous version walked .md-content after every chapter load and
 *     reconstructed the tree from the post-`enhanceContent` DOM. That
 *     coupled the recap to incidental DOM shapes (.def-term, .sub-section)
 *     and re-did the same parse on every navigation.
 *   - With the tree precomputed, mindmap.js stays small, deterministic,
 *     and trivially fast — the only runtime work is layout + DOM.
 *
 * Usage from app.js:
 *
 *     var card = window.AllWebMindMap.create({
 *       sectionId:    sectionId,
 *       chapterId:    chapter.id,
 *       chapterTitle: chapter.title  // fallback if data is missing
 *     });
 *     if (card) glassWrap.parentNode.insertBefore(card, glassWrap.nextSibling);
 *
 * Returns null when no precomputed tree exists for the chapter (either
 * mindmaps.js hasn't loaded yet, the chapter was too sparse for a recap,
 * or the chapter's markdown source isn't statically resolvable — see
 * the build script for which kinds get skipped).
 */
(function () {
  'use strict';

  // ===================== Palette =====================
  // Eight perceptually-distinct hues, cycled across h2 branches. Using HSL
  // (rather than fixed hex) lets the CSS layer derive lighter / darker shades
  // via color-mix() so the same swatch works for the pill border, fill, and
  // SVG connector without us hand-tuning each variant.
  var BRANCH_PALETTE = [
    'hsl(38, 78%, 50%)',   // gold (matches --accent)
    'hsl(0, 70%, 56%)',    // red
    'hsl(205, 72%, 50%)',  // blue
    'hsl(145, 55%, 42%)',  // green
    'hsl(280, 58%, 58%)',  // purple
    'hsl(22, 82%, 52%)',   // orange
    'hsl(176, 60%, 40%)',  // teal
    'hsl(322, 58%, 56%)'   // pink
  ];

  // ===================== Layout constants =====================
  // All values in CSS pixels. Nodes are measured from their actual label text
  // before layout, then wrapped inside a bounded width. This keeps every label
  // visible without spilling or using ellipses, while preventing a single long
  // sentence from turning the whole diagram into one enormous row.
  var NODE_SPECS = {
    root: { minW: 210, maxW: 340, minH: 58, padX: 28, padY: 16, lineH: 18, charPx: 8.2 },
    branch: { minW: 190, maxW: 330, minH: 42, padX: 26, padY: 14, lineH: 17, charPx: 7.5 },
    sub: { minW: 172, maxW: 300, minH: 38, padX: 24, padY: 14, lineH: 16, charPx: 7.0 },
    summary: { minW: 190, maxW: 340, minH: 36, padX: 24, padY: 12, lineH: 15, charPx: 6.7 },
    leaf: { minW: 160, maxW: 300, minH: 36, padX: 24, padY: 12, lineH: 15, charPx: 6.5 }
  };
  var COLUMN_GAP = 36;   // horizontal gap between depth columns
  var ROW_GAP = 10;   // vertical gap between sibling rows
  var CANVAS_PADDING_X = 20;
  var CANVAS_PADDING_Y = 18;

  // ===================== DOM helpers =====================
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
        else if (k === 'on') Object.keys(attrs[k]).forEach(function (ev) { node.addEventListener(ev, attrs[k][ev]); });
        else if (k === 'data') Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function labelFor(node) {
    return String(node.title == null ? '' : node.title).replace(/\s+/g, ' ').trim();
  }

  // ===================== Tree hydration =====================
  // The precomputed file emits plain JSON-ish nodes. We deep-clone so we
  // can attach layout fields (depth/x/y/width/height/color) without ever
  // mutating the shared window.AllWebMindMapData (the same chapter could
  // theoretically be re-rendered across navigations).
  function cloneTree(node) {
    return {
      kind: node.kind,
      title: node.title,
      hLevel: node.hLevel,
      children: (node.children || []).map(cloneTree)
    };
  }

  // ===================== Colour assignment =====================
  // Root takes the brand accent; every h2 branch picks the next palette colour
  // and propagates it to all descendants. This is what gives the recap its
  // visual grouping — the eye picks up each colour-band immediately even when
  // the branches are physically far apart in the diagram.
  function assignColors(root) {
    root.color = 'var(--accent)';
    (root.children || []).forEach(function (branch, idx) {
      var color = BRANCH_PALETTE[idx % BRANCH_PALETTE.length];
      (function paint(n) {
        n.color = color;
        (n.children || []).forEach(paint);
      })(branch);
    });
  }

  // ===================== Layout (horizontal tree) =====================
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function wrapLines(text, charsPerLine) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    var lines = [];
    var current = '';
    words.forEach(function (word) {
      var len = word.length;
      if (len > charsPerLine) {
        if (current) { lines.push(current); current = ''; }
        for (var i = 0; i < word.length; i += charsPerLine) {
          lines.push(word.slice(i, i + charsPerLine));
        }
        return;
      }
      if (!current) {
        current = word;
      } else if (current.length + 1 + len <= charsPerLine) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function wrapLineCount(text, charsPerLine) {
    return wrapLines(text, charsPerLine).length;
  }

  function measureNode(node) {
    var spec = NODE_SPECS[node.kind] || NODE_SPECS.sub;
    var text = labelFor(node);
    var naturalW = Math.ceil(text.length * spec.charPx + spec.padX);
    var width = clamp(naturalW, spec.minW, spec.maxW);
    var charsPerLine = Math.max(8, Math.floor((width - spec.padX) / spec.charPx));
    var lines = wrapLineCount(text, charsPerLine);
    return {
      width: width,
      height: Math.max(spec.minH, Math.ceil(lines * spec.lineH + spec.padY))
    };
  }

  function prepareTree(opts) {
    opts = opts || {};
    var entry = getPrecomputedTree(opts.sectionId, opts.chapterId);
    if (!entry) return null;
    var tree = cloneTree(entry.root);
    tree.title = opts.chapterTitle || entry.title || tree.title;
    assignColors(tree);
    var bounds = computeLayout(tree);
    return { tree: tree, bounds: bounds };
  }

  // Classic top-down recursion: first measure every node from its label text,
  // assign x by depth using the widest node in each column, then assign y by
  // walking leaves in document order and centring each parent on its first/last
  // child. Since every node's height is known up front, wrapped labels don't
  // overlap their neighbours.
  function computeLayout(root) {
    var maxWidthByDepth = [];
    var maxDepth = 0;

    function measureAll(node, depth) {
      var measured = measureNode(node);
      node.depth = depth;
      node.width = measured.width;
      node.height = measured.height;
      maxWidthByDepth[depth] = Math.max(maxWidthByDepth[depth] || 0, node.width);
      if (depth > maxDepth) maxDepth = depth;
      (node.children || []).forEach(function (c) { measureAll(c, depth + 1); });
    }
    measureAll(root, 0);

    var xByDepth = [0];
    for (var d = 1; d <= maxDepth; d++) {
      xByDepth[d] = xByDepth[d - 1] + maxWidthByDepth[d - 1] + COLUMN_GAP;
    }

    var nextLeafY = 0;

    function walk(node) {
      node.x = xByDepth[node.depth] || 0;
      if (!node.children || !node.children.length) {
        node.y = nextLeafY;
        nextLeafY += node.height + ROW_GAP;
        return;
      }
      node.children.forEach(walk);
      var first = node.children[0];
      var last = node.children[node.children.length - 1];
      // Centre this node on the vertical span of its children. Using
      // first.y .. (last.y + last.height) means the parent's vertical centre
      // matches the children's collective vertical centre, even when the
      // children themselves have different heights.
      node.y = (first.y + last.y + last.height - node.height) / 2;
    }
    walk(root);

    var maxX = 0, maxY = 0;
    (function bounds(n) {
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
      (n.children || []).forEach(bounds);
    })(root);

    return {
      width: maxX + CANVAS_PADDING_X * 2,
      height: maxY + CANVAS_PADDING_Y * 2,
      offsetX: CANVAS_PADDING_X,
      offsetY: CANVAS_PADDING_Y
    };
  }

  // ===================== SVG connector =====================
  // Cubic bezier from parent's right-edge midpoint to child's left-edge
  // midpoint, with horizontal control points. The result is a smooth
  // S-curve that reads as a clear "this belongs to that" connection.
  function connectorPath(parent, child) {
    var startX = parent.x + parent.width;
    var startY = parent.y + parent.height / 2;
    var endX = child.x;
    var endY = child.y + child.height / 2;
    var midX = (startX + endX) / 2;
    return 'M' + startX + ' ' + startY +
      ' C' + midX + ' ' + startY +
      ', ' + midX + ' ' + endY +
      ', ' + endX + ' ' + endY;
  }

  // ===================== Render =====================
  function renderTree(root, bounds) {
    var canvas = el('div', {
      class: 'cmm-canvas',
      style: {
        position: 'relative',
        width: bounds.width + 'px',
        height: bounds.height + 'px'
      }
    });

    // Edges are an absolutely-positioned SVG layer underneath the nodes.
    // pointer-events:none in CSS lets pill clicks pass through cleanly.
    var edgesSvg = svgEl('svg', {
      class: 'cmm-edges',
      width: bounds.width,
      height: bounds.height,
      viewBox: '0 0 ' + bounds.width + ' ' + bounds.height
    });
    canvas.appendChild(edgesSvg);

    var nodesLayer = el('div', { class: 'cmm-nodes' });
    canvas.appendChild(nodesLayer);

    function paint(node) {
      // Translate logical coords into canvas-relative pixels.
      var renderedX = node.x + bounds.offsetX;
      var renderedY = node.y + bounds.offsetY;

      // Draw connectors first so they sit visually behind the pills.
      (node.children || []).forEach(function (child) {
        var p = { x: renderedX, y: renderedY, width: node.width, height: node.height };
        var c = {
          x: child.x + bounds.offsetX,
          y: child.y + bounds.offsetY,
          width: child.width,
          height: child.height
        };
        edgesSvg.appendChild(svgEl('path', {
          class: 'cmm-edge',
          d: connectorPath(p, c),
          stroke: child.color,
          'stroke-width': '2',
          fill: 'none'
        }));
        paint(child);
      });

      // Pill itself. We use HTML (not SVG <foreignObject> or SVG <text>) so
      // the existing CSS variables, font stack, and theme switching all just
      // work without extra plumbing.
      var pill = el('div', {
        class: 'cmm-node cmm-node--' + node.kind,
        style: {
          left: renderedX + 'px',
          top: renderedY + 'px',
          width: node.width + 'px',
          height: node.height + 'px'
        },
        title: node.title
      }, [el('span', { class: 'cmm-label', text: labelFor(node) })]);
      pill.style.setProperty('--cmm-color', node.color);
      nodesLayer.appendChild(pill);
    }
    paint(root);

    return canvas;
  }

  // ===================== Standalone SVG export =====================
  function escapeXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function svgNodeStyle(node) {
    if (node.kind === 'root') {
      return { fill: 'url(#cmmRootGradient)', stroke: '#b09828', text: '#ffffff', fontSize: 15, weight: 700 };
    }
    if (node.kind === 'branch') {
      return { fill: node.color, opacity: 0.22, stroke: node.color, text: '#1c1610', fontSize: 13, weight: 700 };
    }
    if (node.kind === 'leaf') {
      return { fill: node.color, opacity: 0.09, stroke: node.color, text: '#1c1610', fontSize: 11, weight: 400 };
    }
    if (node.kind === 'summary') {
      return { fill: node.color, opacity: 0.07, stroke: node.color, text: '#3f362b', fontSize: 11, weight: 500 };
    }
    return { fill: node.color, opacity: 0.14, stroke: node.color, text: '#1c1610', fontSize: 12, weight: 500 };
  }

  function renderSvgText(node, x, y, style) {
    var spec = NODE_SPECS[node.kind] || NODE_SPECS.sub;
    var charsPerLine = Math.max(8, Math.floor((node.width - spec.padX) / spec.charPx));
    var lines = wrapLines(labelFor(node), charsPerLine);
    var lineHeight = spec.lineH;
    var startY = y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    var out = '<text x="' + (x + node.width / 2) + '" y="' + startY + '" ' +
      'text-anchor="middle" dominant-baseline="middle" ' +
      'font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" ' +
      'font-size="' + style.fontSize + '" font-weight="' + style.weight + '" fill="' + style.text + '">';
    lines.forEach(function (line, idx) {
      out += '<tspan x="' + (x + node.width / 2) + '" dy="' + (idx === 0 ? 0 : lineHeight) + '">' + escapeXml(line) + '</tspan>';
    });
    return out + '</text>';
  }

  function toSvg(opts) {
    var prepared = prepareTree(opts);
    if (!prepared) return null;
    var tree = prepared.tree;
    var bounds = prepared.bounds;
    var parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + bounds.width + '" height="' + bounds.height + '" viewBox="0 0 ' + bounds.width + ' ' + bounds.height + '">',
      '<defs>',
      '<linearGradient id="cmmRootGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#b09828"/><stop offset="100%" stop-color="#ce6700"/></linearGradient>',
      '<filter id="cmmShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.16"/></filter>',
      '</defs>',
      '<rect width="100%" height="100%" fill="#f8f1e9"/>'
    ];

    (function drawEdges(node) {
      var renderedX = node.x + bounds.offsetX;
      var renderedY = node.y + bounds.offsetY;
      (node.children || []).forEach(function (child) {
        var p = { x: renderedX, y: renderedY, width: node.width, height: node.height };
        var c = {
          x: child.x + bounds.offsetX,
          y: child.y + bounds.offsetY,
          width: child.width,
          height: child.height
        };
        parts.push('<path d="' + connectorPath(p, c) + '" stroke="' + escapeXml(child.color) + '" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.62"/>');
        drawEdges(child);
      });
    })(tree);

    (function drawNodes(node) {
      var x = node.x + bounds.offsetX;
      var y = node.y + bounds.offsetY;
      var style = svgNodeStyle(node);
      parts.push(
        '<rect x="' + x + '" y="' + y + '" width="' + node.width + '" height="' + node.height + '" rx="18" ry="18" ' +
        'fill="' + escapeXml(style.fill) + '" ' + (style.opacity ? 'fill-opacity="' + style.opacity + '" ' : '') +
        'stroke="' + escapeXml(style.stroke) + '" stroke-width="1.5" filter="url(#cmmShadow)"/>'
      );
      parts.push(renderSvgText(node, x, y, style));
      (node.children || []).forEach(drawNodes);
    })(tree);

    parts.push('</svg>');
    return parts.join('\n');
  }

  // ===================== Lookup =====================
  // Composite key matches the build script (mirrors app.js's chKey()).
  // Chapter IDs alone are not unique — see the comment in mindmaps.js.
  function getPrecomputedTree(sectionId, chapterId) {
    var data = window.AllWebMindMapData;
    if (!data || !data.chapters || !sectionId || !chapterId) return null;
    var entry = data.chapters[sectionId + '/' + chapterId];
    if (!entry || !entry.root) return null;
    return entry;
  }

  // ===================== Checksum drift warning =====================
  // FNV-1a 32-bit hex. Mirrors the algorithm in scripts/build-mindmaps.mjs
  // exactly so a runtime-side recompute over the loaded CONTENT array
  // produces the same hash for the same content. Mismatch => mindmaps.js
  // is stale relative to content.js; the recap may show old labels for
  // freshly-edited chapters.
  function fnv1a32Hex(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // Same chapter -> markdown resolution the build script uses, in the
  // same order, so the row strings hash to the same value.
  function resolveChapterMarkdown(chapter) {
    if (typeof chapter.content === 'string' && chapter.content.length) return chapter.content;
    if (chapter.contentVar === 'DESIGN_PATTERN_SECTIONS' && chapter.contentSection) {
      var dps = window.DESIGN_PATTERN_SECTIONS;
      if (dps && typeof dps[chapter.contentSection] === 'string') return dps[chapter.contentSection];
    }
    return null;
  }

  function computeChecksum(content) {
    if (!Array.isArray(content)) return null;
    var rows = [];
    content.forEach(function (section) {
      (section.chapters || []).forEach(function (ch) {
        var md = resolveChapterMarkdown(ch) || '';
        var head = md.slice(0, 64).replace(/\s+/g, ' ');
        // app.js has already normalised ch.id by the time we run, so
        // ch.id here is the same form the build script's normaliser
        // produced.
        rows.push(section.id + '|' + ch.id + '|' + md.length + '|' + head);
      });
    });
    rows.sort();
    return fnv1a32Hex(rows.join('\n'));
  }

  var checksumWarned = false;

  function verifyChecksum(content) {
    if (checksumWarned) return; // only warn once per page load
    var data = window.AllWebMindMapData;
    if (!data || !data.checksum) return;
    var actual = computeChecksum(content);
    if (!actual) return;
    if (actual !== data.checksum) {
      checksumWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[mindmap] mindmaps.js looks stale — content.js has changed since it ' +
        'was generated.  Run `npm run build:mindmaps` to regenerate.\n' +
        '  expected (in mindmaps.js): ' + data.checksum + '\n' +
        '  actual   (from content.js): ' + actual
      );
    }
  }

  // ===================== Public API =====================
  window.AllWebMindMap = {
    /**
     * Build a chapter recap card from the precomputed tree.
     *
     * @param {Object}  opts
     * @param {string}  opts.sectionId     Section the chapter lives in.
     * @param {string}  opts.chapterId     Post-normalisation chapter id.
     *                                     Together with sectionId, used to
     *                                     look up the tree in
     *                                     window.AllWebMindMapData.chapters.
     * @param {string} [opts.chapterTitle] Fallback root label if the
     *                                     precomputed entry is missing a
     *                                     title (shouldn't happen, but cheap
     *                                     to be defensive).
     * @returns {HTMLElement|null}         An unattached <div.chapter-mindmap-card>,
     *                                     or null if there's nothing to draw.
     */
    create: function (opts) {
      var prepared = prepareTree(opts);
      if (!prepared) return null;
      var tree = prepared.tree;
      var bounds = prepared.bounds;

      var card = el('div', { class: 'chapter-mindmap-card' });
      card.appendChild(el('div', { class: 'chapter-mindmap-header' }, [
        el('span', { class: 'chapter-mindmap-eyebrow', text: 'Chapter Mind Map' }),
        el('span', { class: 'chapter-mindmap-hint', text: 'A colour-coded recap — each branch shows everything you just read about that topic.' })
      ]));
      var container = el('div', { class: 'chapter-mindmap-container' });
      container.appendChild(renderTree(tree, bounds));
      card.appendChild(container);
      return card;
    },

    has: function (opts) {
      opts = opts || {};
      return !!getPrecomputedTree(opts.sectionId, opts.chapterId);
    },

    toSvg: toSvg,

    /**
     * Cross-check the precomputed checksum against the loaded CONTENT.
     * Logs a single console.warn on drift; never throws.
     */
    verifyChecksum: verifyChecksum
  };
})();
