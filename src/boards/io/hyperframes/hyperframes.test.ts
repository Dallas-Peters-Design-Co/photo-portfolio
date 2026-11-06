import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../../types";
import { fieldOf } from "../../studio/generators/field";
import { IMAGE_TOOLS } from "../../studio/tools";
import type { RenderContext, StudioValues } from "../../studio/types";
import { compositionHtml, type VideoDoc } from "./compositionHtml";
import { startsFor, videoSizeOf } from "./exportHyperframes";
import { builtAt, MOTION_FOR, markShown, motionFor, valuesAt } from "./motion";
import { forHyperframes } from "./runtimeUrl";

const ctx: RenderContext = {
  height: 300,
  image: null,
  palette: ["#000", "#fff"],
  width: 400,
};

const toolById = (id: string) => {
  const tool = IMAGE_TOOLS.find((t) => t.id === id);
  if (!tool) {
    throw new Error(`no tool ${id}`);
  }
  return tool;
};

describe("Studio motion", () => {
  it("names only tools that exist", () => {
    const ids = new Set(IMAGE_TOOLS.map((t) => t.id));
    for (const id of Object.keys(MOTION_FOR)) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("starts and ends the loop on the picture as made", () => {
    const tool = toolById("iso-blocks");
    const values: StudioValues = { turn: 45 };
    const motion = motionFor(tool.id);
    expect(valuesAt(values, tool.params, motion, 0, 1).turn).toBeCloseTo(45);
    expect(valuesAt(values, tool.params, motion, 1, 1).turn).toBeCloseTo(45);
    expect(valuesAt(values, tool.params, motion, 0.25, 1).turn).toBeCloseTo(63);
  });

  it("keeps a sway inside the setting's range, and turns wrap round", () => {
    const iso = toolById("iso-blocks");
    expect(
      valuesAt({ turn: 355 }, iso.params, motionFor(iso.id), 0.25, 1).turn
    ).toBeCloseTo(13);
    const pixel = toolById("pixel-field");
    expect(
      valuesAt({ cutoff: 93 }, pixel.params, motionFor(pixel.id), 0.25, 2)
        .cutoff
    ).toBe(95);
  });

  it("holds still at no motion", () => {
    const tool = toolById("pixel-field");
    const values = { cutoff: 30 };
    expect(valuesAt(values, tool.params, motionFor(tool.id), 0.3, 0)).toBe(
      values
    );
  });

  it("builds in from nothing to everything, front first", () => {
    expect(builtAt(0, 1, 2)).toBe(0);
    expect(builtAt(3, 1, 2)).toBe(1);
    expect(markShown(0, 100, 0.5)).toBe(1);
    expect(markShown(90, 100, 0.5)).toBe(0);
    expect(markShown(50, 100, 1)).toBe(1);
  });
});

describe("a field drifting", () => {
  const sources = ["radial", "gradient", "waves", "blobs", "noise"] as const;

  it("is the field as made with no drift, and at the start of the loop", () => {
    for (const source of sources) {
      const still = fieldOf({ source }, ctx, 16, 12);
      const start = fieldOf(
        { fieldDrift: 1, fieldPhase: 0, source },
        ctx,
        16,
        12
      );
      expect([...start]).toEqual([...still]);
    }
  });

  it("moves mid-loop and is back by the end", () => {
    for (const source of sources) {
      const still = [...fieldOf({ source }, ctx, 16, 12)];
      const mid = [
        ...fieldOf({ fieldDrift: 1, fieldPhase: 0.4, source }, ctx, 16, 12),
      ];
      const end = [
        ...fieldOf({ fieldDrift: 1, fieldPhase: 1, source }, ctx, 16, 12),
      ];
      expect(mid).not.toEqual(still);
      end.forEach((x, i) => {
        expect(x).toBeCloseTo(still[i] ?? 0, 4);
      });
    }
  });
});

describe("the HyperFrames project", () => {
  it("sizes the video to the frame's shape, in even pixels", () => {
    expect(
      videoSizeOf({ height: 3600, width: 2400, x: 0, y: 0 }, 1920)
    ).toEqual({ height: 1920, width: 1280 });
    expect(videoSizeOf({ height: 333, width: 1000, x: 0, y: 0 }, 1920)).toEqual(
      { height: 640, width: 1920 }
    );
  });

  it("brings layers in one after another, or all at once for a loop", () => {
    const build = {
      duration: 8,
      longEdge: 1920,
      pushIn: true,
      style: "build" as const,
    };
    expect(startsFor(3, build)).toEqual([0, 0.35, 0.7]);
    expect(startsFor(3, { ...build, style: "loop" })).toEqual([0, 0, 0]);
  });

  it("writes a clip per layer, entrances read from each clip's start", () => {
    const doc: VideoDoc = {
      background: "#fff",
      duration: 8,
      fontCss: "",
      fontLinks: [],
      height: 1350,
      layers: [
        {
          box: { height: 1350, left: 0, top: 0, width: 1080 },
          entrance: "none",
          html: "",
          id: "layer-1",
          name: "Pixel Field layer",
          rotate: 0,
          start: 0,
          studio: true,
        },
        {
          box: { height: 80, left: 60, top: 1180, width: 900 },
          entrance: "rise",
          html: "<div>Build slow.</div>",
          id: "layer-2",
          name: "Build slow.",
          rotate: 0,
          start: 2,
          studio: false,
        },
      ],
      pushIn: true,
      runtime: { duration: 8, fonts: {}, layers: [] },
      title: "Poster",
      width: 1080,
    };
    const html = compositionHtml(doc);
    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain('id="layer-1-studio"');
    expect(html).toContain('data-start="2" data-duration="6"');
    expect(html).toContain('tl.fromTo("#layer-2 > .layer__in"');
    expect(html).toContain('at("layer-2")');
    expect(html).toContain('window.__timelines["main"] = tl;');
    expect(html).toContain('src="assets/studio.js"');
    expect(html).not.toContain("#layer-1 > .layer__in");
  });

  it("rewrites the runtime's new Date so HyperFrames' check passes", () => {
    expect(forHyperframes("a=new Date();b=new  Date (1)")).toBe(
      "a=new (Date)();b=new (Date)(1)"
    );
  });
});

describe("exporting a frame", () => {
  it("zips a project with the Studio layer drawn live and the text as markup", async () => {
    const { exportHyperframes } = await import("./exportHyperframes");
    const frame = {
      body: "Poster 1080x1350",
      height: 675,
      id: "f",
      kind: "frame",
      width: 540,
      x: 0,
      y: 0,
      z: 0,
    } as BoardItem;
    const studio = {
      config: {
        studio: {
          image: null,
          size: { h: 1350, w: 1080 },
          tool: "pixel-field",
          values: { columns: 12, source: "radial" },
        },
      },
      height: 675,
      id: "s",
      imageUrl: "data:image/svg+xml,<svg/>",
      kind: "reference",
      width: 540,
      x: 0,
      y: 0,
      z: 1,
    } as unknown as BoardItem;
    const text = {
      body: "Build slow.",
      height: 40,
      id: "t",
      kind: "text",
      width: 400,
      x: 30,
      y: 600,
      z: 2,
    } as BoardItem;
    const el = document.createElement("div");
    el.textContent = "Build slow.";
    document.body.append(el);
    const { blob, name, studioLayers } = await exportHyperframes(
      frame,
      [studio, text],
      (id) => (id === "t" ? el : null),
      ["#000", "#fff"],
      { duration: 8, longEdge: 1350, pushIn: true, style: "build" },
      new TextEncoder().encode("/* runtime */")
    );
    el.remove();
    expect(name).toBe("poster-1080x1350");
    expect(studioLayers).toBe(1);
    const bytes = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    for (const path of [
      "poster-1080x1350/index.html",
      "poster-1080x1350/hyperframes.json",
      "poster-1080x1350/package.json",
      "poster-1080x1350/assets/studio.js",
    ]) {
      expect(bytes).toContain(path);
    }
    expect(bytes).toContain("Build slow.");
    expect(bytes).toContain('"tool":"pixel-field"');
  });
});
