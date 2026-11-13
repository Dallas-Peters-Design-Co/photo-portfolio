import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A review behind a password, and the client's comments on it.
 *
 * The database is a stand-in that holds one review row and records every
 * statement, so what's checked is what each handler sends back and what it
 * writes: the lock, the pass, the doc kept intact through a save, and a
 * comment appended rather than overwriting.
 */

vi.stubEnv("JWT_SECRET", "test-secret");

const getBearerUser = vi.fn<() => { email: string; userId: string } | null>();
vi.mock("../_lib/auth.js", () => ({ getBearerUser }));

let row: Record<string, unknown>;
const writes: { text: string; values: unknown[] }[] = [];

vi.mock("../_lib/db.js", () => ({
  getSql: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      const verb = text.trimStart().slice(0, 6).toUpperCase();
      if (["UPDATE", "INSERT", "DELETE"].includes(verb)) {
        writes.push({ text, values });
        return Promise.resolve([]);
      }
      return Promise.resolve([row]);
    };
    sql.unsafe = (s: string) => s;
    return sql;
  },
}));

const access = await import("../_lib/reviewAccess.js");
const slugHandler = (await import("./[slug].js")).default;
const feedbackHandler = (await import("./[slug]/feedback.js")).default;

interface Reply {
  body: unknown;
  status: number;
}

const call = async (
  handler: (req: never, res: never) => Promise<unknown>,
  {
    body,
    headers = {},
    method = "GET",
    query = {},
  }: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    query?: Record<string, string>;
  }
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
  await handler(
    { body, headers, method, query: { slug: "acme", ...query } } as never,
    res as never
  );
  return reply;
};

const docWith = (extra: Record<string, unknown>) => ({
  closing: "",
  intro: "",
  screens: [],
  sections: [],
  summary: "Findings",
  ...extra,
});

beforeEach(() => {
  writes.length = 0;
  getBearerUser.mockReturnValue(null);
  row = {
    client_name: "Acme",
    created_at: new Date(),
    doc: docWith({ access: access.hashPassword("open sesame") }),
    id: "review-1",
    slug: "acme",
    status: "published",
    title: "Acme audit",
    updated_at: new Date(),
  };
});

describe("a review with a password", () => {
  it("shows a visitor only its title until they have the pass", async () => {
    const locked = await call(slugHandler, {});
    expect(locked.status).toBe(401);
    expect(locked.body).toEqual({ locked: true, title: "Acme audit" });
    expect(JSON.stringify(locked.body)).not.toContain("Findings");
  });

  it("hands out a pass for the right password, and nothing for a wrong one", async () => {
    const wrong = await call(slugHandler, {
      body: { password: "nope" },
      method: "POST",
    });
    expect(wrong.status).toBe(401);
    const right = await call(slugHandler, {
      body: { password: "open sesame" },
      method: "POST",
    });
    const { pass } = right.body as { pass: string };
    expect(pass).toBeTruthy();
    const open = await call(slugHandler, {
      headers: { "x-review-pass": pass },
    });
    expect(open.status).toBe(200);
    const dto = open.body as {
      doc: Record<string, unknown>;
      hasPassword: boolean;
    };
    expect(dto.hasPassword).toBe(true);
    // The hash never goes out.
    expect(JSON.stringify(dto)).not.toContain("salt");
  });

  it("ends old passes when the password changes", async () => {
    const before = access.accessOf(row.doc);
    const pass = before ? access.passFor("review-1", before) : "";
    row.doc = docWith({ access: access.hashPassword("new one") });
    const stale = await call(slugHandler, {
      headers: { "x-review-pass": pass },
    });
    expect(stale.status).toBe(401);
  });

  it("is open to the designer without a pass", async () => {
    getBearerUser.mockReturnValue({ email: "d@example.com", userId: "u" });
    expect((await call(slugHandler, {})).status).toBe(200);
  });
});

describe("saving a review", () => {
  it("keeps the password and the client's comments the doc arrives without", async () => {
    getBearerUser.mockReturnValue({ email: "d@example.com", userId: "u" });
    const feedback = [
      { body: "Love it", id: "f1", screenId: "", x: null, y: null },
    ];
    row.doc = docWith({ access: access.hashPassword("open sesame"), feedback });
    await call(slugHandler, {
      body: { doc: docWith({ summary: "Edited" }) },
      method: "PATCH",
    });
    const saved = JSON.parse(
      String(
        writes[0]?.values.find(
          (v) => typeof v === "string" && v.includes("Edited")
        )
      )
    );
    expect(saved.summary).toBe("Edited");
    expect(saved.feedback).toEqual(feedback);
    expect(access.passwordMatches("open sesame", saved.access)).toBe(true);
  });

  it("takes the password off when it's cleared", async () => {
    getBearerUser.mockReturnValue({ email: "d@example.com", userId: "u" });
    await call(slugHandler, { body: { password: "" }, method: "PATCH" });
    const saved = JSON.parse(
      String(
        writes[0]?.values.find(
          (v) => typeof v === "string" && v.includes("summary")
        )
      )
    );
    expect(saved.access).toBeUndefined();
  });
});

describe("a client's comment", () => {
  it("needs the pass on a locked review, then is appended in one statement", async () => {
    const comment = {
      author: "Vin",
      body: "Can this be bigger?",
      marks: [],
      screenId: "s1",
      x: 0.5,
      y: 0.2,
    };
    const refused = await call(feedbackHandler, {
      body: comment,
      method: "POST",
    });
    expect(refused.status).toBe(401);

    const current = access.accessOf(row.doc);
    const pass = current ? access.passFor("review-1", current) : "";
    const added = await call(feedbackHandler, {
      body: comment,
      headers: { "x-review-pass": pass },
      method: "POST",
    });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      author: "Vin",
      body: "Can this be bigger?",
      resolved: false,
      x: 0.5,
    });
    expect(writes[0]?.text).toContain("jsonb_set");
    expect(writes[0]?.text).toContain("||");
  });

  it("can't be resolved or removed by a client", async () => {
    const resolve = await call(feedbackHandler, {
      body: { id: "f1", resolved: true },
      method: "PATCH",
    });
    expect(resolve.status).toBe(401);
  });
});
