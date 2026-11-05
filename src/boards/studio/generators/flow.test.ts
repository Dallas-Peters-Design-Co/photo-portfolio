import { expect, it } from "vitest";
import { defaultsOf } from "../tools";
import { flowTool } from "./flow";

/**
 * Systems Flow draws the number out of ordered pixels with scatter around
 * it, the same in the preview and in the SVG that goes on the board.
 */
it("draws a number in pixel lanes with scatter around it", async () => {
  const values = { ...defaultsOf(flowTool.params), text: "2" };
  const ctx = {
    height: 1080,
    image: null,
    palette: ["#b89d12", "#d9bd1c", "#f0d43a"],
    width: 720,
  };
  await document.fonts.load('800 100px "DM Sans"').catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 810;
  document.body.append(canvas);
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  flowTool.draw?.(g, values, ctx);
  const { data } = g.getImageData(0, 0, 540, 810);
  let yellow = 0;
  let blue = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r = 0, gr = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
    if (r > 150 && gr > 130 && b < 100) {
      yellow += 1;
    } else if (b > 120 && r < 90) {
      blue += 1;
    }
  }
  // Plenty of the number, and loose pixels besides.
  expect(yellow).toBeGreaterThan(20_000);
  expect(blue).toBeGreaterThan(1000);
  const svg = flowTool.render(values, ctx);
  expect(svg.startsWith("<svg")).toBe(true);
  expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(1500);
});

it("spreads the letters apart with letter spacing, still centred", () => {
  const span = (tracking: number) => {
    const values = {
      ...defaultsOf(flowTool.params),
      drift: 0,
      noise: 0,
      text: "2027",
      tracking,
    };
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    flowTool.draw?.(g, values, {
      height: 1080,
      image: null,
      palette: ["#d9bd1c"],
      width: 1080,
    });
    const { data } = g.getImageData(0, 0, 400, 400);
    // The gaps between letters: empty columns inside the text's span.
    let first = -1;
    let last = -1;
    let empty = 0;
    for (let x = 0; x < 400; x += 1) {
      let any = false;
      for (let y = 0; y < 400; y += 1) {
        if ((data[(y * 400 + x) * 4] ?? 0) > 150) {
          any = true;
          break;
        }
      }
      if (any) {
        first = first < 0 ? x : first;
        if (last >= 0 && x - last > 1) {
          empty += x - last - 1;
        }
        last = x;
      }
    }
    return { empty, left: first, right: 399 - last };
  };
  const tight = span(0);
  const wide = span(300);
  expect(wide.empty).toBeGreaterThan(tight.empty);
  expect(Math.abs(wide.left - wide.right)).toBeLessThan(12);
});

const colourBox = (
  values: Record<string, unknown>,
  test: (r: number, g: number, b: number) => boolean
) => {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  flowTool.draw?.(
    g,
    { ...defaultsOf(flowTool.params), drift: 0, noise: 0, ...values },
    { height: 900, image: null, palette: ["#d9bd1c"], width: 900 }
  );
  const { data } = g.getImageData(0, 0, 300, 300);
  let x0 = 1e9;
  let x1 = -1;
  let y0 = 1e9;
  let y1 = -1;
  for (let y = 0; y < 300; y += 1) {
    for (let x = 0; x < 300; x += 1) {
      const i = (y * 300 + x) * 4;
      if (test(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  return { x0, x1, y0, y1 };
};
const yellow = (r: number, g: number, b: number) =>
  r > 150 && g > 130 && b < 100;

it("sets the text over several lines", () => {
  const one = colourBox({ text: "2027" }, yellow);
  const two = colourBox({ text: "20\n27" }, yellow);
  // Two lines: taller and narrower than one.
  expect(two.y1 - two.y0).toBeGreaterThan((one.y1 - one.y0) * 1.5);
  expect(two.x1 - two.x0).toBeLessThan(one.x1 - one.x0);
});

it("colours single letters", () => {
  // Second line's "2" in blue; everything else stays yellow.
  const blue = (r: number, _g: number, b: number) => b > 180 && r < 80;
  const box = colourBox({ charColors: ",,,#2a84f8", text: "20\n27" }, blue);
  // The blue letter is on the second line, on the left.
  expect(box.y0).toBeGreaterThan(140);
  expect(box.x1).toBeLessThan(170);
});

it("gives a letter several colours of its own", () => {
  // The "2" on the second line in blue and red: both show, only there.
  const blue = (r: number, _g: number, b: number) => b > 180 && r < 80;
  const red = (r: number, g: number, b: number) => r > 180 && g < 80 && b < 80;
  const values = { charColors: ",,,#2a84f8|#e02020", text: "20\n27" };
  const inBlue = colourBox(values, blue);
  const inRed = colourBox(values, red);
  expect(inBlue.x1).toBeGreaterThan(0);
  expect(inRed.x1).toBeGreaterThan(0);
  expect(inRed.y0).toBeGreaterThan(140);
  expect(inRed.x1).toBeLessThan(170);
});

it("cuts the letters out of a field that fills around them", () => {
  const draw = (values: Record<string, unknown>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    flowTool.draw?.(
      g,
      { ...defaultsOf(flowTool.params), drift: 0, noise: 0, ...values },
      { height: 900, image: null, palette: ["#d9bd1c"], width: 900 }
    );
    const { data } = g.getImageData(0, 0, 300, 300);
    // Yellow in the middle (inside the letter) and in a corner (outside).
    const yellowIn = (x0: number, y0: number, size: number) => {
      let n = 0;
      for (let y = y0; y < y0 + size; y += 1) {
        for (let x = x0; x < x0 + size; x += 1) {
          const i = (y * 300 + x) * 4;
          n += yellow(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) ? 1 : 0;
        }
      }
      return n;
    };
    return { corner: yellowIn(4, 4, 30), middle: yellowIn(140, 130, 20) };
  };
  const plain = draw({ order: 0, text: "I" });
  const cut = draw({ cutout: true, order: 0, text: "I" });
  expect(plain.middle).toBeGreaterThan(0);
  expect(plain.corner).toBe(0);
  expect(cut.middle).toBe(0);
  expect(cut.corner).toBeGreaterThan(50);
});

it("makes the flow from a picture's shape instead of text", async () => {
  // A see-through picture with a solid block on its left half.
  const src = document.createElement("canvas");
  src.width = 100;
  src.height = 100;
  const sg = src.getContext("2d") as CanvasRenderingContext2D;
  sg.fillStyle = "#000000";
  sg.fillRect(0, 0, 50, 100);
  const image = await createImageBitmap(src);
  const draw = (values: Record<string, unknown>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    flowTool.draw?.(
      g,
      {
        ...defaultsOf(flowTool.params),
        drift: 0,
        fill: false,
        noise: 0,
        order: 0,
        source: "picture",
        ...values,
      },
      { height: 900, image, palette: ["#d9bd1c"], width: 900 }
    );
    const { data } = g.getImageData(0, 0, 300, 300);
    let left = 0;
    let right = 0;
    for (let y = 40; y < 260; y += 1) {
      for (let x = 30; x < 270; x += 1) {
        const i = (y * 300 + x) * 4;
        if (yellow(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)) {
          if (x < 140) {
            left += 1;
          } else if (x > 160) {
            right += 1;
          }
        }
      }
    }
    return { left, right };
  };
  const byShape = draw({});
  expect(byShape.left).toBeGreaterThan(500);
  expect(byShape.right).toBe(0);
  // Opaque white on the right instead: its light parts are the shape.
  sg.fillStyle = "#ffffff";
  sg.fillRect(50, 0, 50, 100);
  const lit = await createImageBitmap(src);
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  flowTool.draw?.(
    canvas.getContext("2d") as CanvasRenderingContext2D,
    {
      ...defaultsOf(flowTool.params),
      drift: 0,
      fill: false,
      noise: 0,
      order: 0,
      shapeBy: "light",
      source: "picture",
    },
    { height: 900, image: lit, palette: ["#d9bd1c"], width: 900 }
  );
  const d = (canvas.getContext("2d") as CanvasRenderingContext2D).getImageData(
    0,
    0,
    300,
    300
  ).data;
  let rightYellow = 0;
  let leftYellow = 0;
  for (let y = 40; y < 260; y += 1) {
    for (let x = 30; x < 270; x += 1) {
      const i = (y * 300 + x) * 4;
      if (yellow(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0)) {
        if (x > 160) {
          rightYellow += 1;
        } else if (x < 140) {
          leftYellow += 1;
        }
      }
    }
  }
  expect(rightYellow).toBeGreaterThan(500);
  expect(leftYellow).toBe(0);
});
