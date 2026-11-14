import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_DOC, type ReviewScreen } from "../../config/review.js";

const stored = new Map<string, string>();
vi.mock("@vercel/blob", () => ({
  head: vi.fn((pathname: string) => {
    const url = stored.get(pathname);
    return url
      ? Promise.resolve({ url })
      : Promise.reject(new Error("not found"));
  }),
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
  put: vi.fn((pathname: string) => {
    const url = `https://store.private.blob.vercel-storage.com/${pathname}`;
    stored.set(pathname, url);
    return Promise.resolve({ url });
  }),
}));

const { storeDoc } = await import("./reviewImages.js");
const blob = await import("@vercel/blob");

const COPIED =
  /^https:\/\/store\.private\.blob\.vercel-storage\.com\/reviews\/copied\//;
const BOARD_PICTURE =
  "https://abc123.public.blob.vercel-storage.com/boards/a.png";

const screen = (id: string, url: string): ReviewScreen => ({
  id,
  image: { height: 900, url, width: 1440 },
  marks: [],
  note: "",
  pins: [],
  sourceUrl: "",
  title: id,
  viewport: "desktop",
});

const doc = (...screens: ReviewScreen[]) => ({
  ...DEFAULT_REVIEW_DOC,
  screens,
});

beforeEach(() => {
  stored.clear();
  vi.clearAllMocks();
  process.env.REVIEW_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_store_secret";
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.REVIEW_BLOB_READ_WRITE_TOKEN;
});

describe("storeDoc", () => {
  it("copies a board's public picture into the private store, once", async () => {
    const first = await storeDoc(doc(screen("a", BOARD_PICTURE)));
    const url = first.screens[0]?.image?.url ?? "";
    expect(url).toMatch(COPIED);
    expect(blob.put).toHaveBeenCalledTimes(1);

    // Publishing the same picture again finds the copy instead of making one.
    const again = await storeDoc(doc(screen("a", BOARD_PICTURE)));
    expect(again.screens[0]?.image?.url).toBe(url);
    expect(blob.put).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("strips signatures and leaves private and outside pictures where they are", async () => {
    const result = await storeDoc(
      doc(
        screen(
          "p",
          "https://store.private.blob.vercel-storage.com/x.png?vercel-blob-signature=y"
        ),
        screen("o", "https://example.com/elsewhere.png")
      )
    );
    expect(result.screens.map((s) => s.image?.url)).toEqual([
      "https://store.private.blob.vercel-storage.com/x.png",
      "https://example.com/elsewhere.png",
    ]);
    expect(blob.put).not.toHaveBeenCalled();
  });

  it("keeps the public picture when the site has no private store", async () => {
    delete process.env.REVIEW_BLOB_READ_WRITE_TOKEN;
    const result = await storeDoc(doc(screen("a", BOARD_PICTURE)));
    expect(result.screens[0]?.image?.url).toBe(BOARD_PICTURE);
  });
});
