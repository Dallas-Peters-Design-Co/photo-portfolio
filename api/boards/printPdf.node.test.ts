import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Printing a sheet too big for a function's 4.5 MB limit: the HTML comes from
 * Blob storage (and is deleted), a big PDF goes back through it, and only
 * print-job files in this store are ever read or deleted.
 */

const del = vi.fn(() => Promise.resolve());
const put = vi.fn(() =>
  Promise.resolve({
    url: "https://x.public.blob.vercel-storage.com/print-jobs/p.pdf",
  })
);
const renderSheetPdf = vi.fn(() => Promise.resolve(new Uint8Array(10)));

vi.mock("@vercel/blob", () => ({ del, put }));
vi.mock("../_lib/auth.js", () => ({
  getBearerUser: () => ({ email: "d@x", userId: "u" }),
}));
vi.mock("../_lib/cors.js", () => ({ handleCors: () => false }));
vi.mock("../_lib/pageOrigin.js", () => ({
  allowedPageOrigin: () => "https://dallaspeters.com",
}));
vi.mock("../_lib/printSheet.js", () => ({
  renderSheetPdf,
  sheetSpecFrom: () => ({ bleedIn: 0, heightIn: 24, marksIn: 0, widthIn: 36 }),
}));

const { default: handler } = await import("./print-pdf.js");

const JOB = "https://abc.public.blob.vercel-storage.com/print-jobs/sheet-x.txt";

const call = async (body: Record<string, unknown>) => {
  let status = 0;
  let payload: unknown = null;
  const res = {
    end: () => res,
    json: (b: unknown) => {
      payload = b;
      return res;
    },
    send: (b: unknown) => {
      payload = b;
      return res;
    },
    setHeader: () => res,
    status: (s: number) => {
      status = s;
      return res;
    },
  } as unknown as VercelResponse;
  await handler(
    { body, headers: {}, method: "POST" } as unknown as VercelRequest,
    res
  );
  return { body: payload, status };
};

beforeEach(() => {
  del.mockClear();
  put.mockClear();
  renderSheetPdf.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("<html>big</html>")))
  );
});

describe("print PDF for big sheets", () => {
  it("reads an uploaded sheet from Blob, then deletes it", async () => {
    const { status } = await call({ htmlUrl: JOB });
    expect(status).toBe(200);
    expect(renderSheetPdf).toHaveBeenCalledWith(
      "<html>big</html>",
      "https://dallaspeters.com",
      expect.anything()
    );
    expect(del).toHaveBeenCalledWith(JOB);
  });

  it("won't read a sheet from anywhere else", async () => {
    const { status } = await call({
      htmlUrl: "https://evil.example/print-jobs/a",
    });
    expect(status).toBe(400);
    expect(renderSheetPdf).not.toHaveBeenCalled();
  });

  it("sends a big PDF back as a Blob address", async () => {
    renderSheetPdf.mockResolvedValueOnce(new Uint8Array(5_000_000));
    const { body } = await call({ html: "<html></html>" });
    expect(put).toHaveBeenCalled();
    expect(body).toEqual({
      url: "https://x.public.blob.vercel-storage.com/print-jobs/p.pdf",
    });
  });

  it("deletes only print jobs when told the browser is done", async () => {
    await call({
      done: "https://abc.public.blob.vercel-storage.com/portfolio/a.jpg",
    });
    expect(del).not.toHaveBeenCalled();
    expect((await call({ done: JOB })).status).toBe(204);
    expect(del).toHaveBeenCalledWith(JOB);
  });
});
