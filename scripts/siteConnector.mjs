/**
 * The site connector from a local script: the repo's env, and one call to a
 * connector tool. Shared by the DESIGN.md sync and the website scan.
 *
 * Needs MCP_ACCESS_TOKEN in .env.local (the value set on Vercel). Point it at
 * another deployment with DESIGN_MD_SITE.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LINE = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/;
const QUOTED = /^(['"])(.*)\1$/;
const TRAILING_SLASH = /\/$/;

/** KEY=value lines from the repo's env files, without overriding the shell. */
export const loadEnv = () => {
  for (const name of [".env", ".env.local"]) {
    const path = join(ROOT, name);
    if (!existsSync(path)) {
      continue;
    }
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = ENV_LINE.exec(line);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(QUOTED, "$2");
      }
    }
  }
};

/** A caller for the site's connector tools, from the env. */
export const connector = () => {
  loadEnv();
  const token = process.env.MCP_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Set MCP_ACCESS_TOKEN in .env.local (the site connector's key) first."
    );
  }
  const site = (
    process.env.DESIGN_MD_SITE ?? "https://www.dallaspeters.com"
  ).replace(TRAILING_SLASH, "");

  return async (name, args) => {
    const res = await fetch(`${site}/api/mcp/connect`, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: args, name },
      }),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    if (res.status === 401) {
      throw new Error(
        "The site refused the key. Check MCP_ACCESS_TOKEN in .env.local matches Vercel."
      );
    }
    if (!res.ok) {
      throw new Error(`The site answered ${res.status}`);
    }
    const json = await res.json();
    const text = json?.result?.content?.[0]?.text ?? "";
    if (json?.result?.isError || json?.error) {
      throw new Error(text || json?.error?.message || "The connector failed");
    }
    return JSON.parse(text);
  };
};
