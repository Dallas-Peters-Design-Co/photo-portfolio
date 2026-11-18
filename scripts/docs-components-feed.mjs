/** Fetch once and skip the expensive browser scan when nothing has changed. */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const origin = process.env.DOCS_FEED_ORIGIN ?? "https://www.dallaspeters.com";
const response = await fetch(
  `${origin}/api/brand-kits?docs=components&build=${Date.now()}`
);
if (!response.ok) {
  throw new Error(`Component feed returned ${response.status}`);
}
const feed = await response.json();
if (
  !Array.isArray(feed.kits) ||
  feed.kits.some((kit) => !Array.isArray(kit.components))
) {
  throw new Error("Invalid component feed");
}
writeFileSync("/tmp/docs-components-feed.json", JSON.stringify(feed));
const hash = createHash("sha256");
hash.update(
  JSON.stringify(feed.kits.map(({ updatedAt: _updatedAt, ...kit }) => kit))
);
for (const file of [
  "scripts/docs-components.mjs",
  "scripts/docs-components-scan.mjs",
  "pnpm-lock.yaml",
]) {
  hash.update(readFileSync(path.join(root, file)));
}
const digest = hash.digest("hex");
writeFileSync("/tmp/docs-components-hash", `${digest}\n`);
let previous = "";
try {
  previous = readFileSync(
    path.join(root, "docs/site/.component-feed-hash"),
    "utf8"
  ).trim();
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}
const changed =
  digest !== previous || process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}
process.stdout.write(
  changed
    ? "Component docs need rebuilding.\n"
    : "Component docs are current.\n"
);
