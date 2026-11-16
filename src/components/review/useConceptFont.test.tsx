import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("loads an app font such as Exposure where the element is drawn", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  // As saved: an element set in the app's own Exposure face.
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("text"),
          fontFamily: "app",
          fontId: "exposure",
          text: "Data Ingestion",
        }}
      />
    )
  );
  await expect
    .poll(() => document.fonts.check('16px "Exposure[0]"', "Data"), {
      timeout: 5000,
    })
    .toBe(true);
  await expect
    .poll(
      () =>
        [...document.fonts].some(
          (face) => face.family.includes("Exposure") && face.status === "loaded"
        ),
      { timeout: 5000 }
    )
    .toBe(true);
  act(() => root.unmount());
  host.remove();
});
