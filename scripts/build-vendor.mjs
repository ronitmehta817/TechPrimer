import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const BUNDLES = [
  {
    output: "marked.js",
    candidates: [
      "node_modules/marked/marked.umd.js",
      "node_modules/marked/lib/marked.umd.js",
      "node_modules/marked/marked.min.js"
    ]
  },
  {
    output: "highlight.js",
    candidates: ["node_modules/@highlightjs/cdn-assets/highlight.min.js"]
  },
  {
    output: "mermaid.js",
    candidates: ["node_modules/mermaid/dist/mermaid.min.js"]
  },
  {
    output: "pako.js",
    candidates: [
      "node_modules/pako/dist/browser/pako.umd.min.js",
      "node_modules/pako/dist/pako.min.js"
    ]
  },
  {
    output: "fuse.js",
    candidates: [
      "node_modules/fuse.js/dist/fuse.min.js",
      "node_modules/fuse.js/dist/fuse.basic.min.js",
      "node_modules/fuse.js/dist/fuse.min.cjs",
      "node_modules/fuse.js/dist/fuse.basic.min.cjs"
    ]
  },
  {
    output: "dompurify.js",
    candidates: ["node_modules/dompurify/dist/purify.min.js"]
  }
];

const HIGHLIGHT_LANGUAGES = [
  "python",
  "java",
  "javascript",
  "bash",
  "json",
  "yaml",
  "xml",
  "sql",
  "properties"
];

async function resolveCandidate(candidates) {
  for (const candidate of candidates) {
    const absolutePath = path.join(ROOT_DIR, candidate);
    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to resolve vendor file: ${candidates.join(", ")}`);
}

async function copyChecked(source, destination) {
  let bytes = await readFile(source);
  if (bytes.byteLength === 0) {
    throw new Error(`Vendor file is empty: ${source}`);
  }

  // If fuse.js is resolved from a CommonJS bundle, wrap it for browser script tag compatibility
  if (destination.endsWith("fuse.js") && (source.endsWith(".cjs") || !bytes.includes(Buffer.from("window.Fuse")))) {
    const code = bytes.toString("utf8");
    if (!code.includes("window.Fuse") && code.includes("module.exports")) {
      const wrapped = `var Fuse; (function(){ var module = { exports: {} }; var exports = module.exports;\n${code}\nFuse = module.exports; if (typeof window !== "undefined") window.Fuse = Fuse; if (typeof globalThis !== "undefined") globalThis.Fuse = Fuse; })();\n`;
      bytes = Buffer.from(wrapped, "utf8");
    }
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

export async function buildVendor(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const outputs = [];

  for (const bundle of BUNDLES) {
    const source = await resolveCandidate(bundle.candidates);
    const destination = path.join(outputDirectory, bundle.output);
    await copyChecked(source, destination);
    outputs.push(bundle.output);
  }

  for (const language of HIGHLIGHT_LANGUAGES) {
    const source = path.join(
      ROOT_DIR,
      "node_modules",
      "@highlightjs",
      "cdn-assets",
      "languages",
      `${language}.min.js`
    );
    const relativeOutput = path.posix.join("highlight-languages", `${language}.js`);
    const destination = path.join(outputDirectory, relativeOutput);
    await copyChecked(source, destination);
    outputs.push(relativeOutput);
  }

  const licenses = [
    ["marked", "node_modules/marked/LICENSE.md"],
    ["highlight", "node_modules/@highlightjs/cdn-assets/LICENSE"],
    ["mermaid", "node_modules/mermaid/LICENSE"],
    ["pako", "node_modules/pako/LICENSE"],
    ["fuse", "node_modules/fuse.js/LICENSE"],
    ["dompurify", "node_modules/dompurify/LICENSE"]
  ];

  const licenseSections = [];
  for (const [name, relativePath] of licenses) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    let text = "";
    try {
      text = await readFile(absolutePath, "utf8");
    } catch {
      try {
        text = await readFile(path.join(ROOT_DIR, relativePath.replace(/(\.md|\.txt)?$/, "")), "utf8");
      } catch {
        text = `License for ${name}`;
      }
    }
    licenseSections.push(`===== ${name} =====\n${text.trim()}\n`);
  }

  await writeFile(
    path.join(outputDirectory, "THIRD_PARTY_LICENSES.txt"),
    `${licenseSections.join("\n")}\n`,
    "utf8"
  );

  return outputs.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDirectory = path.join(ROOT_DIR, "dist", "assets", "vendor");
  await buildVendor(outputDirectory);
}
