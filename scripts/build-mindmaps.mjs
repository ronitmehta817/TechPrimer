#!/usr/bin/env node
// Precompute per-chapter mind-map trees from content.js, write mindmaps.js.
//
// Why this exists:
//   The runtime renderer in mindmap.js used to walk the post-`enhanceContent`
//   DOM after every chapter load to build the recap tree. That made the
//   recap (a) slow to render on big chapters, (b) coupled to the exact
//   shape `enhanceContent` produces (.def-term, .sub-section, etc.), and
//   (c) opaque — you couldn't see the tree without opening the page.
//
//   This script precomputes the tree at build time straight from the
//   markdown source and writes a single mindmaps.js the runtime can
//   consume. The runtime then only has to render.
//
// What it does:
//   1. vm-loads content.js into a sandbox (no module wrapping needed)
//      and pulls out CONTENT + DESIGN_PATTERN_SECTIONS.
//   2. For each chapter, resolves its markdown:
//        - chapter.content                                          (inline)
//        - chapter.contentVar === 'DESIGN_PATTERN_SECTIONS'          (lookup)
//        - chapter.contentFile                                       (skip)
//   3. Builds a heading tree (h1 root, h2 -> branch, h3/h4 -> sub) and
//      attaches paragraph one-line summaries plus up to MAX_BULLETS
//      top-level list items per heading as leaves.
//      Mirrors the runtime "sub-section synthesis" behavior so a
//      paragraph of `**Term:**` immediately followed by a list becomes a
//      synthetic h4 (kind: 'sub') with the bullets nested under it.
//   4. Computes a content checksum (FNV-1a 32-bit hex over
//      [{id, content}] sorted by id) so the runtime can warn if
//      content.js has drifted away from mindmaps.js.
//   5. Writes mindmaps.js declaring window.AllWebMindMapData.
//
// Run with:  npm run build:mindmaps
// No third-party dependencies — pure Node (vm, fs, url, path).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const ROOT          = resolve(__dirname, '..');
const CONTENT_FILE  = resolve(ROOT, 'public', 'content.js');
const OUTPUT_FILE   = resolve(ROOT, 'public', 'mindmaps.js');

// Mirror constants kept identical to mindmap.js so the renderer doesn't
// need to know about layout shape — only that "title" + "children" exist.
const MAX_LABEL_LEN = 38;
const MAX_BULLETS   = 5;
const MIN_NODES     = 4;
const BULLET_LEVEL  = 5;
const SUMMARY_LEVEL = 5;

// Domain prefixes used by app.js's normaliseChapterId. We mirror the
// behavior here so the precomputed map is keyed by exactly the same
// (sectionId, chapterId) pair the runtime ends up using after CONTENT is
// loaded. Keep this list in sync with the DOMAINS array near the top of
// app.js.
const DOMAIN_PREFIXES = ['sd-', 'ms-', 'mq-', 'dp-', 'spring-'];

function getDomainPrefix(sectionId) {
  for (let i = 0; i < DOMAIN_PREFIXES.length; i++) {
    if (sectionId.indexOf(DOMAIN_PREFIXES[i]) === 0) return DOMAIN_PREFIXES[i];
  }
  return null;
}

// Direct port of app.js normaliseChapterId(). Chapter IDs in content.js
// historically include their section prefix ("dp-creational-overview"
// inside section "dp-creational"); the runtime trims that down to just
// "overview". The (sectionId, chapterId) tuple stays unique even when
// "overview" repeats across "dp-creational", "dp-structural", etc.
function normaliseChapterId(sectionId, chapterId) {
  if (!sectionId || !chapterId) return chapterId;
  const fullPrefix = sectionId + '-';
  if (chapterId.indexOf(fullPrefix) === 0) return chapterId.slice(fullPrefix.length);
  const domainPrefix = getDomainPrefix(sectionId);
  if (domainPrefix && chapterId.indexOf(domainPrefix) === 0) return chapterId.slice(domainPrefix.length);
  return chapterId;
}

function chapterKey(sectionId, chapterId) { return sectionId + '/' + chapterId; }

// =====================================================================
// Step 1 — load content.js into a vm sandbox.
// =====================================================================
function loadContent() {
  const src = readFileSync(CONTENT_FILE, 'utf8');
  // content.js sets `window.DESIGN_PATTERN_SECTIONS` only if `window` exists,
  // and declares `var DESIGN_PATTERN_SECTIONS` + `const CONTENT` at script
  // top level. A vm script is its own scope, so we append a tiny epilogue
  // that pulls those bindings into a context-visible bag.
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(
    src + '\n;globalThis.__OUT__ = { CONTENT: typeof CONTENT !== "undefined" ? CONTENT : null, DPS: typeof DESIGN_PATTERN_SECTIONS !== "undefined" ? DESIGN_PATTERN_SECTIONS : null };',
    sandbox,
    { filename: 'content.js' },
  );
  const out = sandbox.__OUT__;
  if (!out || !Array.isArray(out.CONTENT)) {
    throw new Error('Could not load CONTENT from content.js');
  }
  return { CONTENT: out.CONTENT, DPS: out.DPS || {} };
}

// =====================================================================
// Step 2 — chapter -> markdown string.
// =====================================================================
function resolveMarkdown(chapter, dps) {
  if (typeof chapter.content === 'string' && chapter.content.length) return chapter.content;
  if (chapter.contentVar === 'DESIGN_PATTERN_SECTIONS' && chapter.contentSection) {
    const md = dps[chapter.contentSection];
    if (typeof md === 'string') return md;
  }
  // contentFile / unknown contentVar: skip. Runtime will simply find no
  // precomputed entry and silently render no recap (same as today's
  // "chapter too sparse" path).
  return null;
}

// =====================================================================
// Step 3a — strip a duplicate top-level title heading.
// Mirrors stripMatchingLeadingHeading() in app.js.
// =====================================================================
function normalizeHeadingText(s) {
  return String(s == null ? '' : s)
    .replace(/[`*_~]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[?!.,:;]+$/g, '')
    .trim()
    .toLowerCase();
}

function stripMatchingLeadingHeading(markdown, title) {
  if (!markdown || !title) return markdown;
  const lines = String(markdown).split(/\r?\n/);
  let first = 0;
  while (first < lines.length && !lines[first].trim()) first++;
  if (first >= lines.length) return markdown;
  const m = lines[first].match(/^#{1,6}\s+(.*)$/);
  if (!m) return markdown;
  if (normalizeHeadingText(m[1]) !== normalizeHeadingText(title)) return markdown;
  let next = first + 1;
  while (next < lines.length && !lines[next].trim()) next++;
  return lines.slice(next).join('\n');
}

// =====================================================================
// Step 3b — bullet key-term extraction.
// Same heuristics the old runtime used, but applied to the raw markdown
// line (which still has its emphasis markers) instead of the rendered
// DOM (which has .def-term / <strong> wrappers).
// =====================================================================
function extractBulletKeyTerm(line) {
  // Strip leading bullet marker ("- ", "* ", "+ ", "1. ", etc.).
  let text = String(line).replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim();
  if (!text) return '';

  // 1. **Term:** ... or **Term**: ... — the strongest signal.
  let m = text.match(/^\*\*([^*\n]{1,80})\*\*\s*[:.]?\s*/);
  if (m) {
    const lhs = m[1].trim().replace(/[\s:.;,—–-]+$/, '').trim();
    if (lhs && lhs.length <= 60) return lhs;
  }

  // Plain-text version for the remaining heuristics. We strip emphasis,
  // inline code, and links so things like `[Term](#foo): desc` and
  // `` `Term`: desc `` still parse cleanly.
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*?/g, '')
    .replace(/`/g, '')
    .trim();

  // 2. "Term: explanation" — colon within first 50 chars.
  const colonIdx = plain.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 50) {
    const before = plain.slice(0, colonIdx).trim();
    if (before && !/^\d+\.?$/.test(before) && before.split(/\s+/).length <= 8) {
      return before;
    }
  }

  // 3. "Term — explanation" / "Term = explanation" / "Term – explanation".
  const sep = plain.match(/^(.{1,50}?)\s+(?:=|—|–)\s+/);
  if (sep) {
    const lhs = sep[1].trim();
    if (lhs && lhs.split(/\s+/).length <= 8) return lhs;
  }

  // 4. Fallback: keep the full plain-text bullet. The runtime renderer now
  // measures and wraps nodes dynamically, so we don't need to pre-truncate
  // fallback labels with an ellipsis.
  return plain;
}

function stripInlineMarkdown(s) {
  return String(s == null ? '' : s)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links -> text
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // bold
    .replace(/__([^_]+)__/g, '$1')             // bold (alt)
    .replace(/\*([^*]+)\*/g, '$1')             // italic
    .replace(/_([^_]+)_/g, '$1')               // italic (alt)
    .trim();
}

function stripMarkdownForSummary(s) {
  return stripInlineMarkdown(s)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(s) {
  const sentences = String(s || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (clean.split(/\s+/).length >= 5) return clean;
  }
  return String(s || '').trim();
}

function oneLineParagraphSummary(paragraph) {
  const clean = stripMarkdownForSummary(paragraph);
  if (!clean) return '';
  if (clean.length < 24) return '';
  if (/^(?:---+|\*\*\*+|___+)$/.test(clean)) return '';
  if (/^diagram$/i.test(clean)) return '';

  const sentence = firstSentence(clean);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  // Keep the generated summary as one concise sentence without ellipsis.
  return words.slice(0, 22).join(' ').replace(/[,:;—–-]+$/, '').trim();
}

function oneLineFromWords(text, maxWords = 22) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
    .replace(/[,:;—–-]+$/, '')
    .trim();
}

function isGenericImageAlt(alt) {
  return !alt || /^(?:image|diagram|figure|chart|screenshot|visual)$/i.test(String(alt).trim());
}

function decodeBase64Url(s) {
  try {
    const normalised = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalised.length % 4 === 0 ? '' : '='.repeat(4 - (normalised.length % 4));
    return Buffer.from(normalised + pad, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function extractMermaidLabels(src) {
  const labels = [];
  const seen = new Set();
  function add(v) {
    const clean = stripMarkdownForSummary(v)
      .replace(/^[^\w]+|[^\w]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 3 || seen.has(clean.toLowerCase())) return;
    if (/^(graph|sequenceDiagram|flowchart|participant|style|subgraph|end)$/i.test(clean)) return;
    seen.add(clean.toLowerCase());
    labels.push(clean);
  }

  const text = String(src || '');
  let m;
  const bracket = /\[[^\]]*?["']?([^"'\]<>{}()|]{3,80})["']?[^\]]*?\]/g;
  while ((m = bracket.exec(text))) add(m[1]);
  const participant = /\b(?:participant|actor)\s+\w+\s+as\s+([^\n]+)/g;
  while ((m = participant.exec(text))) add(m[1]);
  const edgeLabel = /\|([^|]{3,80})\|/g;
  while ((m = edgeLabel.exec(text))) add(m[1]);
  return labels.slice(0, 5);
}

function summariseImageLine(line, headingTitle) {
  const md = String(line).match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/);
  const html = String(line).match(/<img\b[^>]*?(?:alt=["']([^"']*)["'])?[^>]*?(?:src=["']([^"']+)["'])?[^>]*>/i);
  const alt = stripMarkdownForSummary((md && md[1]) || (html && html[1]) || '');
  const url = (md && md[2]) || (html && html[2]) || '';

  const mermaid = String(url).match(/mermaid\.ink\/(?:svg|img|png)\/([^?#]+)/i);
  if (mermaid) {
    const decoded = decodeBase64Url(mermaid[1]);
    const labels = extractMermaidLabels(decoded);
    if (labels.length) return oneLineFromWords('Diagram showing ' + labels.join(', '), 24);
  }

  if (!isGenericImageAlt(alt)) return oneLineFromWords('Image showing ' + alt, 24);
  if (headingTitle) return oneLineFromWords('Diagram explaining ' + stripInlineMarkdown(headingTitle), 24);
  return 'Image supporting this section';
}

function parseTableRow(line) {
  return String(line)
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripMarkdownForSummary(cell).trim())
    .filter(Boolean);
}

function isTableSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function summariseTable(lines, headingTitle) {
  const rows = lines.map(parseTableRow).filter((row) => row.length);
  if (!rows.length) return headingTitle ? oneLineFromWords('Table summarizing ' + headingTitle, 22) : 'Table summarizing this section';

  const headers = rows[0];
  const dataRows = rows.slice(1).filter((row) => !isTableSeparatorRow(row));
  const firstCol = dataRows.map((row) => row[0]).filter(Boolean).slice(0, 4);
  const headerText = headers.slice(0, 5).join(', ');

  if (/^(?:feature|aspect|condition|constraint|requirement|pattern|component|type)$/i.test(headers[0] || '') && firstCol.length) {
    return oneLineFromWords('Table comparing ' + headers.slice(1, 5).join(', ') + ' by ' + firstCol.join(', '), 24);
  }
  if (firstCol.length) return oneLineFromWords('Table summarizing ' + headerText + ' for ' + firstCol.join(', '), 24);
  if (headerText) return oneLineFromWords('Table summarizing ' + headerText, 22);
  return headingTitle ? oneLineFromWords('Table summarizing ' + headingTitle, 22) : 'Table summarizing this section';
}

function titleCaseCodeWord(word) {
  if (!word) return word;
  if (/^[A-Z0-9]+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function prettifyCodeLikeLabel(s) {
  const raw = stripInlineMarkdown(s)
    .replace(/\(\s*\)$/, '')
    .trim();
  if (!raw) return raw;

  const isIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw);
  const isDelimitedIdentifier = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(raw);
  if (!isIdentifier && !isDelimitedIdentifier) return raw;

  return raw
    .replace(/^[$_]+/, '')
    .replace(/[$_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(titleCaseCodeWord)
    .join(' ');
}

function normaliseRecapTitle(s) {
  return prettifyCodeLikeLabel(s)
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:[-—–:]|\.)?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isExcludedMindmapHeading(title) {
  const t = normaliseRecapTitle(title);
  return (
    t === 'summary' ||
    t === 'quick summary' ||
    t === 'component summary' ||
    t === 'practice exercise' ||
    t === 'practice exercises' ||
    t === 'exercise' ||
    t === 'exercises'
  );
}

// =====================================================================
// Step 3c — build the heading tree from markdown.
//
// Heading rules:
//   - h1 -> root title (or branch if another h1 appears later)
//   - h2 -> branch     (gets its own colour)
//   - h3, h4 -> sub    (nested under most recent ancestor of higher level)
//   - h5/h6 ignored    (too granular for a recap)
//
// Paragraph rules:
//   - Paragraphs attach to the most recent heading as a generated
//     one-line summary leaf.
//
// List rules:
//   - Only top-level (column-zero) bullets attach to the most recent
//     heading. Indented bullets (nested lists), or bullets that appear
//     before any heading, are skipped.
//   - At most MAX_BULLETS per heading, to keep the recap scannable.
//
// Sub-section synthesis:
//   - A standalone paragraph that is just `**Term:**` (or starts with
//     `**Term:**` followed by optional text) and is immediately followed
//     by a top-level list becomes a synthetic h4 ("sub") with that
//     paragraph's bullets attached. Mirrors wrapSubSections() in app.js
//     so the precomputed tree matches what users used to see.
// =====================================================================
function buildTreeFromMarkdown(markdown, chapterTitle) {
  if (!markdown) return null;

  const root = { kind: 'root', title: chapterTitle || 'Chapter', children: [], hLevel: 0 };
  const stack = [root];

  function pushHeading(level, kind, title) {
    while (stack.length > 1 && stack[stack.length - 1].hLevel >= level) stack.pop();
    const parent = stack[stack.length - 1];
    const node = {
      kind,
      title: stripInlineMarkdown(title),
      children: [],
      hLevel: level,
      bulletCount: 0,
    };
    parent.children.push(node);
    stack.push(node);
    return node;
  }

  function parentForDetail() {
    return stack[stack.length - 1];
  }

  function addSummaryNode(text) {
    const parent = parentForDetail();
    if (!parent) return;
    if (!text) return;
    parent.children.push({
      kind: 'summary',
      title: text,
      children: [],
      hLevel: SUMMARY_LEVEL,
    });
  }

  function addParagraphSummary(text) {
    const summary = oneLineParagraphSummary(text);
    addSummaryNode(summary);
  }

  let paragraphLines = [];
  function flushParagraph() {
    if (!paragraphLines.length) return;
    addParagraphSummary(paragraphLines.join(' '));
    paragraphLines = [];
  }

  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let skipUntilHeadingLevel = 0;

  // Fence detection accepts ``` and ~~~ at column zero or any indent.
  const FENCE = /^\s{0,3}(?:```|~~~)/;
  const BULLET_TOP = /^(?:[-*+]|\d+\.)\s+(.+?)\s*$/;
  const HEADING = /^(#{1,4})\s+(.+?)\s*$/;
  const TABLE_ROW = /^\s*\|.+\|\s*$/;
  const RULE = /^\s*[-*_]{3,}\s*$/;
  const IMAGE = /^\s*(?:!\[[^\]]*\]\([^)]+\)|<img\b)/i;
  const NON_PARAGRAPH = /^\s*(?:<table\b|```|~~~)/i;
  // A standalone paragraph of `**Term:**` (optionally followed by text on
  // the same line). Used to detect runtime sub-section synthesis.
  const SUB_SECTION_LINE = /^\*\*([^*\n]{1,80}):\*\*\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) { flushParagraph(); inFence = !inFence; continue; }
    if (inFence) continue;

    const headingMatch = line.match(HEADING);
    if (skipUntilHeadingLevel) {
      paragraphLines = [];
      if (!headingMatch) continue;
      const rawNextLevel = headingMatch[1].length;
      const nextLevel = rawNextLevel === 1 ? 1 : rawNextLevel - 1;
      if (nextLevel > skipUntilHeadingLevel) continue;
      skipUntilHeadingLevel = 0;
    }

    if (headingMatch) {
      flushParagraph();
      if (isExcludedMindmapHeading(headingMatch[2])) {
        const rawLevel = headingMatch[1].length;
        const level = rawLevel === 1 ? 1 : rawLevel - 1;
        while (stack.length > 1 && stack[stack.length - 1].hLevel >= level) stack.pop();
        skipUntilHeadingLevel = level;
        continue;
      }
      const rawLevel = headingMatch[1].length;
      if (rawLevel === 1 && root.children.length === 0) {
        root.title = stripInlineMarkdown(headingMatch[2]) || root.title;
        stack.length = 1;
        continue;
      }
      const level = rawLevel === 1 ? 1 : rawLevel - 1; // h2->1, h3->2, h4->3
      pushHeading(level, level === 1 ? 'branch' : 'sub', headingMatch[2]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (IMAGE.test(line)) {
      flushParagraph();
      addSummaryNode(summariseImageLine(line, stack[stack.length - 1] && stack[stack.length - 1].title));
      continue;
    }

    if (TABLE_ROW.test(line)) {
      flushParagraph();
      const tableLines = [];
      let j = i;
      while (j < lines.length && TABLE_ROW.test(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      addSummaryNode(summariseTable(tableLines, stack[stack.length - 1] && stack[stack.length - 1].title));
      i = j - 1;
      continue;
    }

    if (RULE.test(line) || NON_PARAGRAPH.test(line)) {
      flushParagraph();
      continue;
    }

    // Sub-section synthesis: `**Term:**` line then optional blanks then a
    // top-level bullet list on its own.
    const subMatch = line.match(SUB_SECTION_LINE);
    if (subMatch) {
      flushParagraph();
      // Look ahead past blank lines for a top-level bullet.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && BULLET_TOP.test(lines[j])) {
        pushHeading(3, 'sub', subMatch[1]); // synthetic h4
        i = j - 1; // let the outer loop consume the bullets next iteration
        continue;
      }
    }

    // Top-level bullets. We only attach when the most recent stack frame
    // is a heading (not the root) and we still have budget under MAX_BULLETS.
    const bulletMatch = line.match(BULLET_TOP);
    if (bulletMatch) {
      flushParagraph();
      const parent = stack[stack.length - 1];
      if (parent === root) continue; // bullets above any heading -> ignore
      if (parent.bulletCount >= MAX_BULLETS) continue;
      const key = extractBulletKeyTerm(line);
      if (!key) continue;
      parent.children.push({
        kind: 'leaf',
        title: key,
        children: [],
        hLevel: BULLET_LEVEL,
      });
      parent.bulletCount++;
      continue;
    }

    paragraphLines.push(line.trim());
  }

  flushParagraph();

  if (!root.children.length) return null;
  if (countNodes(root) < MIN_NODES) return null;
  return stripBookkeeping(root);
}

function countNodes(node) {
  let n = 1;
  (node.children || []).forEach((c) => { n += countNodes(c); });
  return n;
}

// Drop bookkeeping fields the renderer doesn't need so the emitted file
// stays as small as possible. We keep title, kind, hLevel, children.
function stripBookkeeping(node) {
  const out = { kind: node.kind, title: prettifyCodeLikeLabel(node.title), hLevel: node.hLevel };
  if (node.children && node.children.length) {
    out.children = node.children.map(stripBookkeeping);
  } else {
    out.children = [];
  }
  return out;
}

// =====================================================================
// Step 4 — content checksum.
// FNV-1a 32-bit hex over a canonical JSON of [{id, contentLength,
// contentSample}] sorted by id. Cheap to compute on both sides; good
// enough to detect drift (we don't need cryptographic strength).
// =====================================================================
function fnv1a32Hex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function computeContentChecksum(CONTENT, DPS) {
  // Build a stable string: section.id|normalisedChapterId|chapter.length|
  // first 64 chars for every chapter. Order-independent, deterministic,
  // ignores cosmetic whitespace at the end of a file. Uses the *normalised*
  // id so the runtime hash matches even though the runtime sees the
  // post-normalisation form.
  const rows = [];
  CONTENT.forEach((section) => {
    (section.chapters || []).forEach((ch) => {
      const md = resolveMarkdown(ch, DPS) || '';
      const head = md.slice(0, 64).replace(/\s+/g, ' ');
      const cid = normaliseChapterId(section.id, ch.id);
      rows.push(`${section.id}|${cid}|${md.length}|${head}`);
    });
  });
  rows.sort();
  return fnv1a32Hex(rows.join('\n'));
}

// =====================================================================
// Step 5 — driver.
// =====================================================================
function build() {
  const { CONTENT, DPS } = loadContent();

  const chapters = {};
  const stats = {
    total:    0,
    skipped:  0, // no markdown source (contentFile etc.)
    sparse:   0, // markdown present but tree below MIN_NODES
    emitted:  0,
  };
  const skippedDetail = [];

  CONTENT.forEach((section) => {
    (section.chapters || []).forEach((ch) => {
      stats.total++;
      const cid = normaliseChapterId(section.id, ch.id);
      const key = chapterKey(section.id, cid);
      const md = resolveMarkdown(ch, DPS);
      if (md == null) {
        stats.skipped++;
        skippedDetail.push(`  [skip] ${key}: no inline content (contentFile or unknown contentVar)`);
        return;
      }
      const tree = buildTreeFromMarkdown(md, ch.title);
      if (!tree) {
        stats.sparse++;
        return;
      }
      chapters[key] = { title: ch.title, root: tree };
      stats.emitted++;
    });
  });

  const checksum = computeContentChecksum(CONTENT, DPS);

  const banner =
`/* eslint-disable */
/**
 * AUTO-GENERATED — DO NOT EDIT.
 *
 * Regenerate with:  npm run build:mindmaps
 *
 * Per-chapter mind-map trees precomputed from content.js. Consumed by
 * mindmap.js's window.AllWebMindMap.create({ sectionId, chapterId, ... }).
 *
 * Schema:
 *   window.AllWebMindMapData = {
 *     checksum: '<fnv1a32 hex over content.js chapter sources>',
 *     chapters: {
 *       '<sectionId>/<chapterId>': {        // chapterId is post-normalisation
 *         title: string,
 *         root:  Node           // { kind, title, hLevel, children: Node[] }
 *       },
 *       ...
 *     }
 *   };
 *
 * The composite '<sectionId>/<chapterId>' key matches app.js's chKey()
 * helper. Chapter IDs alone are not globally unique — e.g. 'overview'
 * appears in dp-creational, dp-structural, dp-behavioral, dp-fundamentals.
 *
 * Node.kind:
 *   'root'   — chapter title pill (always one).
 *   'branch' — top-level (h2) heading; renderer assigns it a palette colour.
 *   'sub'    — h3 / h4 / synthetic sub-section; inherits its branch's colour.
 *   'leaf'   — list-item key term; inherits its branch's colour.
 */
`;

  const body =
`window.AllWebMindMapData = {
  checksum: ${JSON.stringify(checksum)},
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  chapters: ${JSON.stringify(chapters, null, 2)}
};
`;

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, banner + body, 'utf8');

  // Friendly summary so the developer can spot regressions quickly.
  console.log(`build-mindmaps: wrote ${OUTPUT_FILE}`);
  console.log(`  chapters seen:    ${stats.total}`);
  console.log(`  trees emitted:    ${stats.emitted}`);
  console.log(`  sparse (skipped): ${stats.sparse}`);
  console.log(`  no source:        ${stats.skipped}`);
  console.log(`  content checksum: ${checksum}`);
  if (skippedDetail.length && skippedDetail.length <= 25) {
    skippedDetail.forEach((l) => console.log(l));
  } else if (skippedDetail.length) {
    console.log(`  (${skippedDetail.length} no-source chapters; pass --verbose to list)`);
  }
  console.log('');
  console.log('Reminder: /*.js is served as immutable, so bump the ?v= query');
  console.log('string for mindmaps.js in index.html before deploying:');
  console.log(`  <script defer src="mindmaps.js?v=${checksum}"></script>`);
}

build();
