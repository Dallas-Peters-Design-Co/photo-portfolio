import type { StudioValues } from "../types";

/**
 * Systems Flow in motion (a video, io/hyperframes), after the AI Services
 * page on rolemodelsoftware.com: a funnel runs behind the whole piece. On
 * the side the flow comes from, a wide loose cloud of pixels in the scatter
 * colours (hours) drifts in; it narrows into a cone, picking up speed and
 * the type's colours, and leaves the throat as a tight bundle of ordered
 * lanes (assets). The letters sit in front and fill as the flow runs past
 * them, then stay filled.
 *
 * Read from `flowPhase` (0 to 1 over the loop), `flowMotion` (how much; 0
 * is still) and `flowFill` (how far the letters have filled, 0 to 1; 1 if
 * not given). Each pixel goes round a whole number of times per loop, so
 * the loop joins up, and everything is worked out from these alone, since
 * a video draws every frame on its own.
 */

export type FlowDir = "bottom" | "left" | "right" | "top";

/** What the motion needs to know about the piece (flow.ts's setup). */
export interface FlowShape {
  /** The type's own pixel at a cell, from the given random numbers. */
  body: (c: number, r: number, rand: () => number) => string | null;
  cols: number;
  dir: FlowDir;
  /** Where the type is: the letters, or round them when they're cut out. */
  inType: (c: number, r: number) => boolean;
  loose: string[];
  rows: number;
  shape: string[];
}

export interface FlowMotion {
  amount: number;
  fill: number;
  phase: number;
}

export const flowMotionOf = (v: StudioValues): FlowMotion | null => {
  const amount = Number(v.flowMotion) || 0;
  if (amount <= 0) {
    return null;
  }
  const fill = v.flowFill === undefined ? 1 : Number(v.flowFill);
  return {
    amount,
    fill: Number.isFinite(fill) ? Math.max(0, Math.min(1, fill)) : 1,
    phase: (((Number(v.flowPhase) || 0) % 1) + 1) % 1,
  };
};

const TAU = Math.PI * 2;

/** A repeatable random number from two whole numbers, a seed and a salt. */
export const hashAt = (a: number, b: number, seed: number, k: number) => {
  const x =
    Math.sin(a * 12.9898 + b * 78.233 + seed * 37.719 + k * 4.581) *
    43_758.5453;
  return x - Math.floor(x);
};

/** A cell's own run of random numbers, the same every time it's asked. */
const randomsAt = (c: number, r: number, seed: number) => {
  let k = 0;
  return () => {
    k += 1;
    return hashAt(c, r, seed, k);
  };
};

/** The colour at `a` of its own opacity, so a see-through colour stays so. */
export const withAlpha = (colour: string, a: number) => {
  const own =
    colour.length === 9 ? Number.parseInt(colour.slice(7, 9), 16) / 255 : 1;
  const k = Math.max(0, Math.min(1, a * own));
  return `${colour.slice(0, 7)}${Math.round(k * 255)
    .toString(16)
    .padStart(2, "0")}`;
};

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

const runsAcross = (f: FlowShape) => f.dir === "left" || f.dir === "right";

/** A cell from a place along the flow (0 where it starts) and across it. */
const cellOf = (
  f: FlowShape,
  along: number,
  across: number
): [number, number] => {
  const a = (n: number) => Math.floor(along * n);
  const b = (n: number) => Math.floor(across * n);
  if (f.dir === "left") {
    return [a(f.cols), b(f.rows)];
  }
  if (f.dir === "right") {
    return [f.cols - 1 - a(f.cols), b(f.rows)];
  }
  if (f.dir === "top") {
    return [b(f.cols), a(f.rows)];
  }
  return [b(f.cols), f.rows - 1 - a(f.rows)];
};

/** Where a cell is along the flow, 0 where it starts and 1 where it ends. */
const alongAt = (f: FlowShape, c: number, r: number) => {
  if (f.dir === "left") {
    return (c + 0.5) / f.cols;
  }
  if (f.dir === "right") {
    return 1 - (c + 0.5) / f.cols;
  }
  if (f.dir === "top") {
    return (r + 0.5) / f.rows;
  }
  return 1 - (r + 0.5) / f.rows;
};

/** Where the funnel narrows to, along the flow. */
const THROAT = 0.8;
/** Where it starts to narrow: the cloud stays wide for the first part. */
const MOUTH = 0.3;

interface Funnel {
  /** The middle of the throat, across the flow (0 to 1). */
  centre: number;
  /** How many lanes come out of the throat. */
  lanes: number;
  /** Half the throat's width, across the flow. */
  throat: number;
}

/** The funnel, centred on the type so the lanes run out level with it. */
const funnelOf = (f: FlowShape): Funnel => {
  const across = runsAcross(f);
  const n = across ? f.rows : f.cols;
  let low = n;
  let high = -1;
  for (let r = 0; r < f.rows; r += 1) {
    for (let c = 0; c < f.cols; c += 1) {
      if (f.inType(c, r)) {
        const j = across ? r : c;
        low = Math.min(low, j);
        high = Math.max(high, j);
      }
    }
  }
  const centre = high < 0 ? 0.5 : (low + high + 1) / 2 / n;
  const throat = 0.1;
  return {
    centre,
    lanes: Math.max(3, Math.round((throat * 2 * n) / 2)),
    throat,
  };
};

/** The path runs a little past both edges, so pixels enter and leave. */
const START = -0.06;
const END = 1.06;
const SAMPLES = 400;

/** How fast a pixel goes at a point: drifting in the cloud, quick in the lanes. */
const paceAt = (x: number) => 0.45 + 2.2 * smooth((x - 0.3) / (THROAT - 0.3));

/**
 * The time taken to reach each point along the path, 0 to 1 over a lap,
 * so a pixel's place at any moment can be looked up.
 */
const timetable = (() => {
  const at = new Float32Array(SAMPLES + 1);
  let total = 0;
  for (let i = 0; i <= SAMPLES; i += 1) {
    at[i] = total;
    total += 1 / paceAt(START + ((END - START) * i) / SAMPLES);
  }
  return at.map((t) => t / total);
})();

/** Where along the path a pixel is, `u` of the way through its lap. */
const placeAt = (u: number): number => {
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((timetable[mid] ?? 0) <= u) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return START + ((END - START) * lo) / SAMPLES;
};

interface Pixel {
  across: number;
  along: number;
  colour: string;
  /** How long a trail it leaves, in cells. */
  trail: number;
}

/** Across the flow for a pixel: loose in the cloud, in its lane out of the throat. */
const acrossOf = (
  funnel: Funnel,
  along: number,
  slot: number,
  drift: number
) => {
  const squeeze = smooth((along - MOUTH) / (THROAT - MOUTH)) ** 1.4;
  const half = 0.55 + (funnel.throat - 0.55) * squeeze;
  const lane =
    ((Math.floor(((slot + 1) / 2) * funnel.lanes) + 0.5) / funnel.lanes) * 2 -
    1;
  const ordered = squeeze ** 3;
  const place = slot + (lane - slot) * ordered;
  const centre = 0.5 + (funnel.centre - 0.5) * squeeze;
  return centre + place * half + drift * 0.05 * (1 - squeeze);
};

/** One travelling pixel at this moment. */
const pixelOf = (
  f: FlowShape,
  funnel: Funnel,
  m: FlowMotion,
  seed: number,
  i: number
): Pixel => {
  const h = (k: number) => hashAt(i, 5, seed, k);
  const laps = h(1) < 0.35 ? 2 : 1;
  const along = placeAt((h(2) + laps * m.phase) % 1);
  const across = acrossOf(funnel, along, h(3) * 2 - 1, h(4) * 2 - 1);
  const warm = smooth((along - 0.25) / 0.45);
  const palette = h(5) < warm ? f.shape : f.loose;
  const colour =
    palette[Math.floor(h(6) * palette.length)] ?? f.shape.at(-1) ?? "#ffffff";
  const brightness = 0.55 + 0.45 * smooth((along - MOUTH) / (THROAT - MOUTH));
  return {
    across,
    along,
    colour: withAlpha(colour, brightness),
    trail: Math.round(paceAt(along) * 1.6),
  };
};

/** Draws a pixel and the short trail behind it, faster ones longer. */
const trailCells = (
  f: FlowShape,
  p: Pixel,
  span: number,
  put: (c: number, r: number, colour: string) => void
) => {
  if (p.across < 0 || p.across >= 1) {
    return;
  }
  for (let t = p.trail; t >= 0; t -= 1) {
    const along = p.along - t / span;
    if (along >= 0 && along < 1) {
      const [c, r] = cellOf(f, along, p.across);
      put(c, r, t === 0 ? p.colour : withAlpha(p.colour, 0.5 / t));
    }
  }
};

/**
 * Whether the flow has filled a letter cell yet: the fill sweeps along the
 * flow with a ragged front, so the letters fill as it runs past.
 */
const filledAt = (
  f: FlowShape,
  m: FlowMotion,
  seed: number,
  c: number,
  r: number
) => {
  if (m.fill >= 1) {
    return true;
  }
  const front = m.fill * 1.25;
  return alongAt(f, c, r) + 0.2 * hashAt(c, r, seed, 17) < front;
};

/** The letters' own pattern, filled as far as the flow has reached. */
const letterCells = (
  f: FlowShape,
  m: FlowMotion,
  seed: number,
  put: (c: number, r: number, colour: string) => void
) => {
  for (let r = 0; r < f.rows; r += 1) {
    for (let c = 0; c < f.cols; c += 1) {
      if (!(f.inType(c, r) && filledAt(f, m, seed, c, r))) {
        continue;
      }
      const own = f.body(c, r, randomsAt(c, r, seed));
      if (own) {
        const glint =
          0.5 + 0.5 * Math.sin(TAU * (2 * m.phase + hashAt(c, r, seed, 7)));
        put(c, r, withAlpha(own, 1 - 0.25 * Math.min(1, m.amount) * glint));
      }
    }
  }
};

/**
 * Every pixel of the piece in motion: the funnel's travelling pixels behind,
 * then the letters in front, filled as far as the flow has reached.
 */
export const movingCells = (
  f: FlowShape,
  m: FlowMotion,
  seed: number,
  put: (c: number, r: number, colour: string) => void
): void => {
  const funnel = funnelOf(f);
  const across = runsAcross(f);
  const span = across ? f.cols : f.rows;
  const cells = f.cols * f.rows;
  const count = Math.round(
    Math.min(4000, Math.max(200, cells * 0.2 * Math.min(2, m.amount)))
  );
  for (let i = 0; i < count; i += 1) {
    trailCells(f, pixelOf(f, funnel, m, seed, i), span, put);
  }
  letterCells(f, m, seed, put);
};
