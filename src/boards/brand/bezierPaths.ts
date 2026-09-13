/**
 * A mark's actual curves, read out of the SVG.
 *
 * The tile this replaces drew a faded copy of the logo inside a red rectangle
 * and called it an outline, which is a picture of the artwork rather than a
 * reading of it. What a designer wants here is the drawing *under* the
 * drawing: where the anchors sit, which way the handles pull, and how many of
 * both it took. That is the difference between "this mark looks fine" and
 * "this mark is a hundred and twenty three points, most of them on the beard".
 *
 * Only possible because these marks are vector. A raster has no anchors to
 * show, and the tile says so rather than inventing some.
 */

export interface Anchor {
  /** The control point before this anchor, when the segment curves into it. */
  in?: { x: number; y: number };
  /** The control point after it. */
  out?: { x: number; y: number };
  x: number;
  y: number;
}

export interface MarkPaths {
  /** One entry per subpath, each a run of anchors. */
  paths: Anchor[][];
  /** The coordinate box the SVG declares, so the drawing can be scaled. */
  viewBox: { height: number; width: number };
}

/** Numbers in a `d` attribute, including the exponent and implicit-sign forms. */
const NUMBERS = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
/** A command letter followed by everything up to the next one. */
const SEGMENTS = /([astvzqmhlc])([^astvzqmhlc]*)/gi;
const VIEWBOX = /viewBox\s*=\s*"([\d.\-\s]+)"/i;
const PATH_D = /\sd\s*=\s*"([^"]+)"/gi;
/** Whitespace between the four viewBox numbers. */
const SPACES = /\s+/;

const numbersIn = (text: string): number[] =>
  (text.match(NUMBERS) ?? []).map(Number);

/**
 * One path's `d` attribute, as anchors with their handles.
 *
 * Absolute and relative forms both, because a real export mixes them freely.
 * Arcs are reduced to their endpoint: an arc has no bezier handles to draw, so
 * showing its anchor and nothing else is the honest rendering rather than a
 * guess at control points that were never in the file.
 */
/** How many numbers each command consumes per repetition. */
const ARITY: Record<string, number> = {
  a: 7,
  c: 6,
  h: 1,
  l: 2,
  m: 2,
  q: 4,
  s: 4,
  t: 2,
  v: 1,
};

interface Pen {
  at: { x: number; y: number };
  path: Anchor[];
}

/**
 * One repetition of one command.
 *
 * A table rather than a chain of branches. The chain was one `else if` per
 * SVG command and reached a complexity of fifty-two, which is the point at
 * which nobody reads it and a wrong branch hides in plain sight.
 *
 * Each entry gets absolute coordinates — the caller has already added the
 * current point for the relative forms — and returns where the pen ends up.
 */
type Draw = (pen: Pen, args: number[]) => { x: number; y: number };

const COMMANDS: Record<string, Draw> = {
  a: (pen, [, , , , , x, y]) => {
    // The endpoint only: an arc carries no bezier handles to show, and
    // inventing control points it never had would be the one lie this tile
    // exists to avoid.
    pen.path.push({ x, y });
    return { x, y };
  },
  c: (pen, [x1, y1, x2, y2, x, y]) => {
    const previous = pen.path.at(-1);
    if (previous) {
      previous.out = { x: x1, y: y1 };
    }
    pen.path.push({ in: { x: x2, y: y2 }, x, y });
    return { x, y };
  },
  h: (pen, [x]) => {
    const { y } = pen.at;
    pen.path.push({ x, y });
    return { x, y };
  },
  l: (pen, [x, y]) => {
    pen.path.push({ x, y });
    return { x, y };
  },
  q: (pen, [x1, y1, x, y]) => {
    const previous = pen.path.at(-1);
    if (previous) {
      previous.out = { x: x1, y: y1 };
    }
    pen.path.push({ in: { x: x1, y: y1 }, x, y });
    return { x, y };
  },
  s: (pen, [x2, y2, x, y]) => {
    pen.path.push({ in: { x: x2, y: y2 }, x, y });
    return { x, y };
  },
  t: (pen, [x, y]) => {
    pen.path.push({ x, y });
    return { x, y };
  },
  v: (pen, [y]) => {
    const { x } = pen.at;
    pen.path.push({ x, y });
    return { x, y };
  },
};

/** Relative commands are absolute ones plus wherever the pen already is. */
const absolute = (
  code: string,
  args: number[],
  at: { x: number; y: number }
): number[] =>
  args.map((value, index) => {
    if (code === "h") {
      return value + at.x;
    }
    if (code === "v") {
      return value + at.y;
    }
    // An arc's first five numbers are radii, rotation and flags, which are
    // not coordinates and must not be shifted.
    if (code === "a" && index < 5) {
      return value;
    }
    return value + (index % 2 === 0 ? at.x : at.y);
  });

/**
 * One path's `d` attribute, as anchors with their handles.
 *
 * Absolute and relative forms both, because a real export mixes them freely,
 * and each command repeats while it still has arguments — which is how a `d`
 * written "C" with nine numbers means three curves.
 */
export const anchorsOf = (d: string): Anchor[][] => {
  const paths: Anchor[][] = [];
  const pen: Pen = { at: { x: 0, y: 0 }, path: [] };
  let start = { x: 0, y: 0 };

  const close = () => {
    if (pen.path.length > 0) {
      paths.push(pen.path);
      pen.path = [];
    }
  };

  for (const [, letter, rest] of d.matchAll(SEGMENTS)) {
    const code = letter.toLowerCase();
    const relative = letter === code;
    const values = numbersIn(rest);

    if (code === "z") {
      close();
      pen.at = start;
      continue;
    }
    const step = ARITY[code] ?? 2;
    for (let cursor = 0; cursor + step <= values.length; cursor += step) {
      const raw = values.slice(cursor, cursor + step);
      const args = relative ? absolute(code, raw, pen.at) : raw;
      if (code === "m") {
        close();
        pen.at = { x: args[0], y: args[1] };
        start = pen.at;
        pen.path.push({ ...pen.at });
        continue;
      }
      pen.at = COMMANDS[code]?.(pen, args) ?? pen.at;
    }
  }
  close();
  return paths;
};

/** Every drawable shape in an SVG, as anchors. Null when it is not an SVG. */
export const pathsOfSvg = (source: string): MarkPaths | null => {
  if (!source.includes("<svg")) {
    return null;
  }
  const [, box] = VIEWBOX.exec(source) ?? [];
  const [, , width, height] = (box ?? "").trim().split(SPACES).map(Number);
  const paths: Anchor[][] = [];
  for (const [, d] of source.matchAll(PATH_D)) {
    paths.push(...anchorsOf(d));
  }
  return {
    paths,
    viewBox: {
      height: height > 0 ? height : 1,
      width: width > 0 ? width : 1,
    },
  };
};

/** What the tile reports underneath: paths, anchors, and handles drawn. */
export const countOf = (
  paths: Anchor[][]
): { handles: number; paths: number; points: number } => {
  let points = 0;
  let handles = 0;
  for (const path of paths) {
    points += path.length;
    for (const anchor of path) {
      handles += (anchor.in ? 1 : 0) + (anchor.out ? 1 : 0);
    }
  }
  return { handles, paths: paths.length, points };
};
