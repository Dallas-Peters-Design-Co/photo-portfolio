import type { BrandComponent } from "../src/boards/components/model.js";
import { cleanProps } from "./canvasComponentProps.js";
import { bounded } from "./conceptValues.js";
import { cleanKitShader } from "./kitShaders.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "./reviewConcept.js";

const KINDS = new Set(["text", "note", "reference", "photo", "drawing"]);
const ID = /^[a-zA-Z0-9_-]{1,64}$/;

const plainJson = (value: unknown, depth = 0): boolean => {
  if (depth > 8) {
    return false;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => plainJson(item, depth + 1));
  }
  return (
    typeof value === "object" &&
    Object.values(value).every((item) => plainJson(item, depth + 1))
  );
};

/** A bounded, self-contained copy of a canvas component for a review. */
export const cleanReviewCanvasComponent = (
  value: unknown
): BrandComponent | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Partial<BrandComponent>;
  if (
    typeof raw.id !== "string" ||
    !ID.test(raw.id) ||
    typeof raw.name !== "string" ||
    raw.name.length > 120 ||
    typeof raw.width !== "number" ||
    !Number.isFinite(raw.width) ||
    raw.width <= 0 ||
    raw.width > 100_000 ||
    typeof raw.height !== "number" ||
    !Number.isFinite(raw.height) ||
    raw.height <= 0 ||
    raw.height > 100_000 ||
    !Array.isArray(raw.layers) ||
    raw.layers.length === 0 ||
    raw.layers.length > 120 ||
    !plainJson(raw.layers) ||
    JSON.stringify(raw.layers).length > 400_000
  ) {
    return null;
  }
  if (
    !raw.layers.every(
      (layer) =>
        layer &&
        typeof layer === "object" &&
        typeof layer.lid === "string" &&
        ID.test(layer.lid) &&
        KINDS.has(layer.kind) &&
        [layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) &&
        (layer.imageUrl === null || typeof layer.imageUrl === "string") &&
        (layer.thumbUrl === null || typeof layer.thumbUrl === "string") &&
        (layer.body === null || typeof layer.body === "string") &&
        (layer.fontSize === null ||
          (typeof layer.fontSize === "number" &&
            Number.isFinite(layer.fontSize))) &&
        (layer.config === null ||
          (typeof layer.config === "object" && !Array.isArray(layer.config))) &&
        layer.width > 0 &&
        layer.height > 0
    )
  ) {
    return null;
  }
  return {
    height: raw.height,
    id: raw.id,
    kitId: typeof raw.kitId === "string" ? raw.kitId.slice(0, 64) : "",
    layers: raw.layers,
    name: raw.name,
    placement: {},
    props: cleanProps(raw.props),
    updatedAt: "",
    width: raw.width,
  };
};

export const cleanCanvas = (
  raw: Partial<ReviewConceptElement>,
  kind: ReviewConceptElementKind
) => {
  const canvasComponent =
    kind === "canvas" ? cleanReviewCanvasComponent(raw.canvasComponent) : null;
  if (kind !== "canvas" && kind !== "shader") {
    return {};
  }
  const shader = kind === "shader" ? cleanKitShader(raw.shader) : null;
  const size = raw.canvasSize;
  return {
    ...(shader ? { shader } : {}),
    ...(canvasComponent ? { canvasComponent } : {}),
    ...(size && Number.isFinite(size.width) && Number.isFinite(size.height)
      ? {
          canvasSize: {
            height: bounded(size.height, 1, 100_000, 1),
            width: bounded(size.width, 1, 100_000, 1),
          },
        }
      : {}),
  };
};
