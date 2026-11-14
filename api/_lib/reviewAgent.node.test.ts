import { describe, expect, it } from "vitest";
import {
  captureMessage,
  captureState,
  isAgentImageUrl,
  parseFacts,
} from "./reviewAgent.js";

const line = (...facts: unknown[]) =>
  JSON.stringify({ at: "2026-11-14T00:00:00.000Z", facts });

const SIGNED =
  "https://vejixf4ghhdvejm5.private.blob.vercel-storage.com/screens/a.png?vercel-blob-delegation=x&vercel-blob-signature=y";

describe("parseFacts", () => {
  it("reads facts from event lines and skips progress and transport lines", () => {
    const ndjson = [
      line({ data: {}, type: "turn.started" }),
      JSON.stringify({
        progress: { data: { delta: "hi" }, type: "content.delta" },
      }),
      JSON.stringify({ $eve: "heartbeat" }),
      "not json",
      line({ data: { outcome: "completed" }, type: "turn.settled" }),
    ].join("\n");
    expect(parseFacts(ndjson).map((f) => f.type)).toEqual([
      "turn.started",
      "turn.settled",
    ]);
  });
});

describe("captureState", () => {
  it("is running, with the latest step, until the turn settles", () => {
    const state = captureState(
      parseFacts(
        [
          line({
            data: { capability: { name: "log_in" } },
            type: "call.requested",
          }),
          line({
            data: {
              capability: { name: "browser__open" },
              input: { url: "https://app.example.com/dash" },
            },
            type: "call.requested",
          }),
        ].join("\n")
      )
    );
    expect(state).toEqual({
      phase: "Opening https://app.example.com/dash…",
      state: "running",
    });
  });

  it("returns the structured result when the turn completes", () => {
    const screens = [
      {
        image: { height: 2000, url: SIGNED, width: 1440 },
        sourceUrl: "https://app.example.com/dash",
        title: "Dashboard",
        viewport: "desktop",
      },
    ];
    const state = captureState([
      {
        data: { kind: "result", value: { note: "One page.", screens } },
        type: "content.completed",
      },
      { data: { outcome: "completed" }, type: "turn.settled" },
    ]);
    expect(state).toEqual({ note: "One page.", screens, state: "done" });
  });

  it("fails with the session's error, even when it is recorded after the turn", () => {
    const state = captureState([
      { data: { outcome: "cancelled" }, type: "turn.settled" },
      {
        data: { error: { message: "Model call failed" } },
        type: "session.ended",
      },
    ]);
    expect(state).toEqual({ error: "Model call failed", state: "failed" });
  });

  it("names the outcome when no reason was recorded", () => {
    const state = captureState([
      { data: { outcome: "cancelled" }, type: "turn.settled" },
    ]);
    expect(state).toEqual({
      error: "The agent stopped (cancelled).",
      state: "failed",
    });
  });

  it("prefers the session error when it is recorded before the turn settles", () => {
    const state = captureState([
      { data: { error: { message: "Bad API key" } }, type: "session.ended" },
      { data: { outcome: "failed" }, type: "turn.settled" },
    ]);
    expect(state).toEqual({ error: "Bad API key", state: "failed" });
  });
});

describe("isAgentImageUrl", () => {
  it("accepts only signed links into a private Blob store", () => {
    expect(isAgentImageUrl(SIGNED)).toBe(true);
    expect(
      isAgentImageUrl(
        "https://abc.public.blob.vercel-storage.com/a.png?vercel-blob-signature=y"
      )
    ).toBe(false);
    expect(isAgentImageUrl(SIGNED.replace("vercel-blob-signature=y", ""))).toBe(
      false
    );
    expect(
      isAgentImageUrl("https://evil.example.com/a.png?vercel-blob-signature=y")
    ).toBe(false);
    expect(isAgentImageUrl(SIGNED.replace("https:", "http:"))).toBe(false);
    expect(isAgentImageUrl("not a url")).toBe(false);
  });
});

describe("captureMessage", () => {
  it("names the login page when one is given, and never asks for an audit", () => {
    const text = captureMessage({
      loginUrl: "https://app.example.com/login",
      pages: 4,
      url: "https://app.example.com",
    });
    expect(text).toContain("Do not write an audit.");
    expect(text).toContain("https://app.example.com/login");
    expect(text).toContain("up to 3 more key pages");
  });
});
