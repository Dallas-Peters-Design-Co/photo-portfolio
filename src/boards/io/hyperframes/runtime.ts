import { OUTLINE_FONTS } from "../../studio/generators/outlineFonts";
import { fontReady } from "../../studio/generators/vectorType";
import { IMAGE_TOOLS } from "../../studio/tools";
import type { ImageTool, StudioValues } from "../../studio/types";
import {
  buildKey,
  builtAt,
  markShown,
  motionFor,
  type StudioMotion,
  valuesAt,
} from "./motion";

/**
 * The Studio inside an exported HyperFrames project (assets/studio.js): each
 * Studio layer drawn again, on every frame, by the same tool that made it,
 * from its own settings moved by the motion (motion.ts). Bundled on its own
 * by Vite (runtimeUrl.ts) and run as a plain script in the video's page.
 *
 * HyperFrames seeks every frame on its own and fires `hf-seek` with the
 * time, so a frame is drawn from the time alone. Setup (fonts, pictures) is
 * registered as a build-ready promise, so nothing renders before it's done.
 */

export interface RuntimeLayer {
  /** When it builds in, if it does: start and length in seconds. */
  build: { length: number; start: number } | null;
  /** How the layer fills its box, as on the board. */
  fit: "contain" | "cover";
  id: string;
  /** The picture the tool works from, a path in the project. */
  image: string | null;
  /** 1 as made; 0 holds still. */
  motion: number;
  palette: string[];
  size: { h: number; w: number };
  tool: string;
  values: StudioValues;
}

export interface RuntimeSpec {
  /** The length of one loop of the motion, in seconds. */
  duration: number;
  /** Font files by family and weight, paths in the project. */
  fonts: Record<string, Record<number, string>>;
  layers: RuntimeLayer[];
}

interface Live {
  ctx: {
    height: number;
    image: HTMLImageElement | null;
    palette: string[];
    width: number;
  };
  el: HTMLElement;
  key: string;
  layer: RuntimeLayer;
  motion: StudioMotion;
  /** Build order of the marks, by their index, for this many marks. */
  order: { count: number; rank: Int32Array } | null;
  tool: ImageTool;
}

declare global {
  interface Window {
    __hf?: { buildReady?: Record<string, PromiseLike<unknown>> };
    __hyperframes?: { getVariables?: () => Record<string, unknown> };
    HFStudio?: { draw: (t: number) => void };
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });

/** The fonts the export carried, used in place of the site's own files. */
const loadFonts = async (fonts: RuntimeSpec["fonts"]) => {
  const faces: Promise<unknown>[] = [];
  for (const [family, files] of Object.entries(fonts)) {
    OUTLINE_FONTS[family] = files;
    for (const [weight, src] of Object.entries(files)) {
      // Canvas-drawn type (a field shaped by text) needs the face loaded too.
      const face = new FontFace(family, `url("${src}")`, { weight });
      document.fonts.add(face);
      // Outline type (Type Echo, Iso Blocks' letters) parses the same file.
      faces.push(face.load(), fontReady(family, Number(weight)));
    }
  }
  await Promise.all(faces);
};

/** The marks a build fades in: everything but a full-size background. */
const marksOf = (svg: SVGSVGElement): SVGGraphicsElement[] => {
  const box = svg.viewBox.baseVal;
  const area = (box?.width || 1) * (box?.height || 1);
  return [
    ...svg.querySelectorAll<SVGGraphicsElement>(
      "rect,circle,ellipse,path,polygon,polyline,line,use"
    ),
  ].filter((el) => {
    const b = el.getBBox();
    return b.width * b.height < area * 0.9;
  });
};

const rankOf = (
  live: Live,
  marks: SVGGraphicsElement[],
  svg: SVGSVGElement
) => {
  if (live.order?.count === marks.length) {
    return live.order.rank;
  }
  const box = svg.viewBox.baseVal;
  const w = box?.width || 1;
  const h = box?.height || 1;
  const keys = marks.map((el, i) => {
    const b = el.getBBox();
    const k = buildKey(
      live.motion.build,
      (b.x + b.width / 2 - (box?.x ?? 0)) / w,
      (b.y + b.height / 2 - (box?.y ?? 0)) / h
    );
    return [k, i] as const;
  });
  keys.sort((a, b) => a[0] - b[0]);
  const rank = new Int32Array(marks.length);
  keys.forEach(([, i], r) => {
    rank[i] = r;
  });
  live.order = { count: marks.length, rank };
  return rank;
};

const reveal = (live: Live, svg: SVGSVGElement, built: number) => {
  const marks = marksOf(svg);
  const rank = rankOf(live, marks, svg);
  marks.forEach((el, i) => {
    const own = Number(el.getAttribute("opacity") ?? 1);
    el.style.opacity = String(
      own * markShown(rank[i] ?? 0, marks.length, built)
    );
  });
};

const draw = (lives: Live[], spec: RuntimeSpec, amount: number, t: number) => {
  const phase = spec.duration > 0 ? (t / spec.duration) % 1 : 0;
  for (const live of lives) {
    const { layer } = live;
    const values = valuesAt(
      layer.values,
      live.tool.params,
      live.motion,
      phase,
      amount * layer.motion
    );
    const built =
      layer.build && live.motion.build !== "none"
        ? builtAt(t, layer.build.start, layer.build.length)
        : 1;
    const key = `${JSON.stringify(values)}|${built}`;
    if (key === live.key) {
      continue;
    }
    live.key = key;
    live.el.innerHTML = live.tool.render(values, live.ctx);
    const svg = live.el.querySelector("svg");
    if (!svg) {
      continue;
    }
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute(
      "preserveAspectRatio",
      layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
    );
    if (built < 1) {
      reveal(live, svg, built);
    }
  }
};

/** The motion amount from the video's variables (Studio's panel), as a scale. */
const amountOf = (): number => {
  const vars = window.__hyperframes?.getVariables?.() ?? {};
  const n = Number(vars.motion);
  return Number.isFinite(n) ? Math.max(0, n) / 100 : 1;
};

const start = async (spec: RuntimeSpec): Promise<void> => {
  await loadFonts(spec.fonts);
  const lives = await Promise.all(
    spec.layers.map(async (layer): Promise<Live | null> => {
      const el = document.getElementById(`${layer.id}-studio`);
      const tool = IMAGE_TOOLS.find((t) => t.id === layer.tool);
      if (!(el && tool)) {
        return null;
      }
      const image = layer.image ? await loadImage(layer.image) : null;
      return {
        ctx: {
          height: layer.size.h,
          image,
          palette: layer.palette,
          width: layer.size.w,
        },
        el,
        key: "",
        layer,
        motion: motionFor(layer.tool),
        order: null,
        tool,
      };
    })
  );
  const ready = lives.filter((l): l is Live => l !== null);
  const amount = amountOf();
  draw(ready, spec, amount, 0);
  const at = (t: number) => draw(ready, spec, amount, t);
  window.HFStudio = { draw: at };
  window.addEventListener("hf-seek", (e) => {
    at(Number((e as CustomEvent<{ time: number }>).detail?.time) || 0);
  });
};

const specEl = document.getElementById("studio-layers");
if (specEl?.textContent) {
  const spec = JSON.parse(specEl.textContent) as RuntimeSpec;
  window.__hf = window.__hf ?? {};
  window.__hf.buildReady = window.__hf.buildReady ?? {};
  window.__hf.buildReady.studio = start(spec);
}
