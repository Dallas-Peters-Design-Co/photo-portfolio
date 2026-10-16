import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalRow } from "../../_lib/proposals.js";

/**
 * "Send to client", with the database and Resend stood in.
 *
 * The send is the moment the proposal leaves the building, so three things
 * are pinned here: only an admin can do it, it goes to the address on the
 * record (never one supplied by the request), and the record says it was
 * sent only after Resend accepted it.
 */

const sendEmail = vi.fn<(input: unknown) => Promise<void>>();
const getBearerUser = vi.fn<() => { email: string; userId: string } | null>();
class EmailNotConfiguredError extends Error {}

vi.mock("../../_lib/email.js", () => ({ EmailNotConfiguredError, sendEmail }));
vi.mock("../../_lib/auth.js", () => ({ getBearerUser }));
vi.mock("../../_lib/site.js", () => ({
  getSite: () => ({
    defaultAdminEmail: "dallaspeters@gmail.com",
    domain: "dallaspeters.com",
    emailFrom: "Dallas Peters <noreply@dallaspeters.com>",
    name: "Dallas Peters",
    origins: ["https://dallaspeters.com"],
    ownerName: "Dallas Peters",
  }),
}));

class Raw {
  readonly fragment: string;

  constructor(fragment: string) {
    this.fragment = fragment;
  }
}

const statement = (strings: TemplateStringsArray, parts: unknown[]) =>
  strings.reduce((acc, s, i) => {
    if (i >= parts.length) {
      return `${acc}${s}`;
    }
    const part = parts[i];
    return `${acc}${s}${part instanceof Raw ? part.fragment : "?"}`;
  }, "");

let stored: ProposalRow | null = null;
const updates: unknown[][] = [];

const sql = Object.assign(
  (strings: TemplateStringsArray, ...parts: unknown[]) => {
    const text = statement(strings, parts);
    const values = parts.filter((v) => !(v instanceof Raw));
    if (text.includes("UPDATE proposals")) {
      updates.push(values);
      if (stored) {
        stored = {
          ...stored,
          sent_at: "2026-10-16T21:00:00.000Z",
          sent_to: values[0] as string,
        };
      }
      return Promise.resolve([]);
    }
    return Promise.resolve(stored ? [stored] : []);
  },
  { unsafe: (s: string) => new Raw(s) }
);
vi.mock("../../_lib/db.js", () => ({ getSql: () => sql }));

const handler = (await import("./send.js")).default;

const ROW: ProposalRow = {
  accepted_at: null,
  brand_kit_id: null,
  client_email: "vin@viask.ai",
  client_name: "Vin at Viaskai",
  created_at: "2026-10-16T00:00:00.000Z",
  doc: {
    addOns: [],
    closing: "",
    intro: "",
    packages: [],
    process: [],
    sections: [],
    summary: "",
    terms: [],
    validUntil: "2026-11-15",
  },
  id: "p1",
  sent_at: null,
  sent_to: null,
  slug: "viaskai-pretext-launch",
  status: "published",
  title: "Pretext launch",
  updated_at: "2026-10-16T00:00:00.000Z",
};

interface Reply {
  body: unknown;
  status: number;
}

const call = async (
  body: unknown,
  over: { method?: string; authorization?: string } = {}
): Promise<Reply> => {
  const reply: Reply = { body: undefined, status: 200 };
  const res = {
    end: () => res,
    json: (b: unknown) => {
      reply.body = b;
      return res;
    },
    setHeader: () => res,
    status: (s: number) => {
      reply.status = s;
      return res;
    },
  };
  const req = {
    body,
    headers: { authorization: over.authorization ?? "Bearer t" },
    method: over.method ?? "POST",
    query: { slug: "viaskai-pretext-launch" },
  };
  await handler(req as never, res as never);
  return reply;
};

const sent = () =>
  sendEmail.mock.calls.map(
    ([m]) =>
      m as {
        html: string;
        replyTo?: string;
        subject: string;
        text: string;
        to: string;
      }
  );

beforeEach(() => {
  stored = structuredClone(ROW);
  updates.length = 0;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(undefined);
  getBearerUser.mockReset();
  getBearerUser.mockReturnValue({ email: "d@x", userId: "u1" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/proposals/:slug/send", () => {
  it("emails the link to the address on file and records the send", async () => {
    const reply = await call({ note: "Good talking yesterday." });
    expect(reply.status).toBe(200);

    const [mail] = sent();
    expect(mail.to).toBe("vin@viask.ai");
    expect(mail.replyTo).toBe("dallaspeters@gmail.com");
    expect(mail.subject).toBe("Proposal: Pretext launch");
    expect(mail.text).toContain("Hi Vin,");
    expect(mail.text).toContain("Good talking yesterday.");
    expect(mail.text).toContain(
      "https://dallaspeters.com/proposal/viaskai-pretext-launch"
    );

    expect(updates).toEqual([["vin@viask.ai", "p1"]]);
    expect((reply.body as { sent: unknown }).sent).toEqual({
      at: "2026-10-16T21:00:00.000Z",
      to: "vin@viask.ai",
    });
  });

  it("ignores any address in the request body", async () => {
    await call({ note: "", to: "attacker@evil.test" });
    expect(sent()[0].to).toBe("vin@viask.ai");
  });

  it("does not record a send Resend refused", async () => {
    sendEmail.mockRejectedValue(new Error("Resend responded 403: nope"));
    const reply = await call({});
    expect(reply.status).toBe(502);
    expect(updates).toEqual([]);
    expect(stored?.sent_at).toBeNull();
  });

  it("answers 503 when email is not configured, and records nothing", async () => {
    sendEmail.mockRejectedValue(new EmailNotConfiguredError());
    const reply = await call({});
    expect(reply.status).toBe(503);
    expect(updates).toEqual([]);
  });

  it("refuses a draft, since the link would 404 for the client", async () => {
    stored = { ...structuredClone(ROW), status: "draft" };
    const reply = await call({});
    expect(reply.status).toBe(409);
    expect((reply.body as { error: string }).error).toContain("Publish");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses when there is no client email on the record", async () => {
    stored = { ...structuredClone(ROW), client_email: "  " };
    const reply = await call({});
    expect(reply.status).toBe(409);
    expect((reply.body as { error: string }).error).toContain("client's email");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is admin only", async () => {
    getBearerUser.mockReturnValue(null);
    const reply = await call({});
    expect(reply.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    stored = null;
    const reply = await call({});
    expect(reply.status).toBe(404);
  });

  it("only takes POST", async () => {
    const reply = await call({}, { method: "GET" });
    expect(reply.status).toBe(405);
  });

  it("caps the note rather than mailing a novel", async () => {
    await call({ note: "x".repeat(5000) });
    expect(sent()[0].text.length).toBeLessThan(3000);
  });
});
