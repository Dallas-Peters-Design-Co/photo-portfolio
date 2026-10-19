import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest } from "@vercel/node";

/**
 * Reading and verifying signed webhooks (Resend, Stripe).
 *
 * Both sign the exact bytes they sent, so the handler must see the body
 * before any JSON parsing: a route using these exports
 * `config = { api: { bodyParser: false } }` and reads it with readRawBody.
 */

export const readRawBody = async (req: VercelRequest): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

/** Five minutes either way, as both providers recommend, against replays. */
export const TOLERANCE_SECONDS = 5 * 60;

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const fresh = (timestamp: number, now: number): boolean =>
  Number.isFinite(timestamp) &&
  Math.abs(now / 1000 - timestamp) <= TOLERANCE_SECONDS;

const SVIX_PREFIX = "whsec_";

/**
 * Resend's webhooks are delivered by Svix: HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` with the base64 secret after `whsec_`,
 * base64-encoded, sent as one or more space-separated `v1,<signature>`.
 */
export const verifySvix = (
  body: string,
  headers: { id?: string; signature?: string; timestamp?: string },
  secret: string,
  now: number = Date.now()
): boolean => {
  const { id, signature, timestamp } = headers;
  if (!(id && signature && timestamp && fresh(Number(timestamp), now))) {
    return false;
  }
  const key = Buffer.from(
    secret.startsWith(SVIX_PREFIX) ? secret.slice(SVIX_PREFIX.length) : secret,
    "base64"
  );
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return signature
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((candidate) => safeEqual(candidate, expected));
};

/**
 * Stripe: `Stripe-Signature: t=<seconds>,v1=<hex>[,v1=…]`, HMAC-SHA256 over
 * `${t}.${body}` with the endpoint's signing secret, hex-encoded.
 */
export const verifyStripe = (
  body: string,
  header: string | undefined,
  secret: string,
  now: number = Date.now()
): boolean => {
  if (!header) {
    return false;
  }
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!(timestamp && signatures.length > 0 && fresh(Number(timestamp), now))) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return signatures.some((candidate) => safeEqual(candidate, expected));
};

export const headerValue = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);
