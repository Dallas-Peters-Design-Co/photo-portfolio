import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalRow } from "../../_lib/proposals.js";

/**
 * Accept and sign, end to end, with the database and Resend stood in.
 *
 * What is at stake: a client presses one button, and from that press the
 * acceptance must be recorded exactly once, the client must get their signed
 * copy at the address on file, and the owner must hear about it. Each of
 * those can fail on its own, and the handler's job is to record first and
 * report what was sent, never to lose the signature because a mail bounced.
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

/** The queries the handler runs, in order, with their interpolated values. */
const queries: { text: string; values: unknown[] }[] = [];
let stored: ProposalRow | null = null;

/**
 * A stand-in for the neon tagged template. It answers the three statements
 * the handler makes by looking at the SQL: the lookup returns `stored`, the
 * guarded UPDATE applies only while nothing is accepted, and the re-read
 * returns the row as it now stands.
 */
class Raw {
  readonly fragment: string;

  constructor(fragment: string) {
    this.fragment = fragment;
  }
}

/** The statement with unsafe fragments spliced in and parameters as `?`. */
const statement = (strings: TemplateStringsArray, parts: unknown[]) =>
  strings.reduce((acc, s, i) => {
    if (i >= parts.length) {
      return `${acc}${s}`;
    }
    const part = parts[i];
    return `${acc}${s}${part instanceof Raw ? part.fragment : "?"}`;
  }, "");

const sql = Object.assign(
  (strings: TemplateStringsArray, ...parts: unknown[]) => {
    // `sql.unsafe()` fragments are spliced into the statement, like neon does;
    // only the rest are parameters.
    const text = statement(strings, parts);
    const values = parts.filter((v) => !(v instanceof Raw));
    queries.push({ text, values });
    if (text.includes("UPDATE proposals")) {
      if (!stored || stored.accepted_at) {
        return Promise.resolve([]);
      }
      const [name, title, option] = values;
      stored = {
        ...stored,
        accepted_at: "2026-10-16T20:00:00.000Z",
        accepted_name: name as string,
        accepted_option: option as string | null,
        accepted_title: title as string | null,
      };
      return Promise.resolve([{ id: stored.id }]);
    }
    if (text.includes("WHERE p.slug")) {
      const [, admin] = values;
      if (!stored) {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        stored.status === "published" || admin ? [stored] : []
      );
    }
    return Promise.resolve(stored ? [stored] : []);
  },
  { unsafe: (s: string) => new Raw(s) }
);
vi.mock("../../_lib/db.js", () => ({ getSql: () => sql }));

const handler = (await import("./accept.js")).default;

const ROW: ProposalRow = {
  accepted_at: null,
  brand_kit_id: null,
  client_email: "vin@viask.ai",
  client_name: "Vin at Viaskai",
  created_at: "2026-10-16T00:00:00.000Z",
  doc: {
    addOns: [],
    closing: "Reply with the option you want.",
    intro: "Thanks for the conversation.",
    packages: [
      {
        bestFor: "A quick read.",
        id: "pkg-audit",
        includes: ["Findings"],
        name: "Audit",
        payment: "Up front",
        price: "$2,500",
        priceNote: "fixed",
        recommended: false,
        revisions: "One",
        timeline: "1 week",
      },
      {
        bestFor: "Everything.",
        id: "pkg-launch",
        includes: ["Brand kit"],
        name: "Launch Package",
        payment: "50/50",
        price: "$9,500",
        priceNote: "fixed",
        recommended: true,
        revisions: "Two",
        timeline: "6 weeks",
      },
    ],
    process: [],
    sections: [],
    summary: "",
    terms: ["Quote valid 30 days."],
    validUntil: "",
  },
  id: "p1",
  kit_name: "Viaskai",
  kit_palette: null,
  slug: "viaskai-pretext-launch",
  status: "published",
  title: "Pretext launch",
  updated_at: "2026-10-16T00:00:00.000Z",
};

interface Reply {
  body: unknown;
  headers: Record<string, string>;
  status: number;
}

const call = async (
  body: unknown,
  over: { method?: string; slug?: string; authorization?: string } = {}
): Promise<Reply> => {
  const reply: Reply = { body: undefined, headers: {}, status: 200 };
  const res = {
    end: () => res,
    json: (b: unknown) => {
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
    query: { slug: over.slug ?? "viaskai-pretext-launch" },
  };
  // The handler is typed against Vercel's request and response; this is the
  // subset it touches.
  await handler(req as never, res as never);
  return reply;
};

const sent = () =>
  sendEmail.mock.calls.map(
    ([m]) => m as { html: string; subject: string; text: string; to: string }
  );

beforeEach(() => {
  queries.length = 0;
  stored = structuredClone(ROW);
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(undefined);
  getBearerUser.mockReset();
  getBearerUser.mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/proposals/:slug/accept", () => {
  it("records the signature and sends both emails", async () => {
    const reply = await call({
      name: "Vin Patel",
      option: "pkg-launch",
      title: "Founder",
    });

    expect(reply.status).toBe(200);
    const body = reply.body as {
      acceptance: { name: string; option: string; title: string };
      emailed: { client: boolean; owner: boolean };
    };
    expect(body.acceptance).toMatchObject({
      name: "Vin Patel",
      option: "pkg-launch",
      title: "Founder",
    });
    expect(body.emailed).toEqual({ client: true, owner: true });

    const update = queries.find((q) => q.text.includes("UPDATE proposals"));
    expect(update?.values).toEqual([
      "Vin Patel",
      "Founder",
      "pkg-launch",
      "p1",
    ]);
    expect(update?.text).toContain("accepted_at IS NULL");

    const mails = sent();
    expect(mails).toHaveLength(2);
    const client = mails.find((m) => m.to === "vin@viask.ai");
    const owner = mails.find((m) => m.to === "dallaspeters@gmail.com");
    expect(client?.subject).toBe("Your signed copy: Pretext launch");
    expect(client?.html).toContain("Launch Package (accepted)");
    expect(client?.html).toContain("Quote valid 30 days.");
    expect(client?.html).toContain(
      "https://dallaspeters.com/proposal/viaskai-pretext-launch"
    );
    expect(owner?.subject).toBe("Accepted: Pretext launch");
    expect(owner?.text).toContain("Vin Patel, Founder accepted");
    expect(owner?.text).toContain("Option: Launch Package ($9,500)");
  });

  it("still tells the owner when there is no client address", async () => {
    stored = { ...structuredClone(ROW), client_email: null };
    const reply = await call({ name: "Vin Patel" });
    expect(reply.status).toBe(200);
    expect((reply.body as { emailed: unknown }).emailed).toEqual({
      client: false,
      owner: true,
    });
    expect(sent().map((m) => m.to)).toEqual(["dallaspeters@gmail.com"]);
  });

  it("keeps the signature and the owner's note when the client's copy bounces", async () => {
    sendEmail.mockImplementation((input) =>
      (input as { to: string }).to === "vin@viask.ai"
        ? Promise.reject(new Error("Resend responded 422: invalid to"))
        : Promise.resolve()
    );
    const reply = await call({ name: "Vin Patel" });
    expect(reply.status).toBe(200);
    expect((reply.body as { emailed: unknown }).emailed).toEqual({
      client: false,
      owner: true,
    });
    expect(stored?.accepted_name).toBe("Vin Patel");
    expect(console.error).toHaveBeenCalledWith(
      "[proposal email → vin@viask.ai]",
      expect.any(Error)
    );
  });

  it("keeps the client's copy when the owner's note fails", async () => {
    sendEmail.mockImplementation((input) =>
      (input as { to: string }).to === "dallaspeters@gmail.com"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve()
    );
    const reply = await call({ name: "Vin Patel" });
    expect((reply.body as { emailed: unknown }).emailed).toEqual({
      client: true,
      owner: false,
    });
  });

  it("records the acceptance when email is not configured at all", async () => {
    sendEmail.mockRejectedValue(new EmailNotConfiguredError());
    const reply = await call({ name: "Vin Patel" });
    expect(reply.status).toBe(200);
    expect((reply.body as { emailed: unknown }).emailed).toEqual({
      client: false,
      owner: false,
    });
    expect(stored?.accepted_at).toBeTruthy();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("refuses a second signature and sends nothing", async () => {
    await call({ name: "Vin Patel" });
    sendEmail.mockClear();
    const again = await call({ name: "Someone Else" });
    expect(again.status).toBe(409);
    expect(stored?.accepted_name).toBe("Vin Patel");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("drops an option the proposal does not offer", async () => {
    const reply = await call({ name: "Vin Patel", option: "pkg-nope" });
    expect(reply.status).toBe(200);
    expect(
      (reply.body as { acceptance: { option: string | null } }).acceptance
        .option
    ).toBeNull();
    expect(sent().find((m) => m.to === "vin@viask.ai")?.html).not.toContain(
      "(accepted)"
    );
  });

  it("needs a name", async () => {
    const reply = await call({ name: "   ", title: "Founder" });
    expect(reply.status).toBe(400);
    expect(stored?.accepted_at).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("trims the signature line and mails what was typed as text, not markup", async () => {
    const reply = await call({ name: "  <b>Vin</b>\0 ", title: "<i>CEO</i>" });
    expect(reply.status).toBe(200);
    expect(stored?.accepted_name).toBe("<b>Vin</b>");
    for (const m of sent()) {
      expect(m.html).not.toContain("<b>Vin</b>");
      expect(m.html).not.toContain("<i>CEO</i>");
    }
  });

  it("answers 404 for a slug that does not exist", async () => {
    stored = null;
    const reply = await call({ name: "Vin Patel" }, { slug: "missing" });
    expect(reply.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("hides a draft from the public but lets an admin test it", async () => {
    stored = { ...structuredClone(ROW), status: "draft" };
    const anon = await call({ name: "Vin Patel" });
    expect(anon.status).toBe(404);

    getBearerUser.mockReturnValue({ email: "d@x", userId: "u1" });
    const admin = await call(
      { name: "Dallas Peters" },
      { authorization: "Bearer t" }
    );
    expect(admin.status).toBe(200);
    expect(stored?.accepted_name).toBe("Dallas Peters");
  });

  it("only takes POST", async () => {
    const reply = await call({ name: "Vin Patel" }, { method: "GET" });
    expect(reply.status).toBe(405);
    expect(reply.headers.Allow).toBe("POST");
  });

  it("reports a stale schema rather than a generic failure", async () => {
    stored = structuredClone(ROW);
    const broken = Object.assign(
      () => Promise.reject(new Error('column "accepted_at" does not exist')),
      { unsafe: (s: string) => s }
    );
    const db = await import("../../_lib/db.js");
    vi.spyOn(db, "getSql").mockReturnValue(broken as never);
    const reply = await call({ name: "Vin Patel" });
    expect(reply.status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
