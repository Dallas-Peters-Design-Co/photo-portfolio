/**
 * api-dev.ts - the /api functions as one long-lived Node server, for local
 * development.
 *
 *   SITE=dallas-images pnpm tsx scripts/api-dev.ts        # :3007
 *
 * Why not `vercel dev`: it bundles the function on every request, which costs
 * 0.9 to 1.4 seconds per call here, including /api/robots which touches
 * nothing. The admin makes half a dozen calls on load, so a cold admin took
 * seven to eight seconds. This process imports each handler once and answers
 * in the time the handler takes.
 *
 * What it mirrors from Vercel's runtime, and only this:
 *   - filesystem routing under api/: index.ts, name.ts, [param].ts and
 *     [param]/child.ts, in that order of preference;
 *   - req.query from the search string plus the bracket params;
 *   - req.body parsed from JSON (or the raw string when it is not JSON);
 *   - res.status().json() / .send() / .redirect(), on top of Node's response.
 *
 * Handlers are imported once per process. scripts/dev-stack.mjs runs this
 * under `tsx watch`, which restarts the process when an imported file
 * changes, so an edit under api/ is live on the next request.
 *
 * Deploys still run on Vercel; nothing here ships. If a handler needs
 * something this shim lacks, `pnpm dev:vercel` is the old path.
 */

import { readdirSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "./loadEnv";

loadEnv();
if (process.env.VITE_SITE && !process.env.SITE) {
  process.env.SITE = process.env.VITE_SITE;
}

const PORT = Number(process.env.API_PORT) || 3007;
const ROOT = resolve(import.meta.dirname, "..");
const API = join(ROOT, "api");

type Handler = (req: unknown, res: unknown) => unknown;
const cache = new Map<string, Promise<Handler>>();

const API_PREFIX = /^\/api\/?/;
const BRACKET = /^\[(.+)\]$/;

interface Route {
  file: string;
  /** One entry per path segment: a literal, or a param name. */
  parts: { literal?: string; param?: string }[];
}

/**
 * Every function under api/, read once at start. A route's parts are the
 * path segments it answers to: `api/proposals/[slug]/accept.ts` becomes
 * [proposals, :slug, accept]; an index.ts answers to its directory. Literal
 * segments outrank params, so a request is matched against the most specific
 * route first.
 */
const walk = (dir: string, parts: Route["parts"]): Route[] => {
  const out: Route[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) {
      continue;
    }
    const full = join(dir, name);
    const seg = (raw: string) => {
      const m = BRACKET.exec(raw);
      return m?.[1] ? { param: m[1] } : { literal: raw };
    };
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, [...parts, seg(name)]));
    } else if (name === "index.ts") {
      out.push({ file: full, parts });
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push({ file: full, parts: [...parts, seg(name.slice(0, -3))] });
    }
  }
  return out;
};
const ROUTES = walk(API, []).sort(
  (a, b) =>
    b.parts.filter((x) => x.literal).length -
    a.parts.filter((x) => x.literal).length
);

const route = (
  pathname: string
): { file: string; params: Record<string, string> } | null => {
  const segments = pathname.replace(API_PREFIX, "").split("/").filter(Boolean);
  for (const r of ROUTES) {
    if (r.parts.length !== segments.length) {
      continue;
    }
    const params: Record<string, string> = {};
    const ok = r.parts.every((part, i) => {
      const seg = segments[i] ?? "";
      if (part.literal !== undefined) {
        return part.literal === seg;
      }
      params[part.param ?? ""] = decodeURIComponent(seg);
      return true;
    });
    if (ok) {
      return { file: r.file, params };
    }
  }
  return null;
};

const load = (file: string): Promise<Handler> => {
  let p = cache.get(file);
  if (!p) {
    p = import(pathToFileURL(file).href).then((m) => m.default as Handler);
    cache.set(file, p);
  }
  return p;
};

const readBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((done) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        return done(undefined);
      }
      const type = String(req.headers["content-type"] ?? "");
      if (type.includes("application/json")) {
        try {
          return done(JSON.parse(raw));
        } catch {
          return done(raw);
        }
      }
      done(raw);
    });
  });

const decorate = (res: ServerResponse) => {
  const r = res as ServerResponse & {
    status: (code: number) => typeof r;
    json: (body: unknown) => typeof r;
    send: (body: unknown) => typeof r;
    redirect: (a: number | string, b?: string) => typeof r;
  };
  r.status = (code) => {
    r.statusCode = code;
    return r;
  };
  r.json = (body) => {
    if (!r.getHeader("content-type")) {
      r.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    r.end(JSON.stringify(body));
    return r;
  };
  r.send = (body) => {
    if (body === undefined || body === null) {
      r.end();
    } else if (typeof body === "string" || Buffer.isBuffer(body)) {
      r.end(body);
    } else {
      r.json(body);
    }
    return r;
  };
  r.redirect = (a, b) => {
    const [code, url] = typeof a === "number" ? [a, b ?? "/"] : [307, a];
    r.statusCode = code;
    r.setHeader("Location", url);
    r.end();
    return r;
  };
  return r;
};

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const hit = route(url.pathname);
  if (!hit) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: `No function for ${url.pathname}` }));
    return;
  }
  const query: Record<string, string | string[]> = { ...hit.params };
  for (const [k, v] of url.searchParams) {
    const prev = query[k];
    if (prev === undefined) {
      query[k] = v;
    } else {
      query[k] = Array.isArray(prev) ? [...prev, v] : [prev, v];
    }
  }
  const request = req as IncomingMessage & {
    query: typeof query;
    body: unknown;
  };
  request.query = query;
  request.body = await readBody(req);
  try {
    const handler = await load(hit.file);
    await handler(request, decorate(res));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Function crashed; see the api-dev log" })
      );
    }
  } finally {
    console.log(
      `${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started}ms)`
    );
  }
});

server.listen(PORT, () => {
  console.log(
    `[api-dev] /api on http://localhost:${PORT} (site ${process.env.SITE ?? "default"})`
  );
});
