import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { ReviewPin } from "../../../config/review.js";
import { ReviewPinList } from "./ReviewPinList";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let latest: ReviewPin[] = [];
function Harness() {
  const [pins, setPins] = useState<ReviewPin[]>([
    {
      body: "Element has insufficient color contrast of 2.1.",
      id: "a",
      kind: "accessibility",
      title: "Text contrast is too low",
      wcag: {
        criteria: ["1.4.3"],
        rule: "color-contrast",
        ruleUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
      },
      x: 0.1,
      y: 0.1,
    },
  ]);
  latest = pins;
  return (
    <ReviewPinList
      firstNumber={1}
      image={null}
      onRemove={() => undefined}
      onReorder={() => undefined}
      onSelect={() => undefined}
      onUpdate={(id, next) =>
        setPins((p) => p.map((x) => (x.id === id ? { ...x, ...next } : x)))
      }
      pins={pins}
      selected={null}
    />
  );
}
it("adds a WCAG criterion to an accessibility note and keeps what the scan found", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<Harness />));
  await userEvent.click(
    host.querySelector(
      '[aria-label="Add a WCAG criterion to note 1"]'
    ) as HTMLElement
  );
  const option = await vi.waitFor(() => {
    const o = [...document.querySelectorAll('[role="option"]')].find((x) =>
      x.textContent?.startsWith("2.5.8")
    );
    if (!o) {
      throw new Error("no menu");
    }
    return o as HTMLElement;
  });
  await userEvent.click(option);
  expect(latest[0]?.wcag?.criteria).toEqual(["1.4.3", "2.5.8"]);
  expect(latest[0]?.wcag?.rule).toBe("color-contrast");
});
