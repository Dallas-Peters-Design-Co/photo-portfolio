import { type ZipFile, zip } from "../../../lib/zip";
import type { BoardItem } from "../../../types";
import { expandAll } from "../../components/model";
import { componentById } from "../../components/store";
import type { Box } from "../../creative/creativeModel";
import {
  copyImages,
  firstFamily,
  fontLinksFor,
  layerHtml,
  selfHostedFonts,
} from "../../creative/exportHtml5";
import { fitOf } from "../../creative/imageAnchor";
import { rotationOf } from "../../creative/rotate";
import { lookOf, type TextLook } from "../../creative/textLook";
import { paletteFor } from "../../studio/chosenColors";
import { IMAGE_TOOLS } from "../../studio/tools";
import { recipeOf } from "../../studio/types";
import {
  compositionHtml,
  type Entrance,
  type VideoLayer,
} from "./compositionHtml";
import { motionFor } from "./motion";
import type { RuntimeLayer } from "./runtime";
import { googleFontsLocal, studioFonts, studioPicture } from "./videoAssets";

/**
 * A frame as a HyperFrames project, zipped: open the folder in the
 * HyperFrames app (or `npx hyperframes preview`), change the timing there,
 * and render it to MP4. See compositionHtml.ts for what the page is, and
 * runtime.ts for how Studio layers move.
 */

export type VideoStyle = "build" | "loop";

export interface VideoOptions {
  duration: number;
  /** The video's longer side, in pixels. */
  longEdge: number;
  /** A slow push in over the whole video (build only: a loop can't). */
  pushIn: boolean;
  style: VideoStyle;
}

/** The HyperFrames CLI the project's scripts run, as tested with. */
export const HYPERFRAMES_VERSION = "0.9.19";

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** The video's size: the frame's shape, its longer side `longEdge`. */
export const videoSizeOf = (
  frame: Box,
  longEdge: number
): { height: number; width: number } =>
  frame.width >= frame.height
    ? {
        height: even((longEdge * frame.height) / frame.width),
        width: even(longEdge),
      }
    : {
        height: even(longEdge),
        width: even((longEdge * frame.width) / frame.height),
      };

/**
 * When each layer comes in: one after another, bottom to top, inside the
 * first half of the video; everything at once for a loop.
 */
export const startsFor = (count: number, options: VideoOptions): number[] => {
  if (options.style === "loop" || count === 0) {
    return Array.from({ length: count }, () => 0);
  }
  const step = Math.min(0.35, (options.duration * 0.45) / count);
  return Array.from(
    { length: count },
    (_, i) => Math.round(i * step * 100) / 100
  );
};

const entranceOf = (
  item: BoardItem,
  studio: boolean,
  style: VideoStyle
): Entrance => {
  if (style === "loop") {
    return "none";
  }
  if (studio) {
    // A Studio picture that builds mark by mark comes in that way instead.
    return motionFor(recipeOf(item.config)?.tool ?? "").build === "none"
      ? "fade"
      : "none";
  }
  return item.kind === "text" || item.kind === "note" ? "rise" : "fade";
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "video";

const projectFiles = (name: string, title: string): ZipFile[] => {
  const text = (path: string, body: string): ZipFile => ({
    bytes: new TextEncoder().encode(body),
    name: path,
  });
  const run = (cmd: string) =>
    `npx --yes hyperframes@${HYPERFRAMES_VERSION} ${cmd}`;
  return [
    text(
      "hyperframes.json",
      `${JSON.stringify(
        {
          $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
          media: { autoProxy: true },
          paths: {
            assets: "assets",
            blocks: "compositions",
            components: "compositions/components",
          },
          registry:
            "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
        },
        null,
        2
      )}\n`
    ),
    text(
      "meta.json",
      `${JSON.stringify({ id: name, name: title }, null, 2)}\n`
    ),
    text(
      "package.json",
      `${JSON.stringify(
        {
          name,
          private: true,
          scripts: {
            check: run("check"),
            dev: run("preview"),
            render: run("render"),
          },
          type: "module",
        },
        null,
        2
      )}\n`
    ),
    text(
      "README.md",
      `# ${title}

A HyperFrames project exported from a design frame.

- **Edit:** open this folder in the HyperFrames app (Import projects, or File > Open Folder), or run \`npm run dev\` for the browser preview.
- **Render:** \`npm run render\` writes an MP4 (needs Node 22 and FFmpeg).
- **Timing:** each layer is a clip; drag it on the timeline and its entrance moves with it.
- **Studio layers** are drawn by the Studio's own tools on every frame (assets/studio.js), from the settings in \`#studio-layers\` in index.html. The *Studio motion* variable sets how much they move (100% as made, 0% still).
`
    ),
  ];
};

interface Gathered {
  layers: VideoLayer[];
  runtime: RuntimeLayer[];
}

interface GatherContext {
  brandPalette: string[];
  files: ZipFile[];
  frame: Box;
  images: Map<string, string>;
  looks: Map<string, TextLook>;
  options: VideoOptions;
  scale: number;
  taken: Set<string>;
}

/** A Studio layer the runtime can draw, with its picture copied in. */
const studioPart = async (
  item: BoardItem,
  id: string,
  start: number,
  c: GatherContext
): Promise<RuntimeLayer | null> => {
  const recipe = recipeOf(item.config);
  const tool = recipe
    ? IMAGE_TOOLS.find((t) => t.id === recipe.tool)
    : undefined;
  if (!(recipe && tool)) {
    return null;
  }
  const picture = recipe.image
    ? await studioPicture(recipe.image, c.files, c.taken)
    : null;
  // A tool that works from a picture it can't have stays the picture it made.
  if (recipe.image && !picture) {
    return null;
  }
  return {
    build: c.options.style === "build" ? { length: 1.6, start } : null,
    fit: fitOf(item),
    id,
    image: picture,
    motion: 1,
    palette: paletteFor(tool.params, recipe.values, c.brandPalette),
    size: recipe.size,
    tool: tool.id,
    values: recipe.values,
  };
};

const nameOf = (item: BoardItem, studio: RuntimeLayer | null) => {
  if (studio) {
    const tool = IMAGE_TOOLS.find((t) => t.id === studio.tool);
    return `${tool?.name ?? "Studio"} layer`;
  }
  return item.body?.trim().slice(0, 40) || item.kind;
};

/** One layer as a clip: its markup, or a place for the Studio to draw. */
const clipFor = async (
  item: BoardItem,
  i: number,
  start: number,
  c: GatherContext
): Promise<{ layer: VideoLayer; studio: RuntimeLayer | null } | null> => {
  const id = `layer-${i + 1}`;
  const box = {
    height: item.height * c.scale,
    left: (item.x - c.frame.x) * c.scale,
    top: (item.y - c.frame.y) * c.scale,
    width: item.width * c.scale,
  };
  const studio = await studioPart(item, id, start, c);
  const place = {
    height: `${box.height}px`,
    left: "0px",
    position: "absolute",
    top: "0px",
    width: `${box.width}px`,
  };
  const html = studio
    ? ""
    : (layerHtml(
        item,
        place,
        c.scale,
        c.images,
        (k) => c.looks.get(k) ?? null
      ) ?? "");
  if (!(studio || html)) {
    return null;
  }
  return {
    layer: {
      box,
      entrance: entranceOf(item, studio !== null, c.options.style),
      html,
      id,
      name: nameOf(item, studio),
      rotate: rotationOf(item),
      start,
      studio: studio !== null,
    },
    studio,
  };
};

const gather = async (
  layers: BoardItem[],
  c: GatherContext
): Promise<Gathered> => {
  const starts = startsFor(layers.length, c.options);
  const clips = await Promise.all(
    layers.map((item, i) => clipFor(item, i, starts[i] ?? 0, c))
  );
  const made = clips.filter((x) => x !== null);
  return {
    layers: made.map((x) => x.layer),
    runtime: made.flatMap((x) => (x.studio ? [x.studio] : [])),
  };
};

/** Text layers' Google families, with the files copied in where they can be. */
const typeFonts = async (
  layers: BoardItem[],
  looks: Map<string, TextLook>,
  files: ZipFile[],
  taken: Set<string>
): Promise<{ css: string[]; links: string[] }> => {
  const weights = new Set(
    [...looks.values()].map((l) => Number(l.fontWeight) || 400)
  );
  const hrefs = fontLinksFor(layers);
  const local = await Promise.all(
    hrefs.map((href) =>
      href.includes("fonts.googleapis.com")
        ? googleFontsLocal(href, weights, files, taken)
        : Promise.resolve(null)
    )
  );
  return {
    css: local.filter((x): x is string => x !== null),
    links: hrefs.filter((_, i) => local[i] === null),
  };
};

/** The project's files (paths inside its folder), its folder name and how many Studio layers it draws. */
export interface HyperframesProject {
  files: ZipFile[];
  name: string;
  studioLayers: number;
}

/** The frame as a HyperFrames project, zipped in a folder of its own name. */
export const exportHyperframes = async (
  ...args: Parameters<typeof hyperframesProject>
): Promise<{ blob: Blob; name: string; studioLayers: number }> => {
  const project = await hyperframesProject(...args);
  return {
    blob: zip(
      project.files.map((f) => ({ ...f, name: `${project.name}/${f.name}` }))
    ),
    name: project.name,
    studioLayers: project.studioLayers,
  };
};

/** The frame as a HyperFrames project's files. */
export const hyperframesProject = async (
  frame: BoardItem,
  given: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  brandPalette: string[],
  options: VideoOptions,
  runtimeJs: Uint8Array<ArrayBuffer>
): Promise<HyperframesProject> => {
  const layers = expandAll(given, componentById);
  const { height, width } = videoSizeOf(frame, options.longEdge);
  const scale = width / frame.width;
  const looks = new Map<string, TextLook>();
  for (const item of layers) {
    const el = textElementFor(item.id);
    if (el && (item.kind === "text" || item.kind === "note")) {
      looks.set(item.id, lookOf(el));
    }
  }
  const files: ZipFile[] = [];
  const taken = new Set<string>();
  const families = new Set(
    [...looks.values()].map((l) => firstFamily(l.fontFamily))
  );
  const plain = layers.filter((l) => !recipeOf(l.config));
  const shared: ZipFile[] = [];
  const [images, ownFontCss] = await Promise.all([
    copyImages(plain, shared),
    selfHostedFonts(families, shared),
  ]);
  // The HTML5 export's folders, moved under assets/ as HyperFrames expects.
  for (const file of shared) {
    files.push({ ...file, name: `assets/${file.name}` });
    taken.add(`assets/${file.name}`);
  }
  for (const [url, name] of images) {
    if (url !== name) {
      images.set(url, `assets/${name}`);
    }
  }
  const type = await typeFonts(layers, looks, files, taken);
  const got = await gather(layers, {
    brandPalette,
    files,
    frame,
    images,
    looks,
    options,
    scale,
    taken,
  });
  const fonts = await studioFonts(
    got.runtime.map((l) => l.values),
    files,
    taken
  );
  const title = frame.body?.trim() || "Video";
  const html = compositionHtml({
    background: "#fff",
    duration: options.duration,
    fontCss: [
      ownFontCss.replaceAll('url("fonts/', 'url("assets/fonts/'),
      ...type.css,
    ].join("\n"),
    fontLinks: type.links,
    height,
    layers: got.layers,
    pushIn: options.pushIn && options.style === "build",
    runtime: { duration: options.duration, fonts, layers: got.runtime },
    title,
    width,
  });
  const name = slug(title);
  return {
    files: [
      { bytes: new TextEncoder().encode(html), name: "index.html" },
      ...projectFiles(name, title),
      { bytes: runtimeJs, name: "assets/studio.js" },
      ...files,
    ],
    name,
    studioLayers: got.runtime.length,
  };
};
