import { describe, expect, it } from "vitest";
import { normalizeTextStyle, textStyleCss } from "../../../config/textStyle";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { textHtml } from "./exportHtml5";
import { renderCreative } from "./exportPng";

describe("text outline and box", () => {
  it("stores an outline only with a colour and a width, and a box only with a colour", () => {
    expect(
      normalizeTextStyle({ outline: "#FF0000", outlineWidth: 0.05 })
    ).toMatchObject({
      outline: "#ff0000",
      outlineWidth: 0.05,
    });
    expect(normalizeTextStyle({ outline: "#ff0000" })).toBeNull();
    expect(normalizeTextStyle({ outlineWidth: 0.05 })).toBeNull();
    expect(
      normalizeTextStyle({
        background: "#11223344",
        backgroundPadding: 9,
        backgroundRadius: 0.2,
        outline: "red",
        outlineWidth: 5,
      })
    ).toEqual({
      align: null,
      background: "#11223344",
      backgroundPadding: 2,
      backgroundRadius: 0.2,
      color: null,
      family: null,
      italic: null,
      letterSpacing: null,
      lineHeight: null,
      transform: null,
      weight: null,
    });
    // A style with neither reads back exactly as before.
    expect(
      Object.keys(normalizeTextStyle({ color: "#000000" }) ?? {})
    ).not.toContain("outline");
  });

  it("turns them into CSS, the outline outside the letters", () => {
    const css = textStyleCss({
      fontSize: 40,
      kind: "text",
      textStyle: normalizeTextStyle({
        background: "#c63b2e",
        backgroundPadding: 0.3,
        backgroundRadius: 0.2,
        outline: "#000000",
        outlineWidth: 0.05,
      }),
    });
    expect(css).toMatchObject({
      backgroundColor: "#c63b2e",
      borderRadius: "0.2em",
      padding: "0.3em",
      paintOrder: "stroke fill",
      WebkitTextStroke: "0.1em #000000",
    });
  });

  it("writes them into the HTML5 ad", () => {
    const html = textHtml(
      "Hello",
      {
        backgroundColor: "rgb(198, 59, 46)",
        borderRadius: "8px",
        color: "rgb(255, 255, 255)",
        fontFamily: "Inter",
        fontKerning: "auto",
        fontSize: "40px",
        fontStyle: "normal",
        fontWeight: "700",
        letterSpacing: "normal",
        lineHeight: "48px",
        paddingLeft: "12px",
        paddingTop: "12px",
        textAlign: "left",
        textStrokeColor: "rgb(0, 0, 0)",
        textStrokeWidth: "4px",
        textTransform: "none",
      },
      { height: "100px", left: "0px", top: "0px", width: "300px" },
      2
    );
    expect(html).toContain("background:rgb(198, 59, 46)");
    expect(html).toContain("border-radius:16px");
    expect(html).toContain("-webkit-text-stroke:8px rgb(0, 0, 0)");
    expect(html).toContain("paint-order:stroke fill");
  });

  it("draws the box and the outline into the PNG", async () => {
    const item: BoardItem = {
      ...BLANK_ITEM,
      body: "HI",
      fontSize: 60,
      height: 100,
      id: "t1",
      kind: "text",
      textStyle: normalizeTextStyle({
        background: "#0000ff",
        backgroundPadding: 0.2,
        color: "#ffffff",
        outline: "#ff0000",
        outlineWidth: 0.08,
      }),
      width: 200,
      x: 0,
      y: 0,
    } as BoardItem;
    const el = document.createElement("div");
    Object.assign(el.style, textStyleCss(item), {
      height: "100px",
      width: "200px",
    });
    el.textContent = "HI";
    document.body.append(el);
    const blob = await renderCreative(
      { height: 100, width: 200, x: 0, y: 0 },
      [item],
      200,
      () => el
    );
    el.remove();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(200, 100);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0);
    const corner = [...ctx.getImageData(195, 95, 1, 1).data];
    expect(corner.slice(0, 3)).toEqual([0, 0, 255]);
    const pixels = ctx.getImageData(0, 0, 200, 100).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        (pixels[i] ?? 0) > 200 &&
        (pixels[i + 1] ?? 0) < 60 &&
        (pixels[i + 2] ?? 0) < 60
      ) {
        red += 1;
      }
    }
    expect(red).toBeGreaterThan(50);
  });
});
