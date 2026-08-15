import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVendor } from "./build-vendor.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const ASSET_DIR = path.join(DIST_DIR, "assets");

const APP_ASSETS = [
  "app.js",
  "content.js",
  "mindmap.js",
  "mindmaps.js",
  "pwa-client.js",
  "question-sections.js",
  "styles.css",
  "three-bg.js",
  "three-welcome.js"
];

function sha256(bytes) {
  const digest = createHash("sha256").update(bytes).digest();
  return {
    base64: digest.toString("base64"),
    hex: digest.toString("hex")
  };
}

function mimeKind(relativePath) {
  if (relativePath.endsWith(".css")) return "style";
  if (relativePath.endsWith(".js")) return "script";
  if (relativePath.endsWith(".png")) return "image";
  if (relativePath.endsWith(".svg")) return "image";
  if (relativePath.endsWith(".webmanifest")) return "manifest";
  if (relativePath.endsWith(".html")) return "document";
  return "binary";
}

function createAssetRecord(relativePath, bytes, publicPrefix = "/assets/") {
  const digest = sha256(bytes);
  const normalizedPath = relativePath.split(path.sep).join("/");
  return {
    key: normalizedPath,
    url: `${publicPrefix}${normalizedPath}?v=${digest.hex.slice(0, 16)}`,
    sha256: digest.base64,
    integrity: `sha256-${digest.base64}`,
    mime: mimeKind(normalizedPath),
    required: true
  };
}

async function listFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listFiles(absolutePath, baseDirectory));
    } else {
      results.push(path.relative(baseDirectory, absolutePath).split(path.sep).join("/"));
    }
  }

  return results;
}

async function copyAppAssets() {
  await mkdir(ASSET_DIR, { recursive: true });
  for (const relativePath of APP_ASSETS) {
    await copyFile(
      path.join(PUBLIC_DIR, relativePath),
      path.join(ASSET_DIR, relativePath)
    );
  }

  const iconDirectory = path.join(PUBLIC_DIR, "icons");
  const iconFiles = await listFiles(iconDirectory);
  for (const relativePath of iconFiles) {
    const destination = path.join(ASSET_DIR, "icons", relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(iconDirectory, relativePath), destination);
  }
}

function replaceToken(source, token, value) {
  const next = source.split(token).join(value);
  if (next === source) {
    throw new Error(`Required build token was not found: ${token}`);
  }
  return next;
}

function assertNoTokens(source, fileName) {
  const unresolved = source.match(/@@[A-Z]+:[^@]+@@/g);
  if (unresolved) {
    throw new Error(`${fileName} contains unresolved tokens: ${unresolved.join(", ")}`);
  }
}

async function build() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(ASSET_DIR, { recursive: true });

  await copyAppAssets();
  await buildVendor(path.join(ASSET_DIR, "vendor"));

  const stagedFiles = await listFiles(ASSET_DIR);
  const records = new Map();

  for (const relativePath of stagedFiles) {
    if (relativePath.endsWith("THIRD_PARTY_LICENSES.txt")) continue;
    const bytes = await readFile(path.join(ASSET_DIR, relativePath));
    records.set(relativePath, createAssetRecord(relativePath, bytes));
  }

  const vendorTemplate = await readFile(path.join(PUBLIC_DIR, "vendor.js"), "utf8");
  const vendorAssets = {};
  for (const [key, record] of records) {
    if (key.startsWith("vendor/")) {
      vendorAssets[key.slice("vendor/".length)] = {
        url: record.url,
        integrity: record.integrity
      };
    }
  }

  const renderedVendor = replaceToken(
    vendorTemplate,
    "@@VENDOR_ASSETS_JSON@@",
    JSON.stringify(vendorAssets)
  );
  assertNoTokens(renderedVendor, "vendor.js");
  await writeFile(path.join(ASSET_DIR, "vendor.js"), renderedVendor, "utf8");

  const vendorLoaderBytes = Buffer.from(renderedVendor);
  records.set("vendor.js", createAssetRecord("vendor.js", vendorLoaderBytes));

  const manifestSource = JSON.parse(
    await readFile(path.join(PUBLIC_DIR, "manifest.json"), "utf8")
  );
  manifestSource.id = "/";
  manifestSource.start_url = "/";
  manifestSource.scope = "/";
  manifestSource.display = "standalone";
  manifestSource.icons = [
    {
      src: records.get("icons/icon-192.png").url,
      sizes: "192x192",
      type: "image/png",
      purpose: "any"
    },
    {
      src: records.get("icons/icon-512.png").url,
      sizes: "512x512",
      type: "image/png",
      purpose: "any"
    },
    {
      src: records.get("icons/icon-maskable-512.png").url,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ];

  const manifestText = `${JSON.stringify(manifestSource, null, 2)}\n`;
  await writeFile(path.join(DIST_DIR, "manifest.webmanifest"), manifestText, "utf8");
  const manifestRecord = createAssetRecord(
    "manifest.webmanifest",
    Buffer.from(manifestText),
    "/"
  );
  records.set("manifest.webmanifest", manifestRecord);

  let indexHtml = await readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
  for (const [key, record] of records) {
    indexHtml = indexHtml
      .split(`@@URL:${key}@@`).join(record.url)
      .split(`@@SRI:${key}@@`).join(record.integrity);
  }
  assertNoTokens(indexHtml, "index.html");
  await writeFile(path.join(DIST_DIR, "index.html"), indexHtml, "utf8");

  const shellDigest = sha256(Buffer.from(indexHtml));
  const swTemplate = await readFile(
    path.join(ROOT_DIR, "scripts", "sw-template.js"),
    "utf8"
  );
  const swTemplateDigest = sha256(Buffer.from(swTemplate)).hex;

  const releaseInput = [
    `shell:${shellDigest.hex}`,
    `worker:${swTemplateDigest}`,
    ...Array.from(records.values())
      .sort((a, b) => a.url.localeCompare(b.url))
      .map(record => `${record.url}:${record.sha256}`)
  ].join("\n");

  const releaseId = sha256(Buffer.from(releaseInput)).hex;
  const release = {
    id: releaseId,
    cacheName: `techprimer-release:${releaseId}`,
    shell: {
      url: `/index.html?release=${releaseId}`,
      sha256: shellDigest.base64,
      mime: "document",
      required: true
    },
    assets: Array.from(records.values())
      .sort((a, b) => a.url.localeCompare(b.url))
      .map(({ url, sha256: digest, mime, required }) => ({
        url,
        sha256: digest,
        mime,
        required
      }))
  };

  const renderedWorker = replaceToken(
    swTemplate,
    "@@RELEASE_JSON@@",
    JSON.stringify(release)
  );
  await writeFile(path.join(DIST_DIR, "sw.js"), renderedWorker, "utf8");
  await writeFile(
    path.join(DIST_DIR, "release.json"),
    `${JSON.stringify(release, null, 2)}\n`,
    "utf8"
  );
  try {
    await copyFile(
      path.join(PUBLIC_DIR, "_headers"),
      path.join(DIST_DIR, "_headers")
    );
  } catch (_) { }
  try {
    await copyFile(
      path.join(PUBLIC_DIR, "robots.txt"),
      path.join(DIST_DIR, "robots.txt")
    );
  } catch (_) { }
  try {
    await copyFile(
      path.join(PUBLIC_DIR, "sitemap.xml"),
      path.join(DIST_DIR, "sitemap.xml")
    );
  } catch (_) { }
  console.log(`PWA built successfully. Release ID: ${releaseId}`);
}

await build();
