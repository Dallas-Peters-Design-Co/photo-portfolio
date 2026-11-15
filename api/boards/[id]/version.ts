import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  resultVersions,
  withoutResultVersion,
} from "../../../config/resultVersions.js";
import { getBearerUser } from "../../_lib/auth.js";
import {
  BoardResultError,
  sendBoardResultError,
  updateBoardResult,
} from "../../_lib/boardResult.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { parseJsonBody } from "../../_lib/parseBody.js";

/**
 * Removes one version from a node's history.
 *
 * Its own endpoint rather than part of saving the board, because `result` is
 * not the canvas's to write. The board save deliberately leaves that column
 * alone: a debounced autosave carrying a pre-run copy would otherwise land
 * after a generation finished and erase an image that had just been paid for.
 * Deleting a version is the one case where the canvas genuinely does mean to
 * change a result, so it says so explicitly, here.
 *
 * `selectedVersion` is not touched. That lives in `config`, which the canvas
 * does own, so the client adjusts it — mixing the two here would reintroduce
 * exactly the race the split exists to prevent.
 */

interface StoredResult extends Record<string, unknown> {
  history?: { url?: string }[];
  url?: string;
  variations?: { url?: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const raw = req.query.id;
  const boardId = Array.isArray(raw) ? raw[0] : raw;
  const body = parseJsonBody(req.body) as {
    index?: unknown;
    itemId?: unknown;
    url?: unknown;
  };
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const index = Number(body.index);
  const hasTarget = Boolean(boardId && itemId);
  if (!(hasTarget && Number.isInteger(index) && index >= 0)) {
    return res
      .status(400)
      .json({ error: "An item and a version are required" });
  }

  const sql = getSql();
  // Resolve legacy index-only requests once; retries must keep the same target.
  let targetUrl = typeof body.url === "string" ? body.url : null;
  try {
    const result = await updateBoardResult(sql, boardId, itemId, (previous) => {
      const stored = previous as StoredResult | null;
      targetUrl ??= resultVersions(stored)[index]?.url ?? null;
      if (!targetUrl) {
        throw new BoardResultError("No such version", 404);
      }
      return withoutResultVersion(stored, targetUrl);
    });

    return res.status(200).json({
      count: resultVersions(result as StoredResult | null).length,
      result,
    });
  } catch (error) {
    return sendBoardResultError(res, error, "Could not remove that version");
  }
}
