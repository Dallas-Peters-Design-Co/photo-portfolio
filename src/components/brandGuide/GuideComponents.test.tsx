import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import "../../index.css";
import "./BrandGuide.css";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { ComponentSection } from "./GuideComponents";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("lists the kit's components grouped by kind, each drawn beside its facts", () => {
  const host = document.createElement("div");
  host.style.cssText = "padding:24px;width:900px;background:#fff;color:#111";
  document.body.style.margin = "0";
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ComponentSection
        doc={{
          ...EMPTY_KIT,
          componentStyles: [
            {
              id: "b1",
              kind: "button",
              look: { background: "#3538cd", color: "#ffffff", radius: 999 },
              name: "Primary",
            },
            {
              id: "g1",
              kind: "badge",
              look: { background: "#ecfdf3", color: "#027a48", radius: 999 },
              name: "Success",
            },
            {
              id: "b2",
              kind: "button",
              look: {
                background: "#ffffff",
                borderColor: "#d0d5dd",
                color: "#344054",
                radius: 8,
              },
              name: "Secondary",
            },
          ],
        }}
      />
    )
  );
  const titles = [...host.querySelectorAll(".guide-component h3")].map(
    (h) => h.textContent
  );
  expect(titles).toEqual([
    "Button / Primary",
    "Button / Secondary",
    "Badge / Success",
  ]);
  expect(host.querySelectorAll(".guide-component__sample button")).toHaveLength(
    2
  );
  host.remove();
});

it("says so when the kit has none", () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<ComponentSection doc={EMPTY_KIT} />));
  expect(host.textContent).toContain("No component styles yet.");
  host.remove();
});
