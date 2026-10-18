import "./ReviewPage.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_DOC } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";

/**
 * "Download PDF" on the review page, from the client's chair: the button is
 * there once the review has loaded, asks the server for this review's PDF,
 * says it is working while it waits, and reports a failure in place. And the
 * print rules the server's browser applies keep the button out of the file.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const REVIEW: ReviewRecord = {
  brand: null,
  brandKitId: null,
  clientEmail: null,
  clientName: "Back Acres",
  createdAt: "2026-10-16T00:00:00.000Z",
  doc: DEFAULT_REVIEW_DOC,
  id: "r1",
  sent: null,
  slug: "back-acres",
  status: "published",
  title: "Back Acres site review",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

vi.mock("../services/reviewService", () => ({
  reviewsApi: { get: () => Promise.resolve(REVIEW) },
}));
vi.mock("../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({
    settings: { ownerName: "Dallas Peters", theme: { accent: "#7c7f01" } },
  }),
}));

let resolvePdf: (() => void) | null = null;
let rejectPdf: ((e: Error) => void) | null = null;
const downloadReviewPdf = vi.fn(
  (_slug: string) =>
    new Promise<void>((resolve, reject) => {
      resolvePdf = resolve;
      rejectPdf = reject;
    })
);
vi.mock("./pagePdf", () => ({ downloadPagePdf: vi.fn(), downloadReviewPdf }));

const { ReviewPage } = await import("./ReviewPage");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const mount = async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/review/back-acres"]}>
        <Routes>
          <Route element={<ReviewPage />} path="/review/:slug" />
        </Routes>
      </MemoryRouter>
    );
  });
  await flush();
};

const button = () =>
  host?.querySelector<HTMLButtonElement>(".review-page__pdf") ?? null;

beforeEach(() => {
  downloadReviewPdf.mockClear();
});

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

describe("ReviewPage — Download PDF", () => {
  it("downloads this review's PDF and says it is working meanwhile", async () => {
    await mount();
    expect(button()?.textContent).toBe("Download PDF");
    await act(() => {
      button()?.click();
    });
    expect(downloadReviewPdf).toHaveBeenCalledWith("back-acres");
    expect(button()?.textContent).toBe("Preparing PDF…");
    expect(button()?.disabled).toBe(true);
    await act(() => {
      resolvePdf?.();
    });
    await flush();
    expect(button()?.textContent).toBe("Download PDF");
  });

  it("shows a failure beside the button", async () => {
    await mount();
    await act(() => {
      button()?.click();
    });
    await act(() => {
      rejectPdf?.(new Error("Could not render the PDF."));
    });
    await flush();
    expect(host?.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not render the PDF."
    );
  });

  it("keeps the button out of the printed page", async () => {
    await mount();
    const masthead = host?.querySelector(".review-page__masthead");
    expect(masthead?.contains(button())).toBe(true);
    const printRules = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
      .filter((rule) => rule.conditionText === "print")
      .flatMap((rule) => [...rule.cssRules])
      .map((rule) => rule.cssText);
    expect(
      printRules.some(
        (text) =>
          text.includes(".review-page__masthead") &&
          text.includes("display: none")
      )
    ).toBe(true);
  });
});
