import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConcept,
  createConceptElement,
} from "../../config/conceptDefaults.js";
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

const { signDoc, storeDoc } = await import("./reviewImages.js");
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
  it("stores and signs images inside grouped canvas components and page states", async () => {
    const item = screen("a", "https://example.com/a.png");
    const component = {
      height: 100,
      id: "component",
      kitId: "kit",
      layers: [
        {
          body: null,
          config: null,
          fontSize: null,
          height: 100,
          imageUrl: BOARD_PICTURE,
          kind: "photo" as const,
          lid: "image",
          thumbUrl: null,
          width: 100,
          x: 0,
          y: 0,
        },
      ],
      name: "Picture",
      placement: {},
      props: [],
      updatedAt: "",
      width: 100,
    };
    const canvas = {
      ...createConceptElement("canvas"),
      canvasComponent: component,
    };
    const group = {
      ...createConceptElement("group"),
      group: { elements: [canvas] },
    };
    const concept = {
      ...createConcept(),
      elements: [group],
      steps: [{ caption: "", elements: [canvas], id: "two" }],
    };
    item.pins = [
      {
        body: "",
        concepts: [concept],
        id: "pin",
        kind: "recommendation",
        title: "",
        x: 0,
        y: 0,
      },
    ];
    item.pageDesign = {
      boxes: {},
      concept,
      height: 900,
      kitId: null,
      version: 1,
      width: 1440,
    };
    const storedDoc = await storeDoc(doc(item));
    const [saved] = storedDoc.screens;
    expect(
      saved?.pins[0]?.concepts?.[0]?.elements[0]?.group?.elements[0]
        ?.canvasComponent?.layers[0]?.imageUrl
    ).toMatch(COPIED);
    expect(
      saved?.pageDesign?.concept.steps?.[0]?.elements[0]?.canvasComponent
        ?.layers[0]?.imageUrl
    ).toMatch(COPIED);
    vi.mocked(blob.issueSignedToken).mockResolvedValue("signed-token" as never);
    vi.mocked(blob.presignUrl).mockResolvedValue({
      presignedUrl: "https://signed.example/image",
    } as never);
    const signed = await signDoc({ doc: storedDoc });
    const [signedScreen] = signed.doc.screens;
    expect(
      signedScreen?.pins[0]?.concepts?.[0]?.elements[0]?.group?.elements[0]
        ?.canvasComponent?.layers[0]?.imageUrl
    ).toBe("https://signed.example/image");
    expect(
      signedScreen?.pageDesign?.concept.steps?.[0]?.elements[0]?.canvasComponent
        ?.layers[0]?.imageUrl
    ).toBe("https://signed.example/image");
  });
  it("keeps component images private and signs them for review visitors", async () => {
    const item = screen("a", "https://example.com/a.png");
    const concept = createConcept();
    concept.canvasComponent = {
      height: 100,
      id: "component",
      kitId: "kit",
      layers: [
        {
          body: null,
          config: null,
          fontSize: null,
          height: 100,
          imageUrl: BOARD_PICTURE,
          kind: "photo",
          lid: "image",
          thumbUrl: null,
          width: 100,
          x: 0,
          y: 0,
        },
      ],
      name: "Picture",
      placement: {},
      props: [],
      updatedAt: "",
      width: 100,
    };
    item.pins = [
      {
        body: "",
        concepts: [concept],
        id: "pin",
        kind: "recommendation",
        title: "",
        x: 0,
        y: 0,
      },
    ];
    const result = await storeDoc(doc(item));
    const layer =
      result.screens[0]?.pins[0]?.concepts?.[0]?.canvasComponent?.layers[0];
    expect(layer?.imageUrl).toMatch(COPIED);
    vi.mocked(blob.issueSignedToken).mockResolvedValue("signed-token" as never);
    vi.mocked(blob.presignUrl).mockResolvedValue({
      presignedUrl: "https://signed.example/image",
    } as never);
    const signed = await signDoc({ doc: result });
    expect(
      signed.doc.screens[0]?.pins[0]?.concepts?.[0]?.canvasComponent?.layers[0]
        ?.imageUrl
    ).toBe("https://signed.example/image");
  });
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
