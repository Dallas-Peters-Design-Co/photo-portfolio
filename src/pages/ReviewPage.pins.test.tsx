import "./ReviewPage.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_DOC, type ReviewPin } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";

/** A pin on the screenshot brings its note to the top of the window. */

const pin = (id: string, title: string, y: number): ReviewPin => ({
  body: "A long explanation. ".repeat(40),
  id,
  kind: "issue",
  title,
  x: 0.5,
  y,
});

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
        pins: [
          pin("a", "First", 0.1),
          pin("b", "Second", 0.5),
          pin("c", "Third", 0.9),
        ],
        sourceUrl: "",
        title: "Home",
        viewport: "desktop",
      },
    ],
  },
  feedback: [],
  hasPassword: false,
  id: "r1",
  sent: null,
  slug: "pins",
  status: "published",
  title: "Pins",
  updatedAt: "2026-11-13T00:00:00.000Z",
};

vi.mock("../services/reviewService", () => ({
  ReviewLockedError: class extends Error {},
  reviewsApi: { get: () => Promise.resolve(REVIEW) },
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

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

it("scrolls a clicked pin's note to the top and marks it", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/review/pins"]}>
        <Routes>
          <Route element={<ReviewPage />} path="/review/:slug" />
        </Routes>
      </MemoryRouter>
    );
  });
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

  const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
  const third = host.querySelector(
    '[aria-label="Note 3: Third"]'
  ) as HTMLButtonElement;
  await act(() => third.click());

  const note = document.getElementById("note-c");
  expect(scrolled.mock.contexts[0]).toBe(note);
  expect(scrolled.mock.calls[0]?.[0]).toMatchObject({ block: "start" });
  expect(note?.className).toContain("review-page__note--shown");
  scrolled.mockRestore();
});
