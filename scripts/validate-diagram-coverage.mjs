#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {}, console };
vm.createContext(context);

function run(relativePath) {
  vm.runInContext(readFileSync(resolve(ROOT, relativePath), 'utf8'), context, {
    filename: relativePath
  });
}

run('public/question-sections.js');
run('public/content/diagrams.js');
run('public/content.js');
vm.runInContext('globalThis.__CORE__ = CONTENT;', context);
run('public/content/design.js');

const prefixes = ['design-hld-', 'design-lld-', 'sd-', 'ms-', 'mq-', 'spring-'];
const diagrams = context.window.CHAPTER_DIAGRAMS || {};
const sections = context.__CORE__.concat(context.window.CONTENT_DESIGN || []);
const routes = new Set();
const missing = [];

function normalizeChapterId(sectionId, chapterId) {
  const fullPrefix = sectionId + '-';
  if (chapterId.startsWith(fullPrefix)) return chapterId.slice(fullPrefix.length);
  const prefix = prefixes.find(candidate => sectionId.startsWith(candidate));
  return prefix && chapterId.startsWith(prefix) ? chapterId.slice(prefix.length) : chapterId;
}

function chapterMarkdown(chapter) {
  if (typeof chapter.content === 'string') return chapter.content;
  const bag = context.window[chapter.contentVar];
  return bag && typeof bag[chapter.contentSection] === 'string'
    ? bag[chapter.contentSection]
    : '';
}

for (const section of sections) {
  for (const chapter of section.chapters || []) {
    const chapterId = normalizeChapterId(section.id, chapter.id);
    const route = `${section.id}/${chapterId}`;
    routes.add(route);
    const base = chapterMarkdown(chapter);
    const supplement = diagrams[route] || '';
    const markdown = base + '\n' + supplement;
    const hasMermaid = /```mermaid\s*\n/i.test(markdown) || /mermaid\.ink\/(?:svg|img)/i.test(markdown);
    if (!hasMermaid) missing.push(route);
  }
}

const orphaned = Object.keys(diagrams).filter(route => !routes.has(route));
if (missing.length || orphaned.length) {
  if (missing.length) console.error(`Missing Mermaid diagrams:\n${missing.join('\n')}`);
  if (orphaned.length) console.error(`Orphaned diagram routes:\n${orphaned.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`validate-diagram-coverage: ${routes.size}/${routes.size} chapters`);
}
