import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAndSendInvoice,
  encodeParams,
  StripeError,
  StripeNotConfiguredError,
} from "./stripe.js";

/**
 * The Stripe calls, with fetch stood in: what is sent, in what order, and
 * that every write carries an idempotency key tied to this site's invoice,
 * so a retried Send can never bill the client twice.
 */

const calls: { body: string; headers: Record<string, string>; url: string }[] =
  [];

const respond = (url: string): unknown => {
  if (url.includes("/customers?")) {
    return { data: [] };
  }
  if (url.endsWith("/customers")) {
    return { id: "cus_1" };
  }
  if (url.endsWith("/invoices")) {
    return { customer: "cus_1", id: "in_1", status: "draft" };
  }
  if (url.endsWith("/send")) {
    return {
      customer: "cus_1",
      hosted_invoice_url: "https://invoice.stripe.com/i/x",
      id: "in_1",
      invoice_pdf: "https://pay.stripe.com/x.pdf",
      number: "DP-0001",
      status: "open",
    };
  }
  return {};
};

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      calls.push({
        body: String(init.body ?? ""),
        headers: init.headers as Record<string, string>,
        url,
      });
      return Promise.resolve(Response.json(respond(url)));
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const input = {
  amountCents: 150_000,
  currency: "usd",
  customerEmail: "founder@viask.ai",
  customerName: "Vin Gokhale",
  description: "Pretext launch: Launch, 50% deposit",
  dueDays: 14,
  invoiceId: "inv-local-1",
  proposalId: "prop-1",
};

describe("encodeParams", () => {
  it("nests objects the way Stripe reads them, and skips empty values", () => {
    expect(
      encodeParams({ a: 1, meta: { id: "x", none: undefined }, skip: null })
    ).toEqual(["a=1", "meta%5Bid%5D=x"]);
  });
});

describe("createAndSendInvoice", () => {
  it("finds or makes the customer, then creates, fills, finalises and sends", async () => {
    const sent = await createAndSendInvoice(input);
    expect(
      calls.map((c) => c.url.replace("https://api.stripe.com/v1", ""))
    ).toEqual([
      "/customers?email=founder%40viask.ai&limit=1",
      "/customers",
      "/invoices",
      "/invoiceitems",
      "/invoices/in_1/finalize",
      "/invoices/in_1/send",
    ]);
    expect(sent).toMatchObject({ number: "DP-0001", status: "open" });
    const item = new URLSearchParams(calls[3]?.body);
    expect(item.get("amount")).toBe("150000");
    expect(item.get("invoice")).toBe("in_1");
    const invoice = new URLSearchParams(calls[2]?.body);
    expect(invoice.get("collection_method")).toBe("send_invoice");
    expect(invoice.get("metadata[invoice_id]")).toBe("inv-local-1");
  });

  it("puts an idempotency key on every write, tied to this site's invoice", async () => {
    await createAndSendInvoice(input);
    const keys = calls
      .filter((c) => c.body !== "" || !c.url.includes("?"))
      .map((c) => c.headers["Idempotency-Key"]);
    expect(keys).toEqual([
      "customer:founder@viask.ai",
      "invoice:inv-local-1",
      "invoiceitem:inv-local-1",
      "finalize:inv-local-1",
      "send:inv-local-1",
    ]);
    expect(
      calls.every((c) => c.headers["Stripe-Version"] === "2024-06-20")
    ).toBe(true);
  });

  it("says when Stripe is not configured, before calling anything", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    await expect(createAndSendInvoice(input)).rejects.toBeInstanceOf(
      StripeNotConfiguredError
    );
    expect(calls).toHaveLength(0);
  });

  it("surfaces Stripe's own error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { error: { message: "No such customer" } },
            { status: 400 }
          )
        )
      )
    );
    await expect(createAndSendInvoice(input)).rejects.toThrow(StripeError);
  });
});
