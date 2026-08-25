#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_FILE = join(ROOT, 'public', 'content.js');
const DESIGN_MANIFEST_FILE = join(ROOT, 'public', 'content', 'design-manifest.js');
const OUTPUT_FILE = join(ROOT, 'public', 'sitemap.xml');
const ORIGIN = 'https://tech-primer.ronitmehta817.workers.dev/';
const LAST_MODIFIED = '2026-08-25';

function loadSections() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(
    readFileSync(CONTENT_FILE, 'utf8') + '\n;globalThis.__CONTENT__ = CONTENT;',
    context,
    { filename: 'content.js' }
  );
  vm.runInContext(readFileSync(DESIGN_MANIFEST_FILE, 'utf8'), context, {
    filename: 'design-manifest.js'
  });
  return context.__CONTENT__.concat(context.window.CONTENT_DESIGN_MANIFEST || []);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chapterUrl(sectionId, chapterId) {
  const query =
    '?section=' + encodeURIComponent(sectionId) +
    '&chapter=' + encodeURIComponent(chapterId);
  return escapeXml(ORIGIN + query);
}

function buildSitemap(sections) {
  const rows = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${ORIGIN}</loc>`,
    `    <lastmod>${LAST_MODIFIED}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>'
  ];

  const seen = new Set();
  for (const section of sections) {
    for (const chapter of section.chapters || []) {
      const route = `${section.id}/${chapter.id}`;
      if (seen.has(route)) throw new Error(`Duplicate sitemap route: ${route}`);
      seen.add(route);
      rows.push(
        '  <url>',
        `    <loc>${chapterUrl(section.id, chapter.id)}</loc>`,
        `    <lastmod>${LAST_MODIFIED}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>'
      );
    }
  }

  rows.push('</urlset>', '');
  return rows.join('\n');
}

const sections = loadSections();
const output = buildSitemap(sections);

if (process.argv.includes('--check')) {
  if (readFileSync(OUTPUT_FILE, 'utf8') !== output) {
    throw new Error('public/sitemap.xml is stale; run npm run build:sitemap');
  }
  console.log(`validate-sitemap: ${sections.length} sections`);
} else {
  writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(`build-sitemap: ${sections.length} sections -> public/sitemap.xml`);
}
