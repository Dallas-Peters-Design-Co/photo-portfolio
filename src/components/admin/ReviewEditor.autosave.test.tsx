import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UxAudit } from "../../../config/reviewAudit.js";
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
const audit = vi.fn(
  (): Promise<{ audit: UxAudit }> =>
    Promise.resolve({
      audit: {
        execSummary: "Clear value proposition.",
        findings: [
          {
            area: "Navigation",
            detail: "Make the CTA more visible.",
            headline: "Primary CTA contrast",
            kind: "recommendation",
            screenId: "s1",
            x: 0.5,
            y: 0.25,
          },
        ],
        nowFraming: "Visitors scan quickly on first arrival.",
        principles: [],
        recommendations: [{ detail: "Add sticky nav.", title: "Navigation" }],
        strengths: [{ detail: "Strong typography.", title: "Type" }],
      },
    })
);

vi.mock("../../services/reviewService", () => ({
  reviewsApi: { audit, capture: vi.fn(), update },
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
  audit.mockClear();
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

  it("runs a UX audit and folds sections and pins into the draft", async () => {
    const withImage: ReviewRecord = {
      ...REVIEW,
      doc: {
        ...REVIEW.doc,
        screens: [
          {
            id: "s1",
            image: { height: 900, url: "https://x.test/shot.png", width: 1440 },
            marks: [],
            note: "",
            pins: [],
            sourceUrl: "https://x.test",
            title: "Home",
            viewport: "desktop",
          },
        ],
      },
    };
    await act(() =>
      root?.render(
        <ReviewEditor
          key="with-image"
          onClose={() => undefined}
          onSaved={() => Promise.resolve()}
          review={withImage}
        />
      )
    );
    const auditBtn = [...(host?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent?.includes("Run UX audit")
    );
    expect(auditBtn?.disabled).toBe(false);
    await act(async () => {
      auditBtn?.click();
      await Promise.resolve();
    });
    expect(audit).toHaveBeenCalledTimes(1);
    await wait(1500);
    expect(update).toHaveBeenCalledTimes(1);
    const [, input] = update.mock.calls[0] ?? [];
    expect(input?.doc?.sections.map((s) => s.title)).toEqual([
      "Strengths",
      "Recommendations",
    ]);
    expect(input?.doc?.screens[0]?.pins[0]?.title).toBe("Primary CTA contrast");
  });
});
