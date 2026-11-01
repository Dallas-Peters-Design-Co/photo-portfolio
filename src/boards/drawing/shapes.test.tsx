import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { markFromStroke } from "../canvas/markFromStroke";
import { newShape } from "../creative/creativeModel";
import { shapeHtml } from "../creative/exportHtml5";
import { DrawingView } from "./DrawingView";
import type { DrawingConfig } from "./drawing";
import { PATH_TOOLS, shapeGeometry } from "./shapes";

const COMMANDS = /[ML]/;
const style = { fill: "#ff0000", stroke: "#111111", strokeWidth: 4 };
const config = (
  tool: DrawingConfig["tool"],
  extra: Partial<DrawingConfig> = {}
): DrawingConfig => ({
  fill: "#ff0000",
  stroke: "#111111",
  strokeWidth: 4,
  tool,
  ...extra,
});

/** The bounding box of a path, by drawing it into an SVG. */
const bbox = (d: string, w: number, h: number) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  svg.append(p);
  document.body.append(svg);
  const box = p.getBBox();
  svg.remove();
  return box;
};

describe("path shapes", () => {
  for (const tool of PATH_TOOLS) {
    it(`${tool} stays inside its box`, () => {
      const shape = shapeGeometry(config(tool), 200, 120, 4);
      expect(shape?.d.startsWith("M")).toBe(true);
      const box = bbox(shape?.d ?? "", 200, 120);
      expect(box.x).toBeGreaterThanOrEqual(-0.01);
      expect(box.y).toBeGreaterThanOrEqual(-0.01);
      expect(box.x + box.width).toBeLessThanOrEqual(200.01);
      expect(box.y + box.height).toBeLessThanOrEqual(120.01);
      expect(shape?.closed).toBe(tool !== "line" && tool !== "arrow");
    });
  }

  it("gives a star twice as many corners as points, and a polygon its sides", () => {
    const corners = (d: string) =>
      d.split(COMMANDS).filter((s) => s.trim()).length;
    expect(
      corners(shapeGeometry(config("star", { sides: 7 }), 100, 100, 0)?.d ?? "")
    ).toBe(14);
    expect(
      corners(
        shapeGeometry(config("polygon", { sides: 8 }), 100, 100, 0)?.d ?? ""
      )
    ).toBe(8);
  });

  it("points an arrow where the drag went, with a head at the end", () => {
    const mark = markFromStroke(
      [
        { x: 300, y: 200 },
        { x: 120, y: 260 },
      ],
      "arrow",
      style
    );
    expect(mark?.config.points?.[0]?.x).toBeGreaterThan(
      mark?.config.points?.[1]?.x ?? 1
    );
    const box = mark?.box ?? { height: 0, width: 0, x: 0, y: 0 };
    const shape = shapeGeometry(
      mark?.config as DrawingConfig,
      box.width,
      box.height,
      4
    );
    expect(shape?.head).toBeTruthy();
    // The tip is at the end of the drag, inside the box.
    const tip = bbox(shape?.head ?? "", box.width, box.height);
    expect(box.x + tip.x).toBeLessThan(140);
  });

  it("ignores a click with a line tool", () => {
    expect(
      markFromStroke(
        [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
        ],
        "line",
        style
      )
    ).toBeNull();
  });

  it("draws on the board, in the PNG path and the HTML5 export", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <DrawingView config={config("star")} height={100} width={100} />
      )
    );
    expect(host.querySelector("path")?.getAttribute("fill")).toBe("#ff0000");
    act(() => root.unmount());
    host.remove();

    const html = shapeHtml(
      config("arrow", {
        points: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
      }),
      { height: "40px", left: "0px", top: "0px", width: "200px" },
      1
    );
    expect(html).toContain('<path d="M');
    expect(html).toContain('fill="#111111"');
    expect(
      () => new Path2D(shapeGeometry(config("squircle"), 50, 50, 2)?.d)
    ).not.toThrow();
  });

  it("adds a line in the brand colour from the frame editor", () => {
    const frame = { height: 1080, width: 1080, x: 0, y: 0 };
    const item = newShape(frame, [], "arrow", "#c63b2e");
    const cfg = item.config as unknown as DrawingConfig;
    expect(cfg.stroke).toBe("#c63b2e");
    expect(cfg.fill).toBeNull();
    expect(item.height).toBeLessThan(item.width);
  });
});
