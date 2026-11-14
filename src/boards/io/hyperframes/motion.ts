import type { StudioParam, StudioValues } from "../../studio/types";

/**
 * How a Studio picture moves in a video: worked out from its tool, drawn
 * again on every frame from its own settings (runtime.ts), so the motion is
 * the tool's, not a model's guess at it.
 *
 * - `drift`: tools shaped by a field (field.ts) have it move: a radial
 *   centre circles, waves travel, blobs orbit, noise breathes. It comes back
 *   to where it started, so a video of one cycle loops.
 * - `sway`: settings that swing either side of where they were set (an
 *   iso view turning, a screen angle rocking), back by the end of the cycle.
 * - `build`: the order the picture's marks appear when it builds in.
 *
 * Everything is a function of the phase (0 to 1 over the loop) and the
 * amount (1 as made, 0 still), never of the frame before, because
 * HyperFrames draws each frame on its own.
 */

export type BuildOrder = "across" | "none" | "out" | "rise";

export interface StudioMotion {
  build: BuildOrder;
  drift: boolean;
  /**
   * A tool that moves its own parts (Flow's lanes running, its scatter
   * drifting in): the setting prefix it reads the loop from, as
   * `<prefix>Phase` and `<prefix>Motion`.
   */
  own?: string;
  sway: { by: number; key: string }[];
}

const STILL: StudioMotion = { build: "none", drift: false, sway: [] };

export const MOTION_FOR: Record<string, StudioMotion> = {
  blobs: { build: "none", drift: false, sway: [{ by: 20, key: "wobble" }] },
  dither: {
    build: "across",
    drift: false,
    sway: [{ by: 12, key: "brightness" }],
  },
  flow: { build: "across", drift: false, own: "flow", sway: [] },
  gradient: { build: "none", drift: false, sway: [{ by: 30, key: "angle" }] },
  "grid-boxes": { build: "across", drift: false, sway: [] },
  halftone: { build: "out", drift: true, sway: [{ by: 10, key: "angle" }] },
  "iso-blocks": { build: "rise", drift: true, sway: [{ by: 18, key: "turn" }] },
  "line-waves": {
    build: "rise",
    drift: true,
    sway: [{ by: 2, key: "amplitude" }],
  },
  mesh: { build: "none", drift: false, sway: [{ by: 12, key: "scale" }] },
  mosaic: { build: "across", drift: false, sway: [] },
  pattern: { build: "across", drift: false, sway: [{ by: 8, key: "angle" }] },
  "pixel-field": {
    build: "across",
    drift: true,
    sway: [{ by: 6, key: "cutoff" }],
  },
  radial: { build: "out", drift: false, sway: [{ by: 25, key: "twist" }] },
  "type-echo": {
    build: "rise",
    drift: false,
    sway: [{ by: 10, key: "squash" }],
  },
};

export const motionFor = (tool: string): StudioMotion =>
  MOTION_FOR[tool] ?? STILL;

const TAU = Math.PI * 2;

/** A setting's range, so a sway never pushes it past what the tool allows. */
const rangeOf = (
  params: StudioParam[],
  key: string
): { max: number; min: number } | null => {
  const param = params.find((p) => p.key === key);
  return param && param.type === "range"
    ? { max: param.max, min: param.min }
    : null;
};

/** Turns go all the way round; other settings stop at their ends. */
const WRAPS = new Set(["angle", "turn"]);

/**
 * The settings at a point in the loop. At phase 0 (and 1) they're the
 * settings as made, so the first frame is the picture on the board.
 */
export const valuesAt = (
  values: StudioValues,
  params: StudioParam[],
  motion: StudioMotion,
  phase: number,
  amount: number
): StudioValues => {
  if (amount <= 0) {
    return values;
  }
  const next: StudioValues = { ...values };
  const swing = Math.sin(TAU * phase);
  for (const { by, key } of motion.sway) {
    const range = rangeOf(params, key);
    const base = Number(values[key]);
    if (!(range && Number.isFinite(base))) {
      continue;
    }
    const raw = base + by * amount * swing;
    const span = range.max - range.min;
    next[key] = WRAPS.has(key)
      ? range.min + ((((raw - range.min) % span) + span) % span)
      : Math.min(range.max, Math.max(range.min, raw));
  }
  if (motion.drift) {
    next.fieldDrift = amount;
    next.fieldPhase = phase;
  }
  if (motion.own) {
    next[`${motion.own}Motion`] = amount;
    next[`${motion.own}Phase`] = phase;
  }
  return next;
};

/** How far a build-in has got, 0 to 1, eased out, `t` seconds in. */
export const builtAt = (t: number, start: number, length: number): number => {
  if (length <= 0) {
    return 1;
  }
  const x = Math.max(0, Math.min(1, (t - start) / length));
  return 1 - (1 - x) ** 3;
};

/**
 * How visible each mark is when `built` of the build is done: the marks in
 * build order (`rank`, 0 first, of `count`), each fading in over a short
 * stretch so the front of the build is soft rather than a hard edge.
 */
export const markShown = (
  rank: number,
  count: number,
  built: number,
  soft = 0.08
): number => {
  if (built >= 1 || count <= 1) {
    return built > 0 ? 1 : 0;
  }
  const at = rank / count;
  return Math.max(0, Math.min(1, (built * (1 + soft) - at) / soft));
};

/** A mark's place in the build order, from the centre of its box (0–1). */
export const buildKey = (order: BuildOrder, cx: number, cy: number): number => {
  if (order === "rise") {
    return 1 - cy;
  }
  if (order === "out") {
    return Math.hypot(cx - 0.5, cy - 0.5);
  }
  return cx + cy * 0.15;
};
