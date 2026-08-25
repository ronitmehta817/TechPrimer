import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, vendor, styles, index, headers, detectorSource] = await Promise.all([
  readFile(path.join(ROOT_DIR, "public", "app.js"), "utf8"),
  readFile(path.join(ROOT_DIR, "public", "vendor.js"), "utf8"),
  readFile(path.join(ROOT_DIR, "public", "styles.css"), "utf8"),
  readFile(path.join(ROOT_DIR, "public", "index.html"), "utf8"),
  readFile(path.join(ROOT_DIR, "public", "_headers"), "utf8"),
  readFile(path.join(ROOT_DIR, "public", "mermaid-detect.js"), "utf8")
]);

[
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js",
  "https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js"
].forEach(url => {
  assert(vendor.includes(url), `Missing PDF export vendor: ${url}`);
});
assert(
  vendor.includes("window.TP_CORE_VENDOR_READY") &&
    vendor.includes("window.TP_PDF_EXPORT_READY"),
  "Core or PDF vendor readiness is not exposed"
);

[
  "exportDomainPdfZip",
  "buildChapterPdf",
  "renderDomainPdfMermaid",
  "addDomainPdfCanvas",
  "buildDomainPdfRenderItems",
  "addDomainPdfSvg",
  "createDomainPdfZipWriter",
  "finishDomainPdfZip",
  "ensureDomainPdfWakeLock",
  "checkDomainPdfResources",
  "updateDomainPdfEstimates",
  "domain-pdf-button"
].forEach(marker => {
  assert(app.includes(marker), `Missing domain PDF implementation: ${marker}`);
});

assert(
  app.includes("window.AllWebMindMap.toSvg"),
  "Domain PDF mind maps are not exported as vector SVG"
);
assert(
  app.includes("img[src*=\"mermaid.ink\"]"),
  "Domain PDFs do not process Mermaid images"
);
assert(
  app.includes("looksLikeMermaidSource") &&
    app.includes("isMermaidCodeBlock") &&
    app.includes("explicitLanguage"),
  "Unlabelled Mermaid code blocks are not auto-detected"
);

const detectorSandbox = { window: {} };
vm.createContext(detectorSandbox);
vm.runInContext(detectorSource, detectorSandbox, {
  filename: "mermaid-detect.js"
});
const detect =
  detectorSandbox.window.TechPrimerMermaidDetector.looksLikeMermaidSource;
[
  "classDiagram\nclass Client",
  "%% comment\nsequenceDiagram\nA->>B: Hello",
  "---\ntitle: Example\n---\nflowchart LR\nA-->B",
  "architecture-beta\nservice api",
  "block-beta\ncolumns 3",
  "packet-beta\n0-15: Source",
  "kanban\nTodo[Todo]",
  "sankey-beta\nA,B,1",
  "xychart-beta horizontal\nx-axis [a]",
  "radar-beta\naxis a",
  "treemap-beta\nRoot",
  "pie title Pets\n\"Dogs\" : 4",
  "C4Context\nPerson(user, \"User\")"
].forEach(source => {
  assert(detect(source), `Valid Mermaid directive was missed: ${source}`);
});
[
  "classDiagram = createDiagram()",
  "timeline = []",
  "journey.start()",
  "pie(data)",
  "graph LR = configuration"
].forEach(source => {
  assert(!detect(source), `Common code was misclassified as Mermaid: ${source}`);
});
assert(
  app.includes("window.fflate.ZipPassThrough"),
  "Domain PDFs are not streamed into a ZIP"
);
assert(!app.includes("window.fflate.zipSync"), "Domain ZIP still duplicates every PDF in memory");
assert(
  app.includes("waitForWrites") && app.includes("showSaveFilePicker"),
  "Direct ZIP writes do not apply backpressure"
);
assert(
  app.includes("expandDomainPdfDetails"),
  "Closed chapter details are omitted from PDFs"
);
assert(
  app.includes("options.scale || 1.0") &&
    app.includes("{ scale: 1, lossless: false }"),
  "Fast canvas scale is not enabled"
);
assert(
  (app.match(/image\/jpeg', 0\.78/g) || []).length === 1,
  "Fast JPEG quality is not applied to page batches"
);
assert(
  app.includes("image/png") &&
    app.includes("mermaid-raster") &&
    app.includes("{ scale: 2, lossless: true }"),
  "Mermaid diagrams are not exported as high-resolution lossless images"
);
assert(app.includes("pdf.svg(item.svg"), "Vector SVG export is not enabled");
assert(
  app.includes("showSaveFilePicker") &&
    app.includes("navigator.wakeLock") &&
    app.includes("navigator.storage"),
  "File streaming, Wake Lock, or resource warnings are missing"
);
assert(
  app.includes("splitDomainPdfPre") &&
    app.includes("splitDomainPdfTable") &&
    app.includes("splitDomainPdfList"),
  "Oversized content is not split at semantic boundaries"
);
assert(!app.includes("sliceHeightPx"), "PDF pages are still cut at arbitrary pixels");
assert(
  styles.includes(".domain-pdf-export-stage"),
  "PDF export stage styles are missing"
);
assert(
  styles.includes(".domain-pdf-progress-overlay"),
  "PDF progress UI styles are missing"
);
assert(
  styles.includes("max-height: none !important") &&
    styles.includes("overflow: visible !important"),
  "Mind maps are clipped in PDF captures"
);
assert(
  styles.includes(".domain-pdf-export-stage :where(") &&
    styles.includes("background: #1f2937 !important"),
  "PDF code-block colors are not protected from the light-theme reset"
);
assert(
  headers.includes("https://cdn.jsdelivr.net"),
  "CSP does not allow the pinned PDF export vendors"
);
assert(
  !index.includes("techprimer-offline.zip"),
  "The superseded offline ZIP Download button is still present"
);
[
  "vendor.js?v=20260825-mermaid-full",
  "styles.css?v=20260825-mermaid-full",
  "mermaid-detect.js?v=20260825-mermaid-full",
  "app.js?v=20260825-mermaid-full"
].forEach(asset => {
  assert(index.includes(asset), `Missing PDF export cache version: ${asset}`);
});

for (const obsoletePath of [
  "offline",
  path.join("scripts", "build-offline.mjs"),
  path.join("public", "downloads")
]) {
  try {
    await access(path.join(ROOT_DIR, obsoletePath));
    throw new Error(`Superseded offline ZIP artifact remains: ${obsoletePath}`);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}

console.log("Domain chapter-PDF ZIP checks passed.");
