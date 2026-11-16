import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { PinWcagLinks } from "./PinWcagLinks";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("says which WCAG criterion fails and links to how to fix it", () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <PinWcagLinks
        wcag={{
          criteria: ["1.4.3"],
          rule: "color-contrast",
          ruleUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
        }}
      />
    )
  );
  expect(host.textContent).toContain(
    "Fails WCAG 1.4.3 Contrast (Minimum) (AA)."
  );
  const links = [...host.querySelectorAll("a")].map((a) => a.href);
  expect(links).toEqual([
    "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
  ]);
});
