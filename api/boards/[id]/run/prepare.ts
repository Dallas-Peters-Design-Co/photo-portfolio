/**
 * Everything that happens before the third-party call.
 *
 * Split out of run.ts, which was 524 lines against a 500-line ceiling. This is
 * the half that decides whether a run can happen at all and what it would
 * consist of; run.ts keeps the half that serves the request and records the
 * result.
 */
import {
  type FalModelDef,
  falModelInput,
  isFalModel,
} from "../../../../config/falModels.js";
import { hasCycle } from "../../../../config/graph.js";
import { wantsBlend } from "../../../../config/nodes/generate.js";
import { nodeTypeFor } from "../../../../config/nodeTypes.js";
import type { BoardItemRow, BoardWireRow } from "../../../_lib/boards.js";
import {
  elementStyleOf,
  jobsFor,
  withElementWords,
} from "../../../_lib/elementStyle.js";
import { falAcceptsImageList } from "../../../_lib/falEndpoint.js";
import { unconfiguredProvider } from "./capabilities.js";
import { fingerprintFor } from "./fingerprint.js";
import {
  maskByUrl,
  promptFor,
  type RunnableItem,
  resolveInputs,
} from "./inputs.js";
import { outputsOf } from "./outputs.js";
import { unmetRequirement, validatedJobs } from "./refusals.js";
import { type Prepared, refuse, reply } from "./replies.js";
import { asObject, toGraphItems, toGraphWires } from "./rows.js";

/**
 * Whether this run blends its pictures into one, which takes two yeses.
 *
 * The node has to ask. Blending used to be automatic, and automatic turned
 * every batch into a single run — wiring a frame of twenty references in is
 * how a batch is run here, so the default stays separate and a blend is
 * chosen.
 *
 * And the endpoint has to be able to. Read from the *resolved* endpoint rather
 * than the model named on the node: a LoRA and a mask both send the run
 * somewhere that takes one picture whatever the row declares, and "auto" with
 * a picture wired in lands on nano-banana's edit model, which takes a list.
 * Only the endpoint knows.
 */
const blendsPictures = (args: {
  config: Record<string, unknown>;
  hasSourceImage: boolean;
  masking: boolean;
  models: readonly FalModelDef[];
  requestedModel: string | null;
}): boolean => wantsBlend(args.config) && falAcceptsImageList(args);

export const prepare = async (
  rows: BoardItemRow[],
  wireRows: BoardWireRow[],
  itemId: string,
  force: boolean,
  models: readonly FalModelDef[]
): Promise<Prepared> => {
  const row = rows.find((candidate) => candidate.id === itemId);
  if (row?.kind !== "op" || !row.node_type) {
    // Not recorded: there is either no such row, or one that is not a node of
    // ours, and writing a run failure onto a photograph would be a worse lie
    // than the silence.
    return reply(404, { error: "Node not found on this board" });
  }

  const type = nodeTypeFor(row.node_type);
  if (!type) {
    return refuse(404, { error: "Unknown node type" });
  }
  // A Prompt node holds a value rather than producing one. Asking to run it is
  // a client bug, not a user error, so it is refused rather than quietly
  // succeeding as a no-op.
  if (!type.capability) {
    return refuse(422, {
      error: `A ${type.label} node holds its value; there is nothing to run.`,
    });
  }

  // Checked again here, not only on save: a graph that cannot be ordered cannot
  // be run, and finding that out before spending anything is free.
  if (hasCycle(toGraphItems(rows), toGraphWires(wireRows))) {
    return refuse(400, { error: "This board's connections form a loop." });
  }

  const item: RunnableItem = {
    config: asObject(row.config),
    id: row.id,
    nodeType: row.node_type,
    result: asObject(row.result),
    runState: row.run_state ?? null,
  };

  const { lists, missingPort, values } = resolveInputs(item, rows, wireRows);
  if (missingPort) {
    // Say what is on the other end of the wire, if anything: "needs its art
    // input" with a wire plainly attached sent people checking the wire, when
    // the thing to check was whatever the wire came from.
    const feeding = wireRows.filter(
      (wire) =>
        wire.target_item_id === item.id && wire.target_port === missingPort
    );
    const sources = feeding
      .map((wire) => rows.find((row) => row.id === wire.source_item_id))
      .map((row) =>
        row
          ? `${row.node_type ?? row.kind} ${row.id.slice(0, 8)} → ${outputsOf(row, rows, toGraphWires(wireRows)).length} picture(s)`
          : "a missing item"
      );
    return refuse(422, {
      error:
        sources.length === 0
          ? `This node needs its ${missingPort} input before it can run — nothing is wired into it.`
          : `This node needs its ${missingPort} input before it can run — wired from ${sources.join(", ")}.`,
      missingPort,
    });
  }

  // An explicit model is checked against the loaded list rather than
  // forwarded: the value reaches fal, and an unknown id is a request that fails
  // after it has been paid for. An unrecognised choice falls back to "auto".
  const model = isFalModel(models, item.config.model)
    ? (item.config.model as string)
    : null;
  const shape = falModelInput(models, model ?? "auto");

  const prompt = promptFor(item, values);
  const element = elementStyleOf(item.id, rows, wireRows);

  const masks = maskByUrl(rows);
  const masked = (values.image ?? []).some((url) => masks.has(url));
  /*
   * What was wired in, minus the elements. A cover arrives on the image port
   * like any other picture and every rule below asks "is there an image?", so
   * a node with only a style wired looked fully wired — and an edit model
   * handed that cover returned it. Subtracted before the refusals, not in
   * jobsFor, which runs after them.
   */
  const covers = new Set(element.images);
  const subjects = (values.image ?? []).filter((url) => !covers.has(url));
  const unmet = unmetRequirement(
    shape,
    model,
    // The composed prompt, so a node whose only words come from a wired element
    // is not refused for having none.
    withElementWords(prompt, element.words),
    { ...values, image: subjects },
    masked,
    type.capability,
    models
  );
  if (unmet) {
    return refuse(422, unmet);
  }

  const unconfigured = unconfiguredProvider(type.capability);
  if (unconfigured) {
    return unconfigured;
  }

  // Every wired image becomes a job, validated before forwarding: these URLs go
  // to a third party to fetch. Analyse is the exception — its job is to look
  // and say what it sees, so style words would hand it its own answer.
  //
  // The brief wins over the description. A description seeded from a Describe
  // node set to "subject" reads "a digital painting of a person's head and
  // shoulders", which appended to a restyle prompt tells the model to draw that
  // person. A brief cannot: read under `focus: "style"`, it may not name a
  // subject. `jobsFor` has already placed the briefs, so the description is
  // only the fallback for an element not yet read.
  const styleWords = element.briefs.length > 0 ? [] : element.words;
  const wordsForJobs = type.capability === "fal.describe" ? [] : styleWords;
  const { dropped, jobs } = validatedJobs(
    // Every job carries the wired elements' words, whether its prompt was typed
    // on the node or arrived down a wire. Applied here rather than inside
    // jobsFor because it is true of every prompt that function can produce, and
    // a Prompt node wired in alongside an element is the ordinary arrangement —
    // appending only to the typed fallback would drop the style in exactly the
    // case elements exist for.
    jobsFor({
      blends: blendsPictures({
        config: item.config,
        hasSourceImage: subjects.length > 0,
        masking: masked,
        models,
        requestedModel: model,
      }),
      briefs: element.briefs,
      capability: type.capability,
      config: item.config,
      elementImages: element.images,
      lists,
      masks,
      shape,
      typedPrompt: prompt,
      values,
    }).map((job) => ({
      ...job,
      prompt: withElementWords(job.prompt, wordsForJobs),
    }))
  );
  // Refused only when nothing survived. A batch reduced to nothing has no work
  // left to do, whereas one that lost a single unusable address still has
  // nineteen pictures to get on with.
  if (jobs.length === 0) {
    return refuse(422, {
      error: "A wired image is not a public http(s) URL",
    });
  }

  // Nothing has changed since the stored result, so producing it again would
  // cost money to arrive at the same images. A batch is only skipped once every
  // variation is present — a run cancelled halfway resumes rather than being
  // treated as finished.
  const fingerprint = await fingerprintFor(item, values, element);
  const stored = asObject(item.result);
  const done = Array.isArray(stored.variations)
    ? (stored.variations as unknown[]).filter(Boolean).length
    : 0;
  if (
    !force &&
    item.runState === "succeeded" &&
    stored.fingerprint === fingerprint &&
    done >= jobs.length
  ) {
    return reply(200, {
      itemId,
      result: item.result,
      runError: null,
      runState: "succeeded",
      skipped: true,
      skippedVectors: dropped,
      variationCount: jobs.length,
    });
  }

  return {
    body: null,
    ready: {
      capability: type.capability,
      fingerprint,
      item,
      jobs,
      model,
      prompt,
      skippedVectors: dropped,
      sourceImageUrls: values.image ?? [],
    },
    record: null,
    status: null,
  };
};
