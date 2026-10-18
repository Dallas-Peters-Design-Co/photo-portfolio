import { afterEach, describe, expect, it, vi } from "vitest";
import { portfolioService } from "./portfolioService";

/**
 * What "Save details" actually sends.
 *
 * The browser-frame toggle and its address were typed on updatePhoto's input
 * and collected by the editor, but left out of the request body, so saving
 * them did nothing. The API reads exactly these keys.
 */

const sent = (): Record<string, unknown> => {
  const [call] = vi.mocked(globalThis.fetch).mock.calls;
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
};

const PHOTO = {
  alt: "",
  category: "web",
  categoryId: "c1",
  categoryLabel: "Web",
  chromeUrl: "backacres.com",
  createdAt: "2026-10-01T00:00:00.000Z",
  exif: null,
  height: 900,
  id: "p1",
  isFeatured: false,
  isPublished: true,
  lqip: null,
  order: 1,
  originalUrl: null,
  showChrome: true,
  title: "Home",
  url: "https://x.test/p1.png",
  width: 1440,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("portfolioService.updatePhoto", () => {
  it("sends the browser frame toggle and address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(PHOTO)))
    );
    await portfolioService.updatePhoto("p1", {
      categoryId: "c1",
      chromeUrl: "backacres.com",
      order: 1,
      showChrome: true,
      title: "Home",
    });
    expect(sent()).toMatchObject({
      chromeUrl: "backacres.com",
      showChrome: true,
    });
  });

  it("sends an empty address so clearing it clears it, and false to turn it off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(PHOTO)))
    );
    await portfolioService.updatePhoto("p1", {
      categoryId: "c1",
      chromeUrl: "",
      order: 1,
      showChrome: false,
      title: "Home",
    });
    expect(sent()).toMatchObject({ chromeUrl: "", showChrome: false });
  });

  it("leaves the frame alone when the caller does not mention it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(PHOTO)))
    );
    await portfolioService.updatePhoto("p1", {
      categoryId: "c1",
      order: 1,
      title: "Home",
    });
    expect(sent()).not.toHaveProperty("showChrome");
    expect(sent()).not.toHaveProperty("chromeUrl");
  });
});
