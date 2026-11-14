import { escapeHtml } from "../../creative/htmlBits";
import type { RuntimeSpec } from "./runtime";

/**
 * A frame's design as a HyperFrames composition (index.html): one clip per
 * layer, in stacking order, at its real place in the video's pixels, and a
 * GSAP timeline for how each comes in. Studio layers are drawn by the
 * Studio's own tools on every frame (runtime.ts), so they move as
 * themselves; everything else is the layer's own markup, as in the HTML5
 * export.
 *
 * Written the way HyperFrames' Studio edits it: every clip is a tag with an
 * id, and each entrance reads its clip's `data-start`, so dragging a clip on
 * Studio's timeline moves its entrance with it. The amount of Studio motion
 * is the video's one variable.
 *
 * One row, one element. Studio's lint reads a timed element holding a block
 * child as a scene that should be its own file, so a clip is not a wrapper
 * round the layer's markup: the layer's own element is the clip, with the
 * timing attributes and its place on the canvas merged onto it. The push in
 * is per row too, each scaled about the canvas centre, since a wrapper round
 * the rows would be one more block to object to.
 */

export type Entrance = "fade" | "none" | "rise";

export interface VideoLayer {
  box: { height: number; left: number; top: number; width: number };
  entrance: Entrance;
  /** The layer's markup, filling its box; empty for a Studio layer. */
  html: string;
  id: string;
  /** What Studio's timeline calls it. */
  name: string;
  rotate: number;
  /** When it comes in, in seconds. */
  start: number;
  studio: boolean;
}

export interface VideoDoc {
  background: string;
  duration: number;
  fontCss: string;
  fontLinks: string[];
  height: number;
  layers: VideoLayer[];
  /** A slow push in over the whole video. */
  pushIn: boolean;
  runtime: RuntimeSpec;
  title: string;
  width: number;
}

/** The pinned GSAP HyperFrames' own templates load. */
export const GSAP_SRC =
  "https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js";

const r2 = (n: number) => Math.round(n * 100) / 100;
const json = (value: unknown) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

const VARIABLES = [
  {
    default: 100,
    id: "motion",
    label: "Studio motion",
    max: 200,
    min: 0,
    step: 5,
    type: "number",
    unit: "%",
  },
];

const OPEN_TAG = /^\s*<(?<tag>[a-z][\w-]*)(?<attrs>[^>]*?)(?<close>\/?)>/i;
const STYLE_ATTR = /\sstyle="(?<css>[^"]*)"/i;

/** `html`'s first tag with these attributes added and this CSS appended. */
const onOpeningTag = (
  html: string,
  attrs: string,
  css: string
): string | null => {
  const m = html.match(OPEN_TAG);
  const tag = m?.groups?.tag;
  if (!(m && tag)) {
    return null;
  }
  const had = m.groups?.attrs ?? "";
  const styled = STYLE_ATTR.test(had)
    ? had.replace(STYLE_ATTR, (_, old: string) => ` style="${old};${css}"`)
    : `${had} style="${css}"`;
  const open = `<${tag} ${attrs}${styled}${m.groups?.close ?? ""}>`;
  return open + html.slice(m[0].length);
};

const clipHtml = (layer: VideoLayer, z: number, end: number): string => {
  const { box } = layer;
  const place = [
    "position:absolute",
    `left:${r2(box.left)}px`,
    `top:${r2(box.top)}px`,
    `width:${r2(box.width)}px`,
    `height:${r2(box.height)}px`,
    `z-index:${z}`,
    layer.rotate ? `transform:rotate(${r2(layer.rotate)}deg)` : "",
  ]
    .filter(Boolean)
    .join(";");
  const attrs = `id="${layer.id}" class="clip layer${layer.studio ? " studio" : ""}" data-name="${escapeHtml(layer.name)}" data-start="${r2(layer.start)}" data-duration="${r2(Math.max(0.1, end - layer.start))}" data-track-index="${z}"`;
  const row = layer.studio
    ? `<div ${attrs} style="${place}"></div>`
    : onOpeningTag(layer.html, attrs, place);
  return `      ${row ?? `<div ${attrs} style="${place}"></div>`}`;
};

/** The entrance tweens: from each clip's own start, so Studio retimes them. */
const timelineScript = (doc: VideoDoc): string => {
  const lines = doc.layers
    .filter((l) => l.entrance !== "none")
    .map((l) => {
      const from =
        l.entrance === "rise"
          ? `{ opacity: 0, y: ${r2(doc.height * 0.03)} }`
          : "{ opacity: 0, scale: 1.03 }";
      const to =
        l.entrance === "rise"
          ? `{ opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }`
          : `{ opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" }`;
      return `      tl.fromTo("#${l.id}", ${from}, ${to}, at("${l.id}"));`;
    });
  // Each row scaled about the canvas centre is the whole picture pushing in.
  // A turned layer keeps its own centre: scaling it about the canvas's would
  // swing it round the frame.
  const push = doc.pushIn
    ? doc.layers
        .filter((l) => !l.rotate)
        .map(
          (l) =>
            `      tl.fromTo("#${l.id}", { scale: 1, transformOrigin: "${r2(doc.width / 2 - l.box.left)}px ${r2(doc.height / 2 - l.box.top)}px" }, { scale: 1.05, duration: ${r2(doc.duration)}, ease: "none" }, 0);`
        )
        .join("\n")
    : "";
  return `    <script>
      const at = (id) => Number(document.getElementById(id).dataset.start) || 0;
      const tl = gsap.timeline({ paused: true });
${[...lines, push].filter(Boolean).join("\n")}
      // The CLI defines __timelines before the page runs; the Studio app and a
      // plain browser don't, and a throw here would leave every layer at the
      // opacity 0 the tweens just set. Written in the two lines Studio's lint
      // looks for; a shorter form passes the browser and fails the lint.
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>`;
};

export const compositionHtml = (doc: VideoDoc): string => {
  const { duration, height, width } = doc;
  const clips = doc.layers.map((l, i) => clipHtml(l, i + 1, duration));
  return `<!doctype html>
<html lang="en" data-composition-variables='${json(VARIABLES).replaceAll("'", "&#39;")}'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(doc.title)}</title>
${doc.fontLinks.map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />`).join("\n")}
    <script src="${GSAP_SRC}"></script>
    <style>
${doc.fontCss}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${doc.background}; -webkit-font-smoothing: antialiased; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .studio > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${r2(duration)}" data-width="${width}" data-height="${height}" data-layout-allow-overflow>
${clips.join("\n")}
    </div>
    <script type="application/json" id="studio-layers">${json(doc.runtime)}</script>
    <script src="assets/studio.js"></script>
${timelineScript(doc)}
  </body>
</html>
`;
};
