import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both webhooks, end to end with the database and the fan-out stood in:
 * a bad signature is refused before anything is read, an event for an email
 * or invoice this site did not make is acknowledged and ignored, and a real
 * one is recorded with the right words and a dedupe key, once.
 */

const notify =
  vi.fn<
    (sql: unknown, notice: Record<string, unknown>) => Promise<string | null>
  >();
vi.mock("../_lib/notify.js", () => ({ notify }));

let rows: Record<string, unknown>[] = [];
const statements: string[] = [];
/** Answers SELECTs with `rows`, everything else with nothing. */
const sql = (strings: TemplateStringsArray) => {
  const text = strings.join("?");
  statements.push(text);
  return Promise.resolve(text.includes("SELECT") ? rows : []);
};
vi.mock("../_lib/db.js", () => ({ getSql: () => sql }));

const resend = (await import("./resend.js")).default;
const stripe = (await import("./stripe.js")).default;

interface Reply {
  body: unknown;
  status: number;
}

const call = async (
  handler: typeof resend,
  body: string,
  headers: Record<string, string>
): Promise<Reply> => {
  const reply: Reply = { body: undefined, status: 200 };
  const res = {
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
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    headers,
    method: "POST",
  });
  await handler(req as never, res as never);
  return reply;
};

const PROPOSAL_ID = "4128af85-0a77-4d44-aa98-febc790f6942";
const INVOICE_ID = "9d1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

beforeEach(() => {
  rows = [];
  statements.length = 0;
  notify.mockReset();
  notify.mockResolvedValue("a1");
  vi.stubEnv(
    "RESEND_WEBHOOK_SECRET",
    `whsec_${Buffer.from("resend-key").toString("base64")}`
  );
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_stripe");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const svix = (body: string) => {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from("resend-key"))
    .update(`msg_1.${ts}.${body}`)
    .digest("base64");
  return {
    "svix-id": "msg_1",
    "svix-signature": `v1,${sig}`,
    "svix-timestamp": ts,
  };
};

const stripeSig = (body: string) => {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", "whsec_stripe")
    .update(`${ts}.${body}`)
    .digest("hex");
  return { "stripe-signature": `t=${ts},v1=${sig}` };
};

describe("POST /api/webhooks/resend", () => {
  const opened = JSON.stringify({
    data: {
      email_id: "em_1",
      tags: { proposal: PROPOSAL_ID, subject: "proposal" },
      to: ["founder@viask.ai"],
    },
    type: "email.opened",
  });

  it("refuses a bad signature without touching the database", async () => {
    const reply = await call(resend, opened, {
      ...svix(opened),
      "svix-signature": "v1,AAAA",
    });
    expect(reply.status).toBe(401);
    expect(statements).toHaveLength(0);
  });

  it("records the first open of the proposal email, keyed on the email", async () => {
    rows = [
      {
        client_name: "Vin Gokhale",
        id: PROPOSAL_ID,
        slug: "pretext",
        title: "Pretext launch",
      },
    ];
    const reply = await call(resend, opened, svix(opened));
    expect(reply.status).toBe(200);
    expect(notify).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({
        dedupeKey: "proposal.opened:em_1",
        kind: "proposal.opened",
        subjectId: PROPOSAL_ID,
        title: 'Vin Gokhale opened the email for "Pretext launch"',
        url: "/admin/proposals/pretext",
      })
    );
  });

  it("reads tags sent as name/value pairs too", async () => {
    rows = [
      {
        client_name: "Vin",
        id: PROPOSAL_ID,
        slug: "pretext",
        title: "Pretext",
      },
    ];
    const body = JSON.stringify({
      data: {
        email_id: "em_2",
        tags: [{ name: "proposal", value: PROPOSAL_ID }],
      },
      type: "email.delivered",
    });
    await call(resend, body, svix(body));
    expect(notify).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ kind: "proposal.delivered" })
    );
  });

  it("ignores emails that are not proposal emails", async () => {
    const body = JSON.stringify({
      data: { email_id: "em_3" },
      type: "email.opened",
    });
    const reply = await call(resend, body, svix(body));
    expect(reply).toEqual({ body: { ignored: true }, status: 200 });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/stripe", () => {
  const paid = JSON.stringify({
    data: {
      object: {
        amount_paid: 150_000,
        hosted_invoice_url: "https://invoice.stripe.com/i/x",
        id: "in_1",
        metadata: { invoice_id: INVOICE_ID },
        number: "DP-0001",
      },
    },
    id: "evt_1",
    type: "invoice.paid",
  });

  it("refuses a bad signature", async () => {
    const reply = await call(stripe, paid, { "stripe-signature": "t=1,v1=00" });
    expect(reply.status).toBe(401);
    expect(statements).toHaveLength(0);
  });

  it("marks the invoice paid and tells the owner, once per Stripe event", async () => {
    rows = [
      {
        amount_cents: 150_000,
        currency: "usd",
        customer_name: "Vin Gokhale",
        id: INVOICE_ID,
        proposal_id: PROPOSAL_ID,
        slug: "pretext",
        title: "Pretext launch",
      },
    ];
    const reply = await call(stripe, paid, stripeSig(paid));
    expect(reply.status).toBe(200);
    expect(statements.some((s) => s.includes("UPDATE invoices"))).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({
        body: "Vin Gokhale paid $1,500.",
        dedupeKey: "stripe:evt_1",
        kind: "invoice.paid",
        title: 'Invoice DP-0001 was paid for "Pretext launch"',
      })
    );
  });

  it("ignores invoices this site did not create", async () => {
    rows = [];
    const reply = await call(stripe, paid, stripeSig(paid));
    expect(reply).toEqual({ body: { ignored: true }, status: 200 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignores event types it does not handle", async () => {
    const body = JSON.stringify({
      data: { object: { id: "in_1" } },
      id: "evt_2",
      type: "customer.created",
    });
    const reply = await call(stripe, body, stripeSig(body));
    expect(reply.body).toEqual({ ignored: true });
  });
});
