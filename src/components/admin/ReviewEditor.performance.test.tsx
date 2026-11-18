import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { createConcept } from "../../../config/conceptDefaults.js";
import { DEFAULT_REVIEW_DOC } from "../../../config/review.js";
import type { ReviewRecord } from "../../services/reviewService";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const richRenders = vi.fn();
vi.mock("../../cms/PageEditor", () => ({
  PageEditor: (props: { value: unknown }) => {
    richRenders(props.value);
    return null;
  },
}));
vi.mock("../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ kits: [] }),
}));
vi.mock("../../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({ settings: { theme: { accent: "#123456" } } }),
}));
vi.mock("../../services/reviewService", () => ({
  reviewsApi: { update: vi.fn(() => Promise.resolve({})) },
}));
vi.mock("./ReviewSendPanel", () => ({ ReviewSendPanel: () => null }));

const { ReviewEditor } = await import("./ReviewEditor");
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const review: ReviewRecord = {
  brand: null,
  brandKitId: null,
  clientEmail: null,
  clientName: "",
  createdAt: "2026-11-17T00:00:00Z",
  doc: {
    ...DEFAULT_REVIEW_DOC,
    screens: Array.from({ length: 8 }, (_, s) => ({
      id: `s${s}`,
      image: {
        height: 900,
        url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        width: 1440,
      },
      marks: [],
      note: `Screen ${s} note`,
      pins: Array.from({ length: 3 }, (_pin, p) => ({
        body: "Recommendation",
        concepts: [createConcept()],
        id: `s${s}-p${p}`,
        kind: "recommendation" as const,
        title: `Note ${p}`,
        x: 0.5,
        y: 0.2,
      })),
      sourceUrl: "",
      title: `Screen ${s}`,
      viewport: "desktop" as const,
    })),
  },
  feedback: [],
  hasPassword: false,
  id: "performance-review",
  sent: null,
  slug: "performance-review",
  status: "draft",
  title: "Large review",
  updatedAt: "2026-11-17T00:00:00Z",
};

it("keeps unrelated screens out of a typing update", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const commits: number[] = [];
  await act(() =>
    root.render(
      <MemoryRouter>
        <Profiler
          id="review"
          onRender={(_id, _phase, duration) => commits.push(duration)}
        >
          <ReviewEditor
            onClose={() => undefined}
            onSaved={() => Promise.resolve()}
            review={review}
          />
        </Profiler>
      </MemoryRouter>
    )
  );
  richRenders.mockClear();
  commits.length = 0;
  const input = host.querySelector<HTMLInputElement>("#screen-title-s0");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(() => {
    setter?.call(input, "Edited screen");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  console.info("Review typing profile", {
    duration: commits.reduce((a, b) => a + b, 0),
    richEditorsRendered: richRenders.mock.calls.length,
  });
  expect(input?.value).toBe("Edited screen");
  expect(richRenders.mock.calls.length).toBeLessThanOrEqual(1);
});
