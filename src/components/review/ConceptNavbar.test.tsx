import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("draws a navbar's start, middle and end in one row, the middle widest", () => {
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ReviewConceptElementView element={createConceptElement("navbar")} />
    )
  );
  const [start, middle, end] = ["header", "body", "footer"].map(
    (name) =>
      host
        .querySelector(`.concept-navbar [data-slot="${name}"]`)
        ?.getBoundingClientRect() as DOMRect
  );
  const centre = (r?: DOMRect) => (r ? r.top + r.height / 2 : 0);
  expect(Math.abs(centre(start) - centre(middle))).toBeLessThan(1);
  expect(Math.abs(centre(end) - centre(middle))).toBeLessThan(1);
  expect(end?.left).toBeGreaterThan(middle?.left ?? 0);
  expect(middle?.width).toBeGreaterThan(end?.width ?? 0);
  expect(host.querySelector(".concept-logo")).not.toBeNull();
});
