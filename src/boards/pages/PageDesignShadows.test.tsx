import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { PageDesignView } from "./PageDesignView";

it("paints an open panel's shadow beyond its flex group on the page", async () => {
  const panel = {
    ...createConceptElement("panel"),
    shadow: {
      blur: 0,
      color: "#ff0000",
      opacity: 100,
      spread: 0,
      x: -12,
      y: 0,
    },
    text: "Details",
  };
  const group = {
    ...createConceptElement("group"),
    group: { elements: [panel], layout: "row" as const },
  };
  const host = document.createElement("div");
  host.style.width = "400px";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <PageDesignView
          page={{
            boxes: { [group.id]: { height: 160, width: 200, x: 40, y: 40 } },
            concept: {
              ...createConcept(),
              background: "#ffffff",
              elements: [group],
            },
            height: 260,
            kitId: null,
            version: 1,
            width: 400,
          }}
        />
      )
    );
    const surface = host.querySelector(".concept-panel__surface");
    const sheet = host.querySelector(".page-design__sheet");
    const box = host.querySelector(".page-design__component");
    if (!(surface && sheet && box)) {
      throw new Error("Missing panel in page design");
    }
    const bounds = sheet.getBoundingClientRect();
    const panelBounds = surface.getBoundingClientRect();
    const x = panelBounds.left - 6;
    expect(x).toBeLessThan(box.getBoundingClientRect().left);
    const image = new Image();
    image.src = `data:image/png;base64,${await page.screenshot({ element: sheet, save: false })}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Missing canvas context");
    }
    ctx.drawImage(image, 0, 0);
    const pixel = ctx.getImageData(
      ((x - bounds.left) * image.width) / bounds.width,
      ((panelBounds.top + 10 - bounds.top) * image.height) / bounds.height,
      1,
      1
    );
    expect([...pixel.data]).toEqual([255, 0, 0, 255]);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it.each(["row", "column", "grid"] as const)(
  "centers content within the painted %s group frame",
  async (layout) => {
    const link = {
      ...createConceptElement("link"),
      fontSize: 13,
      text: "Details",
    };
    const panel = {
      ...createConceptElement("panel"),
      fontSize: 28,
      slots: { body: { elements: [link] } },
    };
    const group = {
      ...createConceptElement("group"),
      background: "#abcdef",
      borderColor: "#123456",
      borderWidth: 3,
      group: {
        align: "center" as const,
        columns: 1,
        elements: [link],
        justify: "center" as const,
        layout,
      },
      shadow: { blur: 8, color: "#000000", opacity: 50, spread: 2, x: 1, y: 2 },
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          <PageDesignView
            page={{
              boxes: {
                [group.id]: { height: 140, width: 240, x: 0, y: 0 },
                [panel.id]: { height: 140, width: 240, x: 0, y: 150 },
              },
              concept: { ...createConcept(), elements: [group, panel] },
              height: 320,
              kitId: null,
              version: 1,
              width: 250,
            }}
            stepIndex={0}
          />
        )
      );
      const frame = host.querySelector(".page-design__component");
      const surface = host.querySelector(".concept-group");
      const button = surface?.querySelector("button");
      const panelLink = host.querySelector(
        '.concept-panel__surface [data-slot="body"] button'
      );
      if (!(frame && surface && button && panelLink)) {
        throw new Error("Missing group or panel link");
      }
      const bounds = surface.getBoundingClientRect();
      const child = button.getBoundingClientRect();
      expect(bounds.toJSON()).toEqual(frame.getBoundingClientRect().toJSON());
      expect(child.left + child.width / 2).toBeCloseTo(
        bounds.left + bounds.width / 2,
        0
      );
      expect(child.top + child.height / 2).toBeCloseTo(
        bounds.top + bounds.height / 2,
        0
      );
      expect(getComputedStyle(surface).backgroundColor).toBe(
        "rgb(171, 205, 239)"
      );
      expect(getComputedStyle(surface).borderWidth).toBe("3px");
      expect(getComputedStyle(surface).boxShadow).toContain("8px");
      expect(getComputedStyle(panelLink).fontSize).toBe("13px");
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  }
);
