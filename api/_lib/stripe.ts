/**
 * The few Stripe calls invoicing needs, against the REST API directly.
 *
 * fetch rather than the SDK for the same reason email.ts uses fetch for
 * Resend: a handful of form-encoded POSTs from a serverless function. The
 * API version is pinned, so a Stripe-side default change cannot alter what
 * these requests mean.
 */

const API = "https://api.stripe.com/v1";
const API_VERSION = "2024-06-20";

/** Thrown when STRIPE_SECRET_KEY is absent, so routes can answer 503. */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

export class StripeError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StripeError";
    this.status = status;
  }
}

export const stripeConfigured = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY?.trim());

type Param = string | number | boolean | null | undefined | Params;
interface Params {
  [key: string]: Param;
}

/** Stripe's form encoding: nested objects as `a[b]=…`. */
export const encodeParams = (params: Params, prefix = ""): string[] => {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") {
      out.push(...encodeParams(value, name));
    } else {
      out.push(
        `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`
      );
    }
  }
  return out;
};

const request = async <T>(
  method: "GET" | "POST",
  path: string,
  params: Params = {},
  idempotencyKey?: string
): Promise<T> => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  const query = encodeParams(params).join("&");
  const url =
    method === "GET" && query ? `${API}${path}?${query}` : `${API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": API_VERSION,
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const res = await fetch(url, {
    body: method === "POST" ? query : undefined,
    headers,
    method,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;
  if (!res.ok) {
    throw new StripeError(
      res.status,
      json.error?.message ?? `Stripe responded ${res.status}`
    );
  }
  return json;
};

export interface StripeInvoice {
  customer: string;
  hosted_invoice_url: string | null;
  id: string;
  invoice_pdf: string | null;
  metadata?: Record<string, string>;
  number: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
}

/** The customer with this email, or a new one. */
export const findOrCreateCustomer = async (
  email: string,
  name: string
): Promise<string> => {
  const found = await request<{ data: { id: string }[] }>("GET", "/customers", {
    email,
    limit: 1,
  });
  const existing = found.data[0]?.id;
  if (existing) {
    return existing;
  }
  const created = await request<{ id: string }>(
    "POST",
    "/customers",
    { email, name: name || undefined },
    `customer:${email.toLowerCase()}`
  );
  return created.id;
};

export interface SendInvoiceInput {
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  dueDays: number;
  /** This site's invoice id; Stripe's webhooks carry it back as metadata. */
  invoiceId: string;
  /** One Stripe line per entry; without them, one line of the whole amount. */
  lines?: { amountCents: number; description: string }[];
  /** Shown on the invoice under the lines. Defaults to the description. */
  memo?: string;
  proposalId: string | null;
}

/**
 * Creates the invoice in Stripe with its lines, finalises it and has Stripe
 * email it. Idempotency keys on our invoice id mean a retried send cannot
 * create a second invoice in Stripe.
 */
export const createAndSendInvoice = async (
  input: SendInvoiceInput
): Promise<StripeInvoice> => {
  const customer = await findOrCreateCustomer(
    input.customerEmail,
    input.customerName
  );
  const metadata = {
    invoice_id: input.invoiceId,
    proposal_id: input.proposalId ?? undefined,
  };
  const invoice = await request<StripeInvoice>(
    "POST",
    "/invoices",
    {
      auto_advance: false,
      collection_method: "send_invoice",
      currency: input.currency,
      customer,
      days_until_due: input.dueDays,
      description: input.memo || input.description,
      metadata,
      pending_invoice_items_behavior: "exclude",
    },
    `invoice:${input.invoiceId}`
  );
  const lines =
    input.lines && input.lines.length > 0
      ? input.lines
      : [{ amountCents: input.amountCents, description: input.description }];
  // In order, one at a time: Stripe shows lines in the order they were added.
  for (const [i, line] of lines.entries()) {
    // biome-ignore lint/performance/noAwaitInLoops: Stripe lists invoice items in the order they were created, so they go one at a time
    await request(
      "POST",
      "/invoiceitems",
      {
        amount: line.amountCents,
        currency: input.currency,
        customer,
        description: line.description,
        invoice: invoice.id,
      },
      // The first line keeps the original key, so an invoice whose send was
      // interrupted before this change resumes rather than duplicating.
      i === 0
        ? `invoiceitem:${input.invoiceId}`
        : `invoiceitem:${input.invoiceId}:${i}`
    );
  }
  await request<StripeInvoice>(
    "POST",
    `/invoices/${invoice.id}/finalize`,
    {},
    `finalize:${input.invoiceId}`
  );
  return request<StripeInvoice>(
    "POST",
    `/invoices/${invoice.id}/send`,
    {},
    `send:${input.invoiceId}`
  );
};

export const voidInvoice = (stripeInvoiceId: string): Promise<StripeInvoice> =>
  request<StripeInvoice>("POST", `/invoices/${stripeInvoiceId}/void`);
