import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  EMPTY_KIT,
  MAX_KIT_NAME,
  sanitizeKitDoc,
} from "../../config/brandKit.js";
import { getBearerUser } from "../_lib/auth.js";
import { UUID_RE } from "../_lib/boardItemParse.js";
import {
  deleteComponent,
  listComponents,
  saveComponent,
} from "../_lib/brandComponents.js";
import { loadKit, loadKits, writeKitVersion } from "../_lib/brandKitStore.js";
import { handleCors } from "../_lib/cors.js";
import { readCopyRequest, writeCopy } from "../_lib/creativeCopy.js";
import { brandImage, readImageRequest } from "../_lib/creativeImage.js";
import { getSql } from "../_lib/db.js";
import { isFalConfigured } from "../_lib/fal.js";
import { adobeKitFamilies, googleCatalog } from "../_lib/fontCatalog.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { designMdOf } from "../_lib/mcpBrandTools.js";
import { loadModelDefs } from "../_lib/modelStore.js";
import { getDb, schema } from "../_lib/orm.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { withRequestIdentity } from "../_lib/requestIdentity.js";
import { deleteLook, listLooks, saveLook } from "../_lib/savedLooks.js";
import { fetchSitePage } from "../_lib/sitePage.js";

/**
 * The brand kits: what exists, and making a new one.
 *
 * Admin-only in both directions, like the recipe library and the board list. A
 * kit is a governing document rather than anything published — a public index
 * would hand out every brand's palette, typefaces and the wording of its voice.
 *
 * A kit is created *with* its first version rather than empty, when a document
 * is supplied. A kit with no version is a legal row — patch 031 allows it, and
 * `current_version_id` is nullable for exactly that reason — but it is a kit
 * that cannot be wired into anything, so it is not the default outcome of
 * pressing New.
 */

type Sql = ReturnType<typeof getSql>;
type User = ReturnType<typeof getBearerUser>;

async function handleGet(
  sql: Sql,
  user: User,
  req: VercelRequest,
  res: VercelResponse
) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Saved photo-editor looks ride on this endpoint (see _lib/savedLooks.ts).
  if (req.query.looks) {
    return res.status(200).json(await listLooks(sql));
  }
  // A kit's components ride here too (see _lib/brandComponents.ts).
  if (typeof req.query.components === "string") {
    return res
      .status(200)
      .json(await listComponents(sql, req.query.components));
  }
  // Brand font lookups ride here too (see _lib/fontCatalog.ts).
  if (req.query.fonts === "google") {
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.status(200).json(await googleCatalog());
  }
  if (req.query.typekit) {
    const families = await adobeKitFamilies(req.query.typekit);
    return families
      ? res.status(200).json(families)
      : res.status(404).json({
          error:
            "Adobe Fonts couldn't find that web project. Check the id and that it's published.",
        });
  }
  // A website's page, scripts stripped, for the admin's in-browser scan.
  if (typeof req.query.page === "string") {
    const page = await fetchSitePage(req.query.page);
    return page.ok
      ? res.status(200).json({ html: page.html, url: page.url })
      : res.status(422).json({ error: page.error });
  }
  // A kit as DESIGN.md, for the guide's download (see _lib/mcpBrandTools.ts).
  if (typeof req.query.design === "string") {
    const kit = UUID_RE.test(req.query.design)
      ? await loadKit(sql, req.query.design)
      : null;
    if (!kit) {
      return res.status(404).json({ error: "That brand kit wasn't found" });
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    return res.status(200).send(designMdOf(kit));
  }
  return res.status(200).json(await loadKits(sql));
}

async function handleLookAction(
  sql: Sql,
  body: Record<string, unknown>,
  res: VercelResponse
) {
  if (body.action === "deleteLook") {
    await deleteLook(sql, body.id);
    return res.status(204).end();
  }
  const out = await saveLook(sql, body);
  return out.ok
    ? res.status(out.status).json(out.look)
    : res.status(out.status).json({ error: out.error });
}

async function handleImage(
  sql: Sql,
  body: Record<string, unknown>,
  res: VercelResponse
) {
  if (!isFalConfigured()) {
    return res.status(503).json({
      error:
        "Image generation is not configured. Set FAL_API_KEY on the project.",
    });
  }
  // No kit is allowed: the picture is made from the request alone.
  const kitId = typeof body.kitId === "string" ? body.kitId : "";
  const kit = UUID_RE.test(kitId) ? await loadKit(sql, kitId) : null;
  if (kitId && !kit) {
    return res.status(404).json({ error: "That brand kit wasn't found" });
  }
  try {
    const image = await brandImage(
      kit?.resolvedDoc ?? EMPTY_KIT,
      readImageRequest(body),
      await loadModelDefs()
    );
    return res.status(200).json(image);
  } catch (e) {
    console.error("[brand-kits] image", e);
    return res.status(502).json({
      error: e instanceof Error ? e.message : "Couldn't make the picture",
    });
  }
}

async function handleCopy(
  sql: Sql,
  body: Record<string, unknown>,
  res: VercelResponse
) {
  const kitId = String(body.kitId ?? "");
  const kit = UUID_RE.test(kitId) ? await loadKit(sql, kitId) : null;
  if (!kit) {
    return res.status(404).json({ error: "That brand kit wasn't found" });
  }
  try {
    const variants = await writeCopy(kit.resolvedDoc, readCopyRequest(body));
    return res.status(200).json({ variants });
  } catch (e) {
    console.error("[brand-kits] copy", e);
    return res.status(502).json({
      error: e instanceof Error ? e.message : "Couldn't write copy just now",
    });
  }
}

async function handlePost(
  sql: Sql,
  user: User,
  req: VercelRequest,
  res: VercelResponse
) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const body = parseJsonBody(req.body) as Record<string, unknown>;
  if (body.action === "saveLook" || body.action === "deleteLook") {
    return await handleLookAction(sql, body, res);
  }
  if (body.action === "deleteComponent") {
    await deleteComponent(sql, body.id);
    return res.status(204).end();
  }
  if (body.action === "saveComponent") {
    const out = await saveComponent(sql, body);
    return out.ok
      ? res.status(out.status).json(out.component)
      : res.status(out.status).json({ error: out.error });
  }
  // Ad copy in a kit's voice, for the creative editor (_lib/creativeCopy.ts).
  if (body.action === "copy") {
    return await handleCopy(sql, body, res);
  }
  // A picture from the kit, for the creative editor (_lib/creativeImage.ts).
  if (body.action === "image") {
    return await handleImage(sql, body, res);
  }
  const name = sanitizeText(String(body.name ?? "")).slice(0, MAX_KIT_NAME);
  if (!name) {
    return res.status(400).json({ error: "A kit needs a name" });
  }

  /* A sub-brand names its parent at creation. The one-level rule and the cycle
     check are enforced by the database (patch 032), so a bad parent is a
     rejected insert rather than something this handler has to re-litigate. */
  const parentId =
    typeof body.parentId === "string" && body.parentId ? body.parentId : null;

  let created: { id: string }[];
  try {
    created = await getDb()
      .insert(schema.brandKits)
      .values({ createdBy: user.userId, name, parentId })
      .returning({ id: schema.brandKits.id });
  } catch (e) {
    /* The trigger raises for a sub-brand of a sub-brand, which is a request
       problem rather than a server one — so it is reported as such. */
    const message = e instanceof Error ? e.message : "Could not create the kit";
    return res.status(400).json({ error: message });
  }

  const [kit] = created;
  if (!kit) {
    return res.status(500).json({ error: "Could not create the kit" });
  }

  /* The first version, when the caller sent one. Sanitised rather than trusted:
     the same call that names the kit may be carrying a whole document. */
  if (body.doc !== undefined) {
    await writeKitVersion(sql, kit.id, sanitizeKitDoc(body.doc));
  }

  /* Read back rather than assembled here: the resolved document and the list of
     inherited parts are the store's answer, and two places computing them is
     how they come to disagree. */
  return res.status(201).json(await loadKit(sql, kit.id));
}

async function serve(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  const sql = getSql();
  const user = getBearerUser(req.headers.authorization);
  try {
    if (req.method === "GET") {
      return await handleGet(sql, user, req, res);
    }
    if (req.method === "POST") {
      return await handlePost(sql, user, req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not load brand kits" });
  }
}

/*
 * Wrapped so the copy and image writers can reach Claude with this request's
 * Vercel identity rather than only the build's. See withRequestIdentity.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return withRequestIdentity(req.headers, () => serve(req, res));
}
