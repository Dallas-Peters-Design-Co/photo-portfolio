import { everyElement } from "../../config/conceptSlots.js";
import { stepsOf } from "../../config/conceptSteps.js";
import { cleanPageDesign, type PageBox } from "../../config/pageDesign.js";
import {
  cleanElement,
  MAX_CONCEPT_ELEMENTS,
} from "../../config/reviewConcept.js";
import { type McpTool, ToolError } from "./mcp.js";
import type { ToolCtx } from "./mcpTools.js";

const board = { description: "Board UUID from the canvas URL", type: "string" };
const getFrames: McpTool<ToolCtx> = {
  description:
    "Read page-builder frames on a board, including component IDs, slots, state triggers, boxes, and a revision for safe edits.",
  inputSchema: { properties: { board }, required: ["board"], type: "object" },
  name: "get_canvas_frames",
  run: async (args, { sql }) =>
    sql`SELECT id, body AS name, config->'pageDesign' AS page, md5(config::text) AS revision FROM board_items WHERE board_id::text = ${String(args.board)} AND kind = 'frame' AND config ? 'pageDesign' ORDER BY id`,
};

const append: McpTool<ToolCtx> = {
  description:
    "Append a configured review component (including its kit styleId and nested slots) to a page state. Read get_canvas_frames first. A stale frame is rejected.",
  inputSchema: {
    properties: {
      board,
      box: { required: ["x", "y", "width", "height"], type: "object" },
      element: { type: "object" },
      frame: { type: "string" },
      revision: { type: "string" },
      state: {
        description: "State ID, or first for the initial state",
        type: "string",
      },
    },
    required: ["board", "frame", "revision", "state", "element", "box"],
    type: "object",
  },
  name: "append_canvas_component",
  run: async (args, { sql }) => {
    const [row] =
      await sql`SELECT config->'pageDesign' AS page FROM board_items WHERE board_id::text=${String(args.board)} AND id::text=${String(args.frame)} AND kind='frame' AND md5(config::text)=${String(args.revision)}`;
    const page = cleanPageDesign(row?.page);
    if (!page) {
      throw new ToolError("Read the current frame and revision first.");
    }
    const steps = stepsOf(page.concept);
    const index =
      args.state === "first" ? 0 : steps.findIndex((s) => s.id === args.state);
    const step = steps[index];
    if (!step || step.elements.length >= MAX_CONCEPT_ELEMENTS) {
      throw new ToolError(
        "Choose an existing state with space for another component."
      );
    }
    const element = cleanElement(args.element);
    if (
      !args.element ||
      typeof args.element !== "object" ||
      !("kind" in args.element) ||
      element.kind !== args.element.kind
    ) {
      throw new ToolError("Choose a supported component kind.");
    }
    const box = args.box as PageBox | undefined;
    if (
      !(box && [box.x, box.y, box.width, box.height].every(Number.isInteger)) ||
      box.x < 0 ||
      box.y < 0 ||
      box.width < 1 ||
      box.height < 1 ||
      box.x + box.width > page.width ||
      box.y + box.height > page.height
    ) {
      throw new ToolError("Place the box within the frame.");
    }
    const ids = new Set(
      steps.flatMap((s) => everyElement(s.elements).map((e) => e.id))
    );
    for (const child of everyElement([element])) {
      if (ids.has(child.id)) {
        throw new ToolError("Component IDs must be unique in the frame.");
      }
      ids.add(child.id);
    }
    const path =
      index === 0
        ? ["pageDesign", "concept", "elements"]
        : ["pageDesign", "concept", "steps", String(index - 1), "elements"];
    const changed = await sql`WITH changed AS (
      UPDATE board_items SET config=jsonb_set(jsonb_set(config, ${path}::text[], coalesce(config #> ${path}::text[], '[]'::jsonb) || ${JSON.stringify([element])}::jsonb), '{pageDesign,boxes}', coalesce(config #> '{pageDesign,boxes}', '{}'::jsonb) || ${JSON.stringify({ [element.id]: box })}::jsonb)
      WHERE id::text=${String(args.frame)} AND board_id::text=${String(args.board)} AND md5(config::text)=${String(args.revision)} RETURNING board_id)
      UPDATE boards SET updated_at=now() FROM changed WHERE boards.id=changed.board_id RETURNING boards.id`;
    if (!changed.length) {
      throw new ToolError(
        "The frame changed. Read its latest revision before editing."
      );
    }
    return { element: element.id, frame: args.frame, state: step.id };
  },
  writes: true,
};

export const CANVAS_TOOLS = [getFrames, append];
