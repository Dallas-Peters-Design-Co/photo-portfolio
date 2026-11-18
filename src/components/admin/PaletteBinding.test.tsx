import type { CSSProperties } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import {
  copyComponentLook,
  pasteComponentLook,
} from "../../../config/componentStyleTransfer.js";
import {
  paletteIds,
  paletteProperties,
  paletteToken,
} from "../../../config/paletteBinding.js";
import { cleanElement } from "../../../config/reviewConcept.js";
import { ConceptColorField } from "./ReviewConceptBrand";

it("remembers the selected variable when equal colours diverge, including after copy and reopen", async () => {
  const palette = [
    { name: "Accent", role: "primary", value: "#334455" },
    { name: "Info", role: "info", value: "#334455" },
  ];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let stored = "#334455";
  const draw = (colors: typeof palette) =>
    root.render(
      <div style={paletteProperties(colors) as CSSProperties}>
        <ConceptColorField
          ariaLabel="Fill"
          brandDoc={{ ...EMPTY_KIT, palette: colors }}
          label="Fill"
          onChange={(value) => {
            stored = value;
          }}
          value={stored}
        />
        <span data-preview="" style={{ backgroundColor: stored }} />
      </div>
    );
  try {
    await act(() => draw(palette));
    await page.getByRole("button", { exact: true, name: "Fill" }).click();
    await page.getByRole("button", { name: "Info · info" }).click();
    expect(stored).toBe(paletteToken(paletteIds(palette)[1], "#334455"));
    const source = cleanElement({ background: stored, kind: "card" });
    const target = cleanElement({ kind: "button" });
    stored = cleanElement({
      ...target,
      ...pasteComponentLook(target, "card", copyComponentLook(source)),
    }).background;
    await act(() => root.render(null));
    await act(() => draw([palette[0], { ...palette[1], value: "#119944" }]));
    expect(
      getComputedStyle(host.querySelector("[data-preview]") as HTMLElement)
        .backgroundColor
    ).toBe("rgb(17, 153, 68)");
    expect(host.querySelector("button")?.title).toContain("Info");
    await page.getByRole("button", { exact: true, name: "Fill" }).click();
    await expect
      .element(page.getByRole("button", { name: "Info · info" }))
      .toHaveAttribute("aria-pressed", "true");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
