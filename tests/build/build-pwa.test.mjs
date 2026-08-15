import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

async function runTest() {
  const swContent = await readFile(path.join(DIST_DIR, "sw.js"), "utf8");
  if (!swContent.includes("techprimer-release:")) {
    throw new Error("sw.js is missing release key");
  }

  const manifestContent = JSON.parse(await readFile(path.join(DIST_DIR, "manifest.webmanifest"), "utf8"));
  if (manifestContent.display !== "standalone" || manifestContent.start_url !== "/") {
    throw new Error("manifest.webmanifest configuration mismatch");
  }

  const indexContent = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  if (indexContent.includes("@@URL:")) {
    throw new Error("index.html contains unresolved @@URL: tokens");
  }
  if (indexContent.includes("@@SRI:")) {
    throw new Error("index.html contains unresolved @@SRI: tokens");
  }

  console.log("Build verification test passed successfully.");
}

await runTest();
