#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_SOURCE = join(ROOT, 'public', 'content', 'design.js');
const CORE_CONTENT = join(ROOT, 'public', 'content.js');
const MANIFEST_OUTPUT = join(ROOT, 'public', 'content', 'design-manifest.js');
const REQUIRED_HEADINGS = [
  'In Plain English',
  'Why It Matters',
  'Common Mistakes',
  'Interview Questions',
  'Recap'
];

function fail(message) {
  throw new Error(`[design-content] ${message}`);
}

function evaluateScript(path, context) {
  vm.runInContext(readFileSync(path, 'utf8'), context, {
    filename: relative(ROOT, path)
  });
}

function loadDesignSource() {
  const context = { window: {}, console };
  vm.createContext(context);
  evaluateScript(DESIGN_SOURCE, context);
  const sections = context.window.CONTENT_DESIGN;
  const legacyRoutes = context.window.DESIGN_LEGACY_ROUTES;
  if (!Array.isArray(sections) || !sections.length) fail('CONTENT_DESIGN is missing or empty');
  if (!legacyRoutes || typeof legacyRoutes !== 'object') fail('DESIGN_LEGACY_ROUTES is missing');
  return { sections, legacyRoutes };
}

function loadCoreRouteKeys() {
  const context = { console };
  vm.createContext(context);
  evaluateScript(CORE_CONTENT, context);
  vm.runInContext('globalThis.__CONTENT__ = CONTENT;', context);
  const prefixes = ['sd-', 'ms-', 'mq-', 'spring-'];
  const keys = new Set();

  for (const section of context.__CONTENT__) {
    for (const chapter of section.chapters || []) {
      let chapterId = chapter.id;
      const fullPrefix = section.id + '-';
      if (chapterId.startsWith(fullPrefix)) chapterId = chapterId.slice(fullPrefix.length);
      else {
        const prefix = prefixes.find(candidate => section.id.startsWith(candidate));
        if (prefix && chapterId.startsWith(prefix)) chapterId = chapterId.slice(prefix.length);
      }
      keys.add(`${section.id}/${chapterId}`);
    }
  }
  return keys;
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

function headingExists(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}\\s*$`, 'mi').test(markdown);
}

function validateChapter(section, chapter) {
  const label = `${section.id}/${chapter.id}`;
  const markdown = chapter.content;
  if (typeof markdown !== 'string') fail(`${label} has no string content`);
  if (markdown.length < (chapter.minimumCharacters || 900)) {
    fail(`${label} is too short for an in-depth chapter`);
  }
  for (const heading of REQUIRED_HEADINGS) {
    if (!headingExists(markdown, heading)) fail(`${label} is missing "## ${heading}"`);
  }

  const answerCount = countMatches(markdown, /<details\s+class=["']answer["']>/gi);
  const minimumQuestions = chapter.minimumQuestions ?? 5;
  if (answerCount < minimumQuestions) {
    fail(`${label} has ${answerCount} hidden answers; expected at least ${minimumQuestions}`);
  }
  if (answerCount !== countMatches(markdown, /<\/details>/gi)) {
    fail(`${label} has unbalanced answer details blocks`);
  }
  if (!chapter.diagramOptional && countMatches(markdown, /^```mermaid\s*$/gmi) < 1) {
    fail(`${label} must include a Mermaid diagram`);
  }
  if (countMatches(markdown, /^```/gm) % 2 !== 0) {
    fail(`${label} has an unclosed fenced code block`);
  }
  if (section.track === 'lld' && !chapter.javaOptional && countMatches(markdown, /^```java\s*$/gmi) < 1) {
    fail(`${label} must include a Java example`);
  }
  if (/\b(?:TODO|TBD|lorem ipsum|add more|coming soon)\b/i.test(markdown)) {
    fail(`${label} contains placeholder text`);
  }

  const questionsHeading = markdown.search(/^##\s+Interview Questions\s*$/mi);
  const firstAnswer = markdown.search(/<details\s+class=["']answer["']>/i);
  if (questionsHeading < 0 || firstAnswer < questionsHeading) {
    fail(`${label} must place hidden answers under Interview Questions`);
  }
}

function validateAndNormalize(sections, legacyRoutes) {
  const sectionIds = new Set();
  const routeKeys = loadCoreRouteKeys();

  sections.forEach((section, index) => {
    if (!/^design-(?:hld|lld)-[a-z0-9-]+$/.test(section.id || '')) {
      fail(`Section ${index + 1} has an invalid id`);
    }
    if (sectionIds.has(section.id)) fail(`Duplicate section id: ${section.id}`);
    sectionIds.add(section.id);
    if (!['hld', 'lld'].includes(section.track)) fail(`${section.id} has an invalid track`);
    if (!Number.isFinite(section.order)) fail(`${section.id} has no numeric order`);
    if (!section.title || !section.description || !Array.isArray(section.chapters) || !section.chapters.length) {
      fail(`${section.id} is missing title, description, or chapters`);
    }

    const chapterIds = new Set();
    section.chapters.forEach(chapter => {
      if (!/^[a-z0-9-]+$/.test(chapter.id || '')) fail(`${section.id} has an invalid chapter id`);
      if (chapterIds.has(chapter.id)) fail(`Duplicate chapter in ${section.id}: ${chapter.id}`);
      chapterIds.add(chapter.id);
      if (!chapter.title) fail(`${section.id}/${chapter.id} has no title`);
      validateChapter(section, chapter);
      const route = `${section.id}/${chapter.id}`;
      if (routeKeys.has(route)) fail(`Duplicate chapter route: ${route}`);
      routeKeys.add(route);
    });
  });

  for (const section of sections) {
    for (const chapter of section.chapters) {
      const links = Array.from(chapter.content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), match => match[1]);
      for (const link of links) {
        if (/^(?:https?:|mailto:|#)/i.test(link)) continue;
        if (link.startsWith('/?')) {
          const url = new URL(link, 'https://tech-primer.local');
          const target = `${url.searchParams.get('section')}/${url.searchParams.get('chapter')}`;
          if (!routeKeys.has(target)) fail(`${section.id}/${chapter.id} links to missing chapter ${target}`);
          continue;
        }
        fail(`${section.id}/${chapter.id} contains unsupported relative link: ${link}`);
      }
    }
  }

  for (const [legacyRoute, target] of Object.entries(legacyRoutes)) {
    if (!/^(?:sd|dp)-[a-z0-9-]+\/[a-z0-9-]+$/.test(legacyRoute)) {
      fail(`Invalid legacy route: ${legacyRoute}`);
    }
    if (!Array.isArray(target) || target.length !== 2 || !routeKeys.has(`${target[0]}/${target[1]}`)) {
      fail(`Legacy route ${legacyRoute} has an invalid target`);
    }
  }

  return sections.slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function manifestSections(sections) {
  return sections.map(section => ({
    id: section.id,
    title: section.title,
    icon: section.icon,
    description: section.description,
    track: section.track,
    order: section.order,
    chapters: section.chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      ...(chapter.parent ? { parent: chapter.parent } : {})
    }))
  }));
}

function buildManifest(sections, legacyRoutes) {
  const chapterCount = sections.reduce((total, section) => total + section.chapters.length, 0);
  return [
    '/* eslint-disable */',
    '/**',
    ' * GENERATED FILE — DO NOT EDIT.',
    ' * Source: public/content/design.js.',
    ' * Run: npm run build:design',
    ` * Sections: ${sections.length}; chapters: ${chapterCount}.`,
    ' */',
    `window.CONTENT_DESIGN_MANIFEST = ${JSON.stringify(manifestSections(sections), null, 2)};`,
    `window.DESIGN_LEGACY_ROUTES = ${JSON.stringify(legacyRoutes, null, 2)};`,
    ''
  ].join('\n');
}

const source = loadDesignSource();
const sections = validateAndNormalize(source.sections, source.legacyRoutes);
const output = buildManifest(sections, source.legacyRoutes);
const chapterCount = sections.reduce((total, section) => total + section.chapters.length, 0);

if (process.argv.includes('--check')) {
  if (readFileSync(MANIFEST_OUTPUT, 'utf8') !== output) {
    fail('public/content/design-manifest.js is stale');
  }
  console.log(`validate-design-content: ${sections.length} sections, ${chapterCount} chapters`);
} else {
  writeFileSync(MANIFEST_OUTPUT, output, 'utf8');
  console.log(`build-design-content: ${sections.length} sections, ${chapterCount} chapters`);
  console.log(`  wrote ${relative(ROOT, MANIFEST_OUTPUT)}`);
}
