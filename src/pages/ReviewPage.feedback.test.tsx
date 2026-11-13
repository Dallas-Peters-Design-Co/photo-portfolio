import "./ReviewPage.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_DOC } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";

/**
 * The review page from the client's side: a review behind a password asks
 * for it first, and once open, the client can pin a comment to a spot on a
 * screen and post it.
 */

class LockedError extends Error {
  readonly title: string;
  constructor(title: string) {
    super("locked");
    this.title = title;
  }
}

let locked = true;
const REVIEW: ReviewRecord = {
  brand: null,
  brandKitId: null,
  clientEmail: null,
  clientName: "Vin",
  createdAt: "2026-11-13T00:00:00.000Z",
  doc: {
    ...DEFAULT_REVIEW_DOC,
    screens: [
      {
        id: "s1",
        image: {
          height: 500,
          url: "https://blob.example.com/s1.png",
          width: 1000,
        },
        marks: [],
        note: "",
        pins: [],
        sourceUrl: "https://app.example.com",
        title: "Home",
        viewport: "desktop",
      },
    ],
  },
  feedback: [],
  hasPassword: true,
  id: "r1",
  sent: null,
  slug: "pretext-review",
  status: "published",
  title: "Pretext audit",
  updatedAt: "2026-11-13T00:00:00.000Z",
};

const unlock = vi.fn(() => {
  locked = false;
  return Promise.resolve();
});
const comment = vi.fn(
  async (_slug: string, input: Record<string, unknown>) => ({
    ...input,
    createdAt: "2026-11-13T01:00:00.000Z",
    id: "f1",
    resolved: false,
  })
);

vi.mock("../services/reviewService", () => ({
  ReviewLockedError: LockedError,
  reviewsApi: {
    comment,
    get: () =>
      locked
        ? Promise.reject(new LockedError("Pretext audit"))
        : Promise.resolve(REVIEW),
    unlock,
  },
}));
vi.mock("../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({
    settings: { ownerName: "Dallas Peters", theme: { accent: "#7c7f01" } },
  }),
}));
vi.mock("./pagePdf", () => ({
  downloadPagePdf: vi.fn(),
  downloadReviewPdf: vi.fn(),
}));

const { ReviewPage } = await import("./ReviewPage");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

describe("ReviewPage for a client", () => {
  it("asks for the password, opens the review, and posts a comment pinned to a spot", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(() => {
      root?.render(
        <MemoryRouter initialEntries={["/review/pretext-review"]}>
          <Routes>
            <Route element={<ReviewPage />} path="/review/:slug" />
          </Routes>
        </MemoryRouter>
      );
    });
    await flush();
    expect(host.textContent).toContain("This review is private");
    expect(host.textContent).toContain("Pretext audit");
    expect(host.textContent).not.toContain("Home");

    const password = host.querySelector(
      'input[type="password"]'
    ) as HTMLInputElement;
    await act(() => type(password, "open sesame"));
    await act(() =>
      (
        document.querySelector(".review-lock") as HTMLFormElement
      ).requestSubmit()
    );
    await flush();
    await flush();
    expect(unlock).toHaveBeenCalledWith("pretext-review", "open sesame");
    expect(host.textContent).toContain("Home");

    const open = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Comment on this screen"
    ) as HTMLButtonElement;
    await act(() => open.click());
    const surface = host.querySelector(
      ".review-feedback__surface"
    ) as HTMLElement;
    const box = surface.getBoundingClientRect();
    await act(() => {
      surface.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: box.left + box.width / 4,
          clientY: box.top + box.height / 2,
          pointerId: 1,
        })
      );
    });
    await act(() =>
      type(
        document.querySelector(
          'textarea[aria-label="Your comment"]'
        ) as HTMLTextAreaElement,
        "Make this bigger"
      )
    );
    await act(() =>
      type(
        document.querySelector(
          'input[aria-label="Your name"]'
        ) as HTMLInputElement,
        "Vin"
      )
    );
    await act(() =>
      (
        document.querySelector(".review-feedback__composer") as HTMLFormElement
      ).requestSubmit()
    );
    await flush();
    const [slug, input] = comment.mock.calls[0] as [
      string,
      { author: string; body: string; screenId: string; x: number },
    ];
    expect(slug).toBe("pretext-review");
    expect(input).toMatchObject({
      author: "Vin",
      body: "Make this bigger",
      screenId: "s1",
    });
    expect(input.x).toBeCloseTo(0.25, 1);
    expect(host.querySelector(".review-feedback__pin")?.textContent).toBe("A");
    expect(host.querySelector(".review-feedback__body")?.textContent).toBe(
      "Make this bigger"
    );
  });
});
