import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFalLibrary } from "./falLibrary.js";

/**
 * fal's request listing stopped carrying outputs (json_output: null on
 * successes). The library reads them back from the queue instead.
 */

const LISTING = "https://rest.alpha.fal.ai/requests/";

/** A fake fal: the listing, plus the queue results it knows. */
const fakeFal = (items: unknown[], results: Record<string, unknown> = {}) =>
  vi.fn((url: string) =>
    Promise.resolve(
      url.startsWith(LISTING)
        ? Response.json({ items, pages: null, total: null })
        : (results[url] &&
            Response.json(results[url] as Record<string, unknown>)) ||
            new Response("", { status: 404 })
    )
  );

afterEach(() => vi.unstubAllGlobals());

describe("fetchFalLibrary", () => {
  it("reads an output the listing left out from the queue, by app", async () => {
    const fetch = fakeFal(
      [
        {
          endpoint: "fal-ai/gpt-image-2/edit",
          json_output: null,
          request_id: "r1",
          request_started_at: "2026-11-15T20:43:20Z",
          status_code: 200,
        },
        {
          endpoint: "fal-ai/x",
          json_output: null,
          request_id: "r2",
          status_code: 500,
        },
      ],
      {
        "https://queue.fal.run/fal-ai/gpt-image-2/requests/r1": {
          images: [
            { content_type: "image/png", url: "https://v3b.fal.media/a.png" },
          ],
        },
      }
    );
    vi.stubGlobal("fetch", fetch);

    const page = await fetchFalLibrary("key", 1);
    expect(page.items.map((item) => item.url)).toEqual([
      "https://v3b.fal.media/a.png",
    ]);
    // The failed request is not looked up.
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/r2"))).toBe(
      false
    );
  });

  it("skips a request whose result the queue no longer has", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFal([
        {
          endpoint: "fal-ai/flux/dev",
          json_output: null,
          request_id: "old",
          status_code: 200,
        },
      ])
    );
    expect((await fetchFalLibrary("key", 1)).items).toEqual([]);
  });
});
