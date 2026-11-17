import "../index.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import type { BrandMerge } from "../../config/brandMerge.js";
import { DEFAULT_REVIEW_DOC } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";

/**
 * A brand merge writeup from the client's side: behind the review's own
 * password, then the writeup in the case-study layout.
 */

class LockedError extends Error {
  readonly title: string;
  constructor(title: string) {
    super("locked");
    this.title = title;
  }
}

const PICTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#041045"/></svg>')}`;

const MERGE: BrandMerge = {
  brandA: null,
  brandB: null,
  brands: [
    {
      audience: "Product teams",
      name: "RoleModel",
      summary: "A software consultancy that builds and coaches.",
      voice: "Plain and warm",
    },
    {
      audience: "Founders",
      name: "Acme",
      summary: "A studio for first products.",
      voice: "Bold and quick",
    },
  ],
  comparison: [
    {
      a: "Navy and white",
      aspect: "Colour",
      b: "Orange and black",
      takeaway: "Pick one lead colour",
    },
  ],
  generatedAt: "2026-11-16T00:00:00.000Z",
  hero: { height: 900, url: PICTURE, width: 1600 },
  options: [
    {
      changes: ["Acme's name retires"],
      how: "Acme becomes a RoleModel service.",
      image: { height: 900, url: PICTURE, width: 1600 },
      keeps: ["RoleModel's mark"],
      name: "RoleModel absorbs Acme",
      risks: ["Acme's clients feel lost"],
      summary: "One brand, RoleModel's.",
      when: "When Acme's name is not what clients buy.",
    },
    {
      changes: ["A shared 'by RoleModel' line"],
      how: "Acme keeps its name, endorsed.",
      image: null,
      keeps: ["Both names"],
      name: "Acme, by RoleModel",
      risks: ["Two brands to run"],
      summary: "Acme stays, endorsed.",
      when: "When Acme's name carries weight.",
    },
  ],
  outcome: "One brand is simpler; an endorsed brand keeps Acme's clients.",
  overview: "Two studios are joining.\n\nThe choice turns on what clients buy.",
  recommendation: {
    option: "Acme, by RoleModel",
    why: "Acme's clients know its name.",
  },
  title: "RoleModel + Acme",
};

let locked = true;
const REVIEW: ReviewRecord = {
  brand: null,
  brandKitId: null,
  clientEmail: null,
  clientName: "Acme",
  createdAt: "2026-11-13T00:00:00.000Z",
  doc: { ...DEFAULT_REVIEW_DOC, merge: MERGE },
  feedback: [],
  hasPassword: true,
  id: "r1",
  sent: null,
  slug: "acme-review",
  status: "published",
  title: "Acme review",
  updatedAt: "2026-11-13T00:00:00.000Z",
};

vi.mock("../services/reviewService", () => ({
  ReviewLockedError: LockedError,
  reviewsApi: {
    get: () =>
      locked
        ? Promise.reject(new LockedError("Acme review"))
        : Promise.resolve(REVIEW),
    unlock: () => {
      locked = false;
      return Promise.resolve();
    },
  },
}));
vi.mock("../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({
    settings: { ownerName: "Dallas Peters", theme: { accent: "#e0a526" } },
  }),
}));
vi.mock("./pagePdf", () => ({
  downloadPagePdf: vi.fn(),
  downloadReviewPdf: vi.fn(),
}));

const { ReviewMergePage } = await import("./ReviewMergePage");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const mount = async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/review/acme-review/merge"]}>
        <Routes>
          <Route element={<ReviewMergePage />} path="/review/:slug/merge" />
        </Routes>
      </MemoryRouter>
    );
  });
  await flush();
  return host;
};

it("asks for the review's password, then shows the writeup", async () => {
  locked = true;
  const box = await mount();
  expect(box.textContent).toContain("Acme review");
  expect(box.textContent).not.toContain("RoleModel absorbs Acme");

  const password = box.querySelector(
    'input[type="password"]'
  ) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set?.call(password, "pw");
  password.dispatchEvent(new Event("input", { bubbles: true }));
  await act(() =>
    (document.querySelector(".review-lock") as HTMLFormElement).requestSubmit()
  );
  await flush();
  await flush();

  expect(box.querySelector("h1")?.textContent).toBe("RoleModel + Acme.");
  expect(box.querySelectorAll(".merge-page__option")).toHaveLength(2);
  expect(box.querySelector("#recommendation")?.textContent).toContain(
    "Acme, by RoleModel"
  );
  expect(box.querySelector(".merge-page__table tbody th")?.textContent).toBe(
    "Colour"
  );
  expect(box.querySelector('#overview a[href="#option-2"]')?.textContent).toBe(
    "Acme, by RoleModel"
  );
});
