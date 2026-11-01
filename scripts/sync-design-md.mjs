#!/usr/bin/env node

/**
 * Keeps a DESIGN.md for every brand kit in the Obsidian vault.
 *
 * Asks the site's connector for each kit as DESIGN.md (the same file the
 * brand guide downloads) and writes it to
 *   <vault>/20 Areas/Brands/<Kit name>/DESIGN.md
 * A file is only rewritten when the brand changed, so iCloud and Obsidian
 * don't see a change every run. Nothing is ever deleted: a renamed or removed
 * kit leaves its old note where it was.
 *
 *   pnpm design-md:sync         sync once now
 *   pnpm design-md:install      sync every 15 minutes and at login (launchd)
 *   pnpm design-md:uninstall    stop the schedule
 *
 * Needs the connector key in .env.local as MCP_ACCESS_TOKEN (the same value
 * set on Vercel). Override the site with DESIGN_MD_SITE and the folder with
 * DESIGN_MD_DIR.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connector } from "./siteConnector.mjs";

const LABEL = "com.dallaspeters.design-md";
const PLIST = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const DEFAULT_DIR = join(
  homedir(),
  "Library",
  "Mobile Documents",
  "iCloud~md~obsidian",
  "Documents",
  "Vault",
  "20 Areas",
  "Brands"
);

const UNSAFE = /[/\\:*?"<>|]/g;
const SPACES = /\s+/g;

/** A kit name as a folder name every OS and iCloud accept. */
const folderName = (name) =>
  name.replace(UNSAFE, "-").replace(SPACES, " ").trim() || "Untitled";

const sync = async () => {
  const call = connector();
  const dir = process.env.DESIGN_MD_DIR ?? DEFAULT_DIR;

  const kits = await call("list_brand_kits", {});
  let written = 0;
  for (const kit of kits) {
    // biome-ignore lint/performance/noAwaitInLoops: one kit at a time keeps the log in order and the site unhurried
    const { markdown } = await call("get_design_md", {
      kit: kit.id,
    });
    const folder = join(dir, folderName(kit.name));
    const file = join(folder, "DESIGN.md");
    const before = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (before !== markdown) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(file, markdown);
      written += 1;
      console.log(`wrote ${file}`);
    }
  }
  console.log(
    `${new Date().toISOString()} ${kits.length} kits, ${written} updated → ${dir}`
  );
};

const plist = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${fileURLToPath(import.meta.url)}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>900</integer>
  <key>StandardOutPath</key><string>${join(homedir(), "Library", "Logs", "design-md-sync.log")}</string>
  <key>StandardErrorPath</key><string>${join(homedir(), "Library", "Logs", "design-md-sync.log")}</string>
</dict>
</plist>
`;

const uid = () => String(process.getuid?.() ?? "");

const uninstall = () => {
  try {
    execFileSync("launchctl", ["bootout", `gui/${uid()}`, PLIST], {
      stdio: "ignore",
    });
  } catch {
    // Not loaded; nothing to stop.
  }
};

const install = () => {
  uninstall();
  mkdirSync(dirname(PLIST), { recursive: true });
  writeFileSync(PLIST, plist());
  execFileSync("launchctl", ["bootstrap", `gui/${uid()}`, PLIST]);
  console.log(
    "Installed. DESIGN.md files sync every 15 minutes and at login.\nLog: ~/Library/Logs/design-md-sync.log"
  );
};

const [, , command] = process.argv;
if (command === "--install") {
  install();
} else if (command === "--uninstall") {
  uninstall();
  console.log(
    "Stopped the DESIGN.md sync. The plist stays; delete it if you like."
  );
} else {
  sync().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
