import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractRow } from "../_lib/contracts.js";

/**
 * Signing an agreement, end to end, with the database, email and
 * notifications stood in.
 *
 * What is at stake: a draft must not be readable by the public, the client
 * signs once (with their name and the box ticked) and never twice, only a
 * client-signed agreement can be countersigned, and the owner hears about
 * the signature.
 */

const sendEmail = vi.fn(() => Promise.resolve());
const notify = vi.fn(() => Promise.resolve("a1"));
const getBearerUser = vi.fn<() => { email: string; userId: string } | null>();

vi.mock("../_lib/email.js", () => ({ sendEmail }));
vi.mock("../_lib/notify.js", () => ({ notify }));
vi.mock("../_lib/auth.js", () => ({ getBearerUser }));
vi.mock("../_lib/site.js", () => ({
  emailBrand: () => ({
    domain: "dallaspeters.com",
    key: "dallas-images",
    ownerName: "Dallas",
    tagline: "",
  }),
  getSite: () => ({
    defaultAdminEmail: "dallaspeters@gmail.com",
    domain: "dallaspeters.com",
    key: "dallas-images",
    name: "Dallas Peters",
    origins: ["https://dallaspeters.com"],
    ownerName: "Dallas",
    tagline: "Product Designer",
  }),
}));

const ID = "11111111-2222-4333-8444-555555555555";
let row: ContractRow;

class Raw {
  readonly fragment: string;
  constructor(fragment: string) {
    this.fragment = fragment;
  }
}

/**
 * A stand-in for the neon tagged template: reads return `row`, and each
 * guarded UPDATE applies only when its WHERE status matches, as Postgres would.
 */
const sql = Object.assign(
  (strings: TemplateStringsArray, ...parts: unknown[]) => {
    const text = strings.join("?");
    const values = parts.filter((p) => !(p instanceof Raw));
    const guarded = (
      from: ContractRow["status"],
      patch: Partial<ContractRow>
    ) => {
      if (row.status !== from) {
        return Promise.resolve([]);
      }
      row = { ...row, ...patch };
      return Promise.resolve([{ id: row.id }]);
    };
    if (text.includes("SET status = 'signed'")) {
      return guarded("sent", {
        client_signed_at: new Date().toISOString(),
        client_signed_ip: values[2] as string,
        client_signed_name: values[0] as string,
        client_signed_title: values[1] as string | null,
        status: "signed",
      });
    }
    if (text.includes("SET status = 'countersigned'")) {
      return guarded("signed", {
        owner_signed_at: new Date().toISOString(),
        owner_signed_name: values[0] as string,
        status: "countersigned",
      });
    }
    if (text.includes("SET status = 'sent'")) {
      row = { ...row, sent_at: new Date().toISOString(), status: "sent" };
      return Promise.resolve([]);
    }
    return Promise.resolve([row]);
  },
  { unsafe: (s: string) => new Raw(s) }
);

vi.mock("../_lib/db.js", () => ({ getSql: () => sql }));

const { default: handler } = await import("./[id].js");

const call = async (
  method: string,
  body: Record<string, unknown> = {},
  id = ID
) => {
  let status = 0;
  let payload: unknown = null;
  const res = {
    end: () => res,
    json: (b: unknown) => {
      payload = b;
      return res;
    },
    setHeader: () => res,
    status: (s: number) => {
      status = s;
      return res;
    },
  } as unknown as VercelResponse;
  const req = {
    body,
    headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    method,
    query: { id },
    socket: {},
  } as unknown as VercelRequest;
  await handler(req, res);
  return { body: payload as Record<string, unknown>, status };
};

beforeEach(() => {
  sendEmail.mockClear();
  notify.mockClear();
  getBearerUser.mockReturnValue(null);
  row = {
    client_email: "founder@viask.ai",
    client_name: "Vin Gokhale",
    client_signed_at: null,
    client_signed_ip: null,
    client_signed_name: null,
    client_signed_title: null,
    created_at: "2026-10-31T00:00:00Z",
    doc: {},
    id: ID,
    owner_signed_at: null,
    owner_signed_name: null,
    proposal_id: "p1",
    proposal_slug: "viaskai-pretext-launch",
    sent_at: null,
    status: "draft",
    title: "Services agreement: Pretext launch",
    updated_at: "2026-10-31T00:00:00Z",
  };
});

describe("contract signing", () => {
  it("keeps a draft from the public, and shows it to the admin", async () => {
    expect((await call("GET")).status).toBe(404);
    getBearerUser.mockReturnValue({ email: "d@x", userId: "u" });
    expect((await call("GET")).status).toBe(200);
  });

  it("won't take a signature on a draft", async () => {
    const res = await call("POST", {
      action: "sign",
      agree: true,
      name: "Vin",
    });
    expect(res.status).toBe(409);
    expect(row.status).toBe("draft");
  });

  it("sends, then signs once with the name, box and address on record", async () => {
    getBearerUser.mockReturnValue({ email: "d@x", userId: "u" });
    const sent = await call("POST", { action: "send" });
    expect(sent.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "founder@viask.ai" })
    );
    getBearerUser.mockReturnValue(null);

    expect((await call("POST", { action: "sign", name: "Vin" })).status).toBe(
      400
    );
    expect(
      (await call("POST", { action: "sign", agree: true, name: " " })).status
    ).toBe(400);

    const signed = await call("POST", {
      action: "sign",
      agree: true,
      name: "Vin Gokhale",
      title: "Founder",
    });
    expect(signed.status).toBe(200);
    expect(row).toMatchObject({
      client_signed_ip: "203.0.113.9",
      client_signed_name: "Vin Gokhale",
      client_signed_title: "Founder",
      status: "signed",
    });
    expect(notify).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ kind: "contract.signed" })
    );
    // The signer's address is on file but never sent back.
    expect(JSON.stringify(signed.body)).not.toContain("203.0.113.9");

    const again = await call("POST", {
      action: "sign",
      agree: true,
      name: "Someone else",
    });
    expect(again.status).toBe(409);
    expect(row.client_signed_name).toBe("Vin Gokhale");
  });

  it("countersigns only after the client, and only as the admin", async () => {
    expect((await call("POST", { action: "countersign" })).status).toBe(401);
    getBearerUser.mockReturnValue({ email: "d@x", userId: "u" });
    expect((await call("POST", { action: "countersign" })).status).toBe(409);
    row = {
      ...row,
      client_signed_at: "2026-10-31T01:00:00Z",
      client_signed_name: "Vin",
      status: "signed",
    };
    const done = await call("POST", { action: "countersign" });
    expect(done.status).toBe(200);
    expect(row).toMatchObject({
      owner_signed_name: "Dallas Peters",
      status: "countersigned",
    });
    // Both parties get the signed copy.
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("won't let a signed agreement be edited or deleted", async () => {
    getBearerUser.mockReturnValue({ email: "d@x", userId: "u" });
    row = { ...row, status: "signed" };
    expect(
      (await call("POST", { action: "update", title: "Changed" })).status
    ).toBe(409);
    expect((await call("DELETE")).status).toBe(409);
  });
});
