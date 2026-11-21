import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  cleanConceptStyles,
  styleElement,
  withOverrides,
} from "../../../config/conceptStyle.js";
import { cleanElement } from "../../../config/reviewConcept.js";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

it("keeps the badge picker and its drawing together across a review save and kit permission change", async () => {
  const [style] = cleanConceptStyles([
    {
      id: "optional",
      kind: "badge",
      look: { iconName: "GitForkIcon", iconSvg: [["path", { d: "M2 3h5" }]] },
      name: "Optional",
      overridableProps: ["text", "iconSvg", "iconSize"],
    },
  ]);
  expect(style.overridableProps).toEqual(["text", "iconName", "iconSize"]);
  let badge = cleanElement({
    ...createConceptElement("badge"),
    iconName: "AccountSettingIcon",
    overrides: ["iconName"],
    styleId: style.id,
    text: "Optional",
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = () => {
    const element = styleElement(badge, [style]);
    root.render(
      <>
        <ReviewConceptElementFields
          element={element}
          onChange={(patch) => {
            badge = cleanElement({
              ...element,
              ...withOverrides(element, patch),
            });
            render();
          }}
          styles={[style]}
        />
        <div data-preview="">
          <ReviewConceptElementView element={element} />
        </div>
      </>
    );
  };
  try {
    await act(render);
    const drawing = () =>
      host.querySelector("[data-preview] svg path")?.getAttribute("d");
    await expect.poll(drawing).toBeTruthy();
    expect(drawing()).not.toBe("M2 3h5");
    const picker = page.getByRole("button", {
      exact: true,
      name: "Badge start icon",
    });
    expect(picker.element().textContent).toContain("Account Setting");
    await act(() =>
      page.getByRole("textbox", { name: "Content" }).fill("Custom status")
    );
    expect(host.querySelector("[data-preview]")?.textContent).toBe(
      "Custom status"
    );
    expect(host.querySelector('[aria-label="Badge end icon"]')).toBeNull();
    await act(() => picker.click());
    await act(() =>
      page.getByRole("option", { exact: true, name: "No icon" }).click()
    );
    expect(host.querySelector("[data-preview] svg")).toBeNull();
    await act(() =>
      page.getByRole("spinbutton", { name: "Icon size" }).fill("22")
    );
    expect(badge.iconSize).toBe(22);
    await act(() => picker.click());
    await act(() => page.getByPlaceholder("Search icons…").fill("Favourite"));
    await act(() => page.getByTitle("Favourite", { exact: true }).click());
    expect(badge.iconName).toBe("FavouriteIcon");
    expect(badge.iconSvg?.length).toBeGreaterThan(0);
    expect(drawing()).toBeTruthy();
    const svg = host.querySelector<SVGSVGElement>("[data-preview] svg");
    expect(svg?.getBoundingClientRect().width).toBe(22);
    style.overridableProps = ["text"];
    await act(render);
    expect(host.querySelector('[aria-label="Badge start icon"]')).toBeNull();
    expect(drawing()).toBe("M2 3h5");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
