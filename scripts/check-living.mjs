#!/usr/bin/env node
// Static checks for the "living" diagram renderer (public/living.js + public/living-icons.js).
// Browser behaviour is covered by the Playwright audit; this guards the wiring and the palette.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFile(path.join(ROOT, ...p), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [living, icons, app, vendor, index] = await Promise.all([
  read("public", "living.js"),
  read("public", "living-icons.js"),
  read("public", "app.js"),
  read("public", "vendor.js"),
  read("public", "index.html")
]);

// --- wiring -------------------------------------------------------------
assert(
  vendor.includes("https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"),
  "dagre layout library is not loaded by vendor.js"
);
const iconsAt = index.indexOf("living-icons.js?v=");
const livingAt = index.indexOf("living.js?v=");
const appAt = index.indexOf("app.js?v=");
assert(iconsAt > 0 && livingAt > iconsAt && appAt > livingAt,
  "index.html must load living-icons.js, then living.js, then app.js");
assert(living.includes("root.TPLiving = {") && icons.includes("root.TPIcons = {"),
  "living.js / living-icons.js do not expose their globals");
assert(
  app.includes("window.TPLiving.supports(livingCode)") &&
    app.includes("renderWithMermaid()") &&
    app.includes("_livingDispose"),
  "app.js does not try the living renderer with a Mermaid fallback"
);
assert(
  /livingCode = cleanCode;\s*\n[\s\S]*?darkenMermaidStyles\(cleanCode\)/.test(app),
  "The living renderer must receive the text before the dark-mode colour rewrite"
);

// --- every diagram family the site uses has a renderer ----------------------
[
  "flowScene", "stateScene", "classScene", "erScene", "mindmapScene",
  "renderSequence", "renderTimeline", "renderQuadrant", "renderXY"
].forEach(fn => assert(living.includes("function " + fn), `Missing renderer: ${fn}`));

// --- palette: icons are violet or pink only (no yellow, no blue) -------------
function hsl(hex) {
  const v = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const h = d === 0 ? 0 : 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return { h, chroma: d, l };
}
const paletteSource = icons.slice(icons.indexOf("var PALETTE = {"), icons.indexOf("var STROKE ="));
const hexes = [...paletteSource.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0]);
assert(hexes.length >= 28, "Icon palette not found");
for (const hex of hexes) {
  const { h, chroma } = hsl(hex);
  const violetOrPink = h >= 255 && h <= 345;
  const nearGrey = chroma < 0.12; // very light and very dark tints carry almost no colour
  assert(violetOrPink || nearGrey, `Icon colour ${hex} (hue ${Math.round(h)}) is not violet or pink`);
}

console.log("Living diagram checks passed.");
