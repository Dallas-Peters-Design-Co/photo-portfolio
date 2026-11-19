import { stepsOf } from "./conceptSteps.js";
import { cleanConcept, type ReviewConcept } from "./reviewConcept.js";

export interface PageBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** A live UI page, kept on a frame and carried intact into its review. */
export interface PageDesign {
  boxes: Record<string, PageBox>;
  concept: ReviewConcept;
  height: number;
  kitId: string | null;
  version: 1;
  width: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.max(min, Math.min(max, value)))
    : fallback;

export const boxOf = (page: PageDesign, id: string, index = 0): PageBox =>
  page.boxes[id] ?? {
    height: 120,
    width: Math.min(360, page.width - 48),
    x: 24,
    y: Math.min(24 + index * 144, Math.max(0, page.height - 120)),
  };

export const cleanPageDesign = (value: unknown): PageDesign | null => {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1
  ) {
    return null;
  }
  const raw = value as Partial<PageDesign>;
  const width = bounded(raw.width, 320, 4096, 1440);
  const height = bounded(raw.height, 200, 12_000, 900);
  const concept = cleanConcept(raw.concept);
  const ids = new Set(
    stepsOf(concept).flatMap((step) => step.elements.map((e) => e.id))
  );
  const boxes: Record<string, PageBox> = {};
  for (const id of ids) {
    const box = raw.boxes?.[id];
    if (!box || typeof box !== "object") {
      continue;
    }
    const x = bounded(box.x, 0, width - 1, 0);
    // A shorter viewport can leave authored content below the fold.
    const y = bounded(box.y, 0, 11_999, 0);
    boxes[id] = {
      height: bounded(box.height, 1, 12_000 - y, Math.min(120, 12_000 - y)),
      width: bounded(box.width, 1, width - x, Math.min(320, width - x)),
      x,
      y,
    };
  }
  return {
    boxes,
    concept,
    height,
    kitId:
      typeof raw.kitId === "string" && UUID.test(raw.kitId) ? raw.kitId : null,
    version: 1,
    width,
  };
};

/** Stored board config has already passed the server cleaner. Keep its identity
 * while drawing; parsing it on every pointer move would clone the whole page. */
export const pageDesignOf = (
  config: Record<string, unknown> | null
): PageDesign | null => {
  const page = config?.pageDesign as PageDesign | undefined;
  return page?.version === 1 &&
    page.concept &&
    Number.isFinite(page.width) &&
    Number.isFinite(page.height)
    ? page
    : null;
};
