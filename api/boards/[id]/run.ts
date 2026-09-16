import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../../_lib/auth.js";
import type { BoardItemRow, BoardWireRow } from "../../_lib/boards.js";
import { brandVersionOf, withBrandKits } from "../../_lib/brandBrief.js";
import { brandLogoOf } from "../../_lib/brandLogo.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { withElements } from "../../_lib/elementBrief.js";
import { loadModelDefs } from "../../_lib/modelStore.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { withRequestIdentity } from "../../_lib/requestIdentity.js";
import { produce } from "./run/capabilities.js";
import { paletteHexesOf } from "./run/outputs.js";
import { prepare } from "./run/prepare.js";
import { type Sql, saveFailure, setRunning } from "./run/replies.js";
import { buildResult, stampProvenance } from "./run/results.js";
import { asObject, toGraphWires } from "./run/rows.js";

/**
 * Runs exactly one node on a board.
 *
 * One node per request, no state between them: a single generation budgets
 * close to two minutes (120s in api/_lib/fal.ts, 110s in magnific.ts) against
 * a serverless ceiling, so a chain fits in no call the platform allows. The
 * browser walks the graph in order and calls this once per node.
 *
 * Admin-only, deliberately: every call spends money. Publishing a board does
 * not open this — an anonymous caller gets a 401 either way.
 */

/*
 * The geometry columns are not optional. A frame contains its pictures by
 * sitting under them — see containedBy — and outputsOf works that out from
 * x, y, width and height. Without them every frame resolved to nothing on
 * the server, so a node fed through a frame (or a Batch fed by one) was
 * refused for a missing input while the canvas, which has the geometry,
 * showed twelve pictures on the wire.
 */
const loadItems = async (sql: Sql, boardId: string) =>
  (await sql`
    SELECT i.id, i.kind, i.body, i.image_url, i.node_type, i.config,
           i.result, i.run_state, i.photo_id,
           i.x, i.y, i.width, i.height, i.z_index,
           p.url AS photo_url
    FROM board_items i
    LEFT JOIN photos p ON p.id = i.photo_id
    WHERE i.board_id = ${boardId}
  `) as BoardItemRow[];

const loadWires = async (sql: Sql, boardId: string) =>
  (await sql`
    SELECT id, source_item_id, source_port, target_item_id, target_port
    FROM board_wires
    WHERE board_id = ${boardId}
  `) as BoardWireRow[];

/** One image in a node's result. Mirrors BoardItemVariation in src/types.ts. */

/**
 * Why this model cannot run on this wiring, or null when it can.
 *
 * Checked here rather than left to fal, which only reports a mismatched body
 * after the call has been billed. Each model declares what it consumes, so an
 * unwired vectoriser or a promptless generation is refused for free.
 */

/**
 * Everything that can refuse a run, in the order that costs least.
 *
 * Separated from the handler so each is one flat check rather than another
 * level of nesting, and so the order — cheapest and most certain first, the
 * expensive third-party call last — is visible at a glance.
 */

/**
 * What the request is asking for, or a reason it cannot be read.
 *
 * Pulled out of the handler because validating a request and performing one are
 * different jobs, and doing both in one function had grown past what a reader
 * can hold — the batching added a third thing to check.
 */
const readRequest = (
  req: VercelRequest
):
  | { boardId: string; force: boolean; itemId: string; variation: number }
  | string => {
  const raw = req.query.id;
  const boardId = Array.isArray(raw) ? raw[0] : raw;
  if (!boardId) {
    return "A board id is required";
  }
  const body = parseJsonBody(req.body);
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  if (!itemId) {
    return "An item id is required";
  }
  // Which variation of a batch to produce. One per request, because four
  // variations at two minutes each could no more fit in one function call than
  // a four-node chain could — the same ceiling, the same answer.
  const variation = Number.isFinite(Number(body.variation))
    ? Math.max(0, Math.trunc(Number(body.variation)))
    : 0;
  return { boardId, force: body.force === true, itemId, variation };
};

const serve = async (req: VercelRequest, res: VercelResponse) => {
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

  const asked = readRequest(req);
  if (typeof asked === "string") {
    return res.status(400).json({ error: asked });
  }
  const { boardId, force, itemId, variation } = asked;

  const sql = getSql();

  try {
    const [rows, wireRows, models] = await Promise.all([
      loadItems(sql, boardId)
        .then((items) => withElements(sql, items))
        // Both fold library rows onto the board's own before anything
        // walks the graph, so singleOutputOf finds plain values and
        // nothing downstream knows a library was involved.
        .then((items) => withBrandKits(sql, items)),
      loadWires(sql, boardId),
      loadModelDefs(),
    ]);

    const prepared = await prepare(rows, wireRows, itemId, force, models);
    if (prepared.ready === null) {
      // Written before the response, so the node explains itself on reload and
      // a mis-wired board can be found by querying rather than by clicking.
      if (prepared.record) {
        await saveFailure(sql, itemId, prepared.record);
      }
      return res.status(prepared.status).json(prepared.body);
    }
    const {
      capability,
      fingerprint,
      item,
      jobs,
      model,
      prompt,
      skippedVectors,
      sourceImageUrls,
    } = prepared.ready;

    if (variation >= jobs.length) {
      const error = "That variation is past the end of this batch.";
      await saveFailure(sql, itemId, error);
      return res.status(422).json({ error });
    }

    await setRunning(sql, itemId);

    try {
      const produced = await produce(capability, models, {
        // The other pictures of a blend, empty for every single-picture run.
        // See jobsFor: only an endpoint that takes a list is ever given one.
        blendImageUrls: jobs[variation]?.blendWith ?? [],
        /* The mark a wired Brand node offers, read off the same rows the brand
           words came from. Resolved per run rather than hoisted, because a
           board edited between variations should stamp what it now says. */
        brandLogo: brandLogoOf(itemId, rows, wireRows),
        item,
        model,
        /* The exact colours, for the endpoints that take a real palette. The
           words for every other model are already in the prompt. */
        palette: paletteHexesOf(itemId, rows, toGraphWires(wireRows)),
        // Per variation, because an Iterate node upstream gives each run its
        // own prompt — the node's own text is only the fallback.
        prompt: jobs[variation]?.prompt ?? prompt,
        sourceImageUrl: jobs[variation]?.image ?? null,
        sourceImageUrls,
        sourceMaskUrl: jobs[variation]?.mask ?? null,
        variation,
      });

      const previous = asObject(item.result);

      const result = buildResult(
        produced,
        previous,
        fingerprint,
        variation,
        jobs.length,
        // FR-006. Recorded from what was actually sent rather than from what the
        // node holds: an Iterate node upstream rewrites the prompt per run, and
        // a stamp naming the typed one would describe a job nobody ran.
        stampProvenance({
          // Which brand governed this, so "what made this picture" stays
          // answerable after the kit has been edited. Read off the rows the
          // run resolved rather than the wires — see brandVersionOf.
          brandKitVersionId: brandVersionOf(rows),
          inputs: [
            jobs[variation]?.image,
            jobs[variation]?.mask,
            ...sourceImageUrls,
          ].filter((url): url is string => typeof url === "string"),
          model,
          prompt: jobs[variation]?.prompt ?? prompt ?? null,
          settings: item.config,
        })
      );

      await sql`
        UPDATE board_items
        SET result = ${JSON.stringify(result)}::jsonb,
            run_state = 'succeeded',
            run_error = NULL
        WHERE id = ${itemId}
      `;

      return res.status(200).json({
        itemId,
        result,
        runError: null,
        runState: "succeeded",
        skipped: false,
        skippedVectors,
        variationCount: jobs.length,
      });
    } catch (e) {
      console.error(e);
      const message =
        e instanceof Error ? e.message : "Could not run this node";
      // Recorded, so the failure survives a reload and the node explains itself
      // rather than merely looking un-run.
      await saveFailure(sql, itemId, message);
      // The batch size travels with the error: a client whose *first* job just
      // failed still has to know how many jobs the run describes, or it cannot
      // continue with the rest of them.
      return res
        .status(502)
        .json({ error: message, variationCount: jobs.length });
    }
  } catch (e) {
    console.error(e);
    // The message, not a shrug. Everything before the inner try — resolving the
    // board's rows, reading the elements they point at, ordering the graph —
    // fails here, and answering "Could not run this node" to a missing column
    // or an unorderable graph sends whoever is looking at the node to read the
    // server log, which on a deployed build they cannot do.
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Could not run this node",
    });
  }
};

/*
 * Wrapped so Claude can be reached without a key.
 *
 * A run writes element briefs before it generates, and a brief is a vision call — see describeImage.
 * The identity Vercel signs arrives as a request header, so the scope has to
 * be opened here — at the door — rather than passed down through every layer
 * that does not use it. See withRequestIdentity.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return withRequestIdentity(req.headers, () => serve(req, res));
}
