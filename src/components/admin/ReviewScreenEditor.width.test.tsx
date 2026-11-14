import "../../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { ReviewScreen } from "../../../config/review.js";

vi.mock("../../cms/PageEditor", () => ({ PageEditor: () => null }));
vi.mock("../../services/reviewService", () => ({ reviewsApi: {} }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { ReviewScreenEditor } = await import("./ReviewScreenEditor");
const { AdminCard } = await import("./AdminFrame");

/** A phone capture is drawn no wider than a large phone, as on the review page. */

const screen = (viewport: ReviewScreen["viewport"]): ReviewScreen => ({
  id: viewport,
  image: {
    height: 844,
    url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    width: 390,
  },
  marks: [],
  note: "",
  pins: [],
  sourceUrl: "",
  title: viewport,
  viewport,
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const canvasWidth = async (viewport: ReviewScreen["viewport"]) => {
  host = document.createElement("div");
  host.style.width = "1200px";
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <ReviewScreenEditor
        firstNumber={1}
        onChange={() => undefined}
        onRemove={() => undefined}
        screen={screen(viewport)}
        slug="t"
      />
    )
  );
  const canvas = host.querySelector<HTMLElement>("[data-review-canvas]");
  return canvas?.getBoundingClientRect().width ?? 0;
};

it("caps a phone screenshot at 420px", async () => {
  expect(await canvasWidth("mobile")).toBeLessThanOrEqual(420);
});

it("lets a desktop screenshot use the column", async () => {
  expect(await canvasWidth("desktop")).toBeGreaterThan(420);
});

it("keeps the screenshot in view beside a long list of notes", async () => {
  await page.viewport(1400, 800);
  const tall: ReviewScreen = {
    ...screen("desktop"),
    image: {
      height: 6000,
      url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      width: 1440,
    },
    pins: Array.from({ length: 30 }, (_, i) => ({
      body: "A note long enough to take some room in the list.",
      id: `p${i}`,
      kind: "issue" as const,
      title: `Note ${i + 1}`,
      x: 0.5,
      y: i / 30,
    })),
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <AdminCard>
        <ReviewScreenEditor
          firstNumber={1}
          onChange={() => undefined}
          onRemove={() => undefined}
          screen={tall}
          slug="t"
        />
      </AdminCard>
    )
  );
  const shot = host.querySelector<HTMLElement>(".review-screen-editor__shot");
  expect(shot && getComputedStyle(shot).position).toBe("sticky");
  // The picture is far taller than the window; its pane is not.
  expect(shot?.getBoundingClientRect().height ?? 0).toBeLessThanOrEqual(800);

  window.scrollTo(0, 1200);
  await new Promise((r) => requestAnimationFrame(r));
  const top = shot?.getBoundingClientRect().top ?? -1;
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(40);
  window.scrollTo(0, 0);
});
