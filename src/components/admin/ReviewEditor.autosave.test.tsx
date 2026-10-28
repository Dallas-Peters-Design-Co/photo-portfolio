import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewRecord } from "../../services/reviewService";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The review draft saves itself, so Preview — which opens the saved copy —
 * shows what is in the editor, and a capture is never only in one tab.
 */

const update = vi.fn((_slug: string, input: Partial<ReviewRecord>) =>
  Promise.resolve({ ...REVIEW, ...input })
);

vi.mock("../../services/reviewService", () => ({
  reviewsApi: { capture: vi.fn(), update },
}));
vi.mock("../../cms/PageEditor", () => ({ PageEditor: () => null }));
vi.mock("./ReviewSendPanel", () => ({ ReviewSendPanel: () => null }));
vi.mock("../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ kits: [] }),
}));
vi.mock("../../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({ settings: { theme: { accent: "#7c7f01" } } }),
}));

const REVIEW: ReviewRecord = {
  brand: null,
  brandKitId: null,
  clientEmail: null,
  clientName: "",
  createdAt: "2026-10-18T00:00:00Z",
  doc: { closing: "", intro: "", screens: [], sections: [], summary: "" },
  id: "r1",
  sent: null,
  slug: "back-acres",
  status: "draft",
  title: "Back Acres",
  updatedAt: "2026-10-18T00:00:00Z",
};

const { ReviewEditor } = await import("./ReviewEditor");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(async () => {
  update.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <ReviewEditor
        onClose={() => undefined}
        onSaved={() => Promise.resolve()}
        review={REVIEW}
      />
    )
  );
});

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const wait = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const addScreen = () =>
  [...(host?.querySelectorAll("button") ?? [])]
    .find((b) => b.textContent?.includes("Add screen"))
    ?.click();

describe("ReviewEditor autosave", () => {
  it("does not save a review nobody has touched", async () => {
    await wait(1500);
    expect(update).not.toHaveBeenCalled();
    expect(host?.textContent).toContain("All changes saved");
  });

  it("saves a change on its own, without the address or status", async () => {
    await act(() => addScreen());
    expect(host?.textContent).toContain("Unsaved changes");
    await wait(1500);
    expect(update).toHaveBeenCalledTimes(1);
    const [slug, input] = update.mock.calls[0] ?? [];
    expect(slug).toBe("back-acres");
    expect(input?.doc?.screens).toHaveLength(1);
    expect(input).not.toHaveProperty("slug");
    expect(input).not.toHaveProperty("status");
    expect(host?.textContent).toContain("All changes saved");
  });

  it("saves what's pending when the editor closes mid-pause", async () => {
    await act(() => addScreen());
    await act(() => root?.unmount());
    root = null;
    expect(update).toHaveBeenCalledTimes(1);
  });
});
