import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The PDF route: who may print what, and where the browser is pointed.
 *
 * The rendering itself is a real browser printing the real page, which is
 * exactly what cannot be stubbed meaningfully here; what can be pinned is
 * that a published proposal prints for anyone, a draft only for an admin
 * whose token reaches the headless page, and that the page address is only
 * ever one of the site's own origins.
 */

const renderPagePdf = vi.fn<(input: unknown) => Promise<Buffer>>();
const getBearerUser = vi.fn<() => { email: string; userId: string } | null>();
let status = "published";
let found = true;

vi.mock("../../_lib/screenshot.js", () => ({ renderPagePdf }));
vi.mock("../../_lib/auth.js", () => ({ getBearerUser }));
vi.mock("../../_lib/site.js", () => ({
  getSite: () => ({
    domain: "dallaspeters.com",
    origins: ["https://dallaspeters.com", "https://www.dallaspeters.com"],
  }),
}));
vi.mock("../../_lib/db.js", () => ({
  getSql: () => () => Promise.resolve(found ? [{ status }] : []),
}));

const handler = (await import("./pdf.js")).default;

interface Reply {
  body: unknown;
  headers: Record<string, string>;
  status: number;
}

const call = async (
  body: unknown,
  over: { method?: string; authorization?: string } = {}
): Promise<Reply> => {
  const reply: Reply = { body: undefined, headers: {}, status: 200 };
  const res = {
    end: () => res,
    json: (b: unknown) => {
      reply.body = b;
      return res;
    },
    send: (b: unknown) => {
      reply.body = b;
      return res;
    },
    setHeader: (k: string, v: string) => {
      reply.headers[k] = v;
      return res;
    },
    status: (s: number) => {
      reply.status = s;
      return res;
    },
  };
  const req = {
    body,
    headers: { authorization: over.authorization },
    method: over.method ?? "POST",
    query: { slug: "viaskai-pretext-launch" },
  };
  await handler(req as never, res as never);
  return reply;
};

beforeEach(() => {
  status = "published";
  found = true;
  renderPagePdf.mockReset();
  renderPagePdf.mockResolvedValue(Buffer.from("%PDF-1.7 test"));
  getBearerUser.mockReset();
  getBearerUser.mockReturnValue(null);
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/proposals/:slug/pdf", () => {
  it("prints the public page of a published proposal for anyone", async () => {
    const reply = await call({ origin: "https://dallaspeters.com" });
    expect(reply.status).toBe(200);
    expect(reply.headers["Content-Type"]).toBe("application/pdf");
    expect(reply.headers["Content-Disposition"]).toContain(
      'filename="proposal-viaskai-pretext-launch.pdf"'
    );
    expect(Buffer.isBuffer(reply.body)).toBe(true);
    expect(renderPagePdf).toHaveBeenCalledWith({
      localStorage: undefined,
      url: "https://dallaspeters.com/proposal/viaskai-pretext-launch",
      waitFor: ".proposal-page__sheet",
    });
  });

  it("refuses an origin that is not the site's", async () => {
    const reply = await call({ origin: "https://evil.example" });
    expect(reply.status).toBe(400);
    expect(renderPagePdf).not.toHaveBeenCalled();
  });

  it("allows localhost only off Vercel", async () => {
    const dev = await call({ origin: "http://localhost:3006" });
    expect(dev.status).toBe(200);
    vi.stubEnv("VERCEL", "1");
    const prod = await call({ origin: "http://localhost:3006" });
    expect(prod.status).toBe(400);
  });

  it("hides a draft from the public, prints it for an admin with the token passed through", async () => {
    status = "draft";
    const anon = await call({ origin: "https://dallaspeters.com" });
    expect(anon.status).toBe(404);

    getBearerUser.mockReturnValue({ email: "d@x", userId: "u1" });
    const admin = await call(
      { origin: "https://dallaspeters.com" },
      { authorization: "Bearer tok123" }
    );
    expect(admin.status).toBe(200);
    expect(renderPagePdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        localStorage: { cyan_admin_token: "tok123" },
      })
    );
  });

  it("answers 404 for an unknown slug", async () => {
    found = false;
    const reply = await call({ origin: "https://dallaspeters.com" });
    expect(reply.status).toBe(404);
  });

  it("reports a browser failure as 502 rather than a crash", async () => {
    renderPagePdf.mockRejectedValue(new Error("browser died"));
    const reply = await call({ origin: "https://dallaspeters.com" });
    expect(reply.status).toBe(502);
  });

  it("only takes POST", async () => {
    const reply = await call({}, { method: "GET" });
    expect(reply.status).toBe(405);
  });
});
