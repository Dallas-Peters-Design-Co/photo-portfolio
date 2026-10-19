import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripe, verifySvix } from "./webhookSignature.js";

/**
 * Webhook signatures: the only thing standing between the public internet
 * and "the client paid" in the owner's notifications. Each provider's scheme
 * is checked with a signature made the way the provider makes it.
 */

const NOW = 1_792_400_000_000;
const SECONDS = Math.floor(NOW / 1000);
const BODY = '{"type":"email.opened"}';

describe("Svix (Resend)", () => {
  const raw = Buffer.from("test-secret-bytes-0123456789");
  const secret = `whsec_${raw.toString("base64")}`;
  const sign = (id: string, ts: number, body: string) =>
    createHmac("sha256", raw).update(`${id}.${ts}.${body}`).digest("base64");

  it("accepts a signature made with the secret", () => {
    const signature = `v1,${sign("msg_1", SECONDS, BODY)}`;
    expect(
      verifySvix(
        BODY,
        { id: "msg_1", signature, timestamp: String(SECONDS) },
        secret,
        NOW
      )
    ).toBe(true);
  });

  it("accepts when any of several signatures matches (secret rotation)", () => {
    const signature = `v1,bm9wZQ== v1,${sign("msg_1", SECONDS, BODY)}`;
    expect(
      verifySvix(
        BODY,
        { id: "msg_1", signature, timestamp: String(SECONDS) },
        secret,
        NOW
      )
    ).toBe(true);
  });

  it("refuses a changed body, a wrong secret, or an old timestamp", () => {
    const signature = `v1,${sign("msg_1", SECONDS, BODY)}`;
    const headers = { id: "msg_1", signature, timestamp: String(SECONDS) };
    expect(verifySvix(`${BODY} `, headers, secret, NOW)).toBe(false);
    expect(verifySvix(BODY, headers, "whsec_b3RoZXI=", NOW)).toBe(false);
    const stale = { ...headers, timestamp: String(SECONDS - 600) };
    expect(verifySvix(BODY, stale, secret, NOW)).toBe(false);
  });

  it("refuses missing headers", () => {
    expect(verifySvix(BODY, {}, secret, NOW)).toBe(false);
  });
});

describe("Stripe", () => {
  const secret = "whsec_stripe_test";
  const sign = (ts: number, body: string) =>
    createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  it("accepts a signature made with the secret", () => {
    const header = `t=${SECONDS},v1=${sign(SECONDS, BODY)}`;
    expect(verifyStripe(BODY, header, secret, NOW)).toBe(true);
  });

  it("refuses a changed body, a forged signature, an old timestamp, or none", () => {
    expect(
      verifyStripe(
        `${BODY}x`,
        `t=${SECONDS},v1=${sign(SECONDS, BODY)}`,
        secret,
        NOW
      )
    ).toBe(false);
    expect(verifyStripe(BODY, `t=${SECONDS},v1=deadbeef`, secret, NOW)).toBe(
      false
    );
    const old = SECONDS - 3600;
    expect(
      verifyStripe(BODY, `t=${old},v1=${sign(old, BODY)}`, secret, NOW)
    ).toBe(false);
    expect(verifyStripe(BODY, undefined, secret, NOW)).toBe(false);
  });
});
