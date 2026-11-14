import { put } from "@vercel/blob";
import { newItemId } from "../../config/proposal.js";
import type { ReviewImage, ReviewScreen } from "../../config/review.js";
import { blobToken } from "./blobToken.js";

/**
 * The eve audit agent, as the Reviews feature uses it: it signs in to an app
 * that needs a login, finds its key pages and screenshots them.
 *
 * The agent lives in agents/audit and deploys as its own Vercel project
 * (audit-agent). This file talks to its HTTP API directly — a session per
 * capture, read back from the session's recorded events — so the site needs no
 * eve dependency. A capture
 * takes minutes, so it is started and then polled rather than awaited.
 *
 * The agent never gets write access to this site. It stores each screenshot in
 * its own private Blob store and hands back a short-lived read-only link; this
 * site downloads the picture and stores it with its own credentials.
 */

const TRAILING_SLASHES = /\/+$/;

const agentUrl = (): string =>
  (process.env.EVE_AGENT_URL ?? "").trim().replace(TRAILING_SLASHES, "");
const agentToken = (): string => (process.env.EVE_API_TOKEN ?? "").trim();

export const isReviewAgentConfigured = (): boolean =>
  Boolean(agentUrl() && agentToken());

const headers = (): Record<string, string> => ({
  authorization: `Bearer ${agentToken()}`,
  "content-type": "application/json",
});

/** What the agent returns for one screen, before this site stores the picture. */
export interface AgentScreen {
  image: ReviewImage;
  sourceUrl: string;
  title: string;
  viewport: "desktop" | "mobile";
}

const IMAGE_SCHEMA = {
  additionalProperties: false,
  properties: {
    height: { type: "integer" },
    url: { type: "string" },
    width: { type: "integer" },
  },
  required: ["height", "url", "width"],
  type: "object",
};

export const CAPTURE_SCHEMA = {
  additionalProperties: false,
  properties: {
    note: {
      description: "One sentence on what was captured, or why it failed.",
      type: "string",
    },
    screens: {
      items: {
        additionalProperties: false,
        properties: {
          image: IMAGE_SCHEMA,
          sourceUrl: { type: "string" },
          title: { type: "string" },
          viewport: { enum: ["desktop", "mobile"], type: "string" },
        },
        required: ["image", "sourceUrl", "title", "viewport"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["note", "screens"],
  type: "object",
};

export const captureMessage = ({
  loginUrl,
  pages,
  url,
}: {
  loginUrl: string | null;
  pages: number;
  url: string;
}): string =>
  [
    "Capture screens for a client review. Do not write an audit.",
    "",
    `Start URL: ${url}`,
    loginUrl
      ? `Login page: ${loginUrl} — call log_in with it when the app asks you to sign in.`
      : "If the app asks you to sign in, call log_in with the sign-in page's URL.",
    `Capture the start page and up to ${pages - 1} more key pages, each at desktop and mobile width.`,
    "Look, never change anything in the app.",
  ].join("\n");

/** Starts a capture. Resolves with the agent session's id. */
export const startCapture = async (input: {
  loginUrl: string | null;
  pages: number;
  url: string;
}): Promise<string> => {
  const res = await fetch(`${agentUrl()}/eve/v1/session`, {
    body: JSON.stringify({
      message: captureMessage(input),
      outputSchema: CAPTURE_SCHEMA,
    }),
    headers: headers(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `The audit agent refused the capture (${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }
  const body = (await res.json()) as { sessionId?: string };
  if (!body.sessionId) {
    throw new Error("The audit agent returned no session.");
  }
  return body.sessionId;
};

interface Fact {
  data?: Record<string, unknown> & {
    capability?: { name?: string };
    error?: { message?: string };
    input?: { url?: string };
    kind?: string;
    outcome?: string;
    value?: unknown;
  };
  type: string;
}

/** The recorded events in an NDJSON stream, in order. Progress lines are skipped. */
export const parseFacts = (ndjson: string): Fact[] =>
  ndjson
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        const record = JSON.parse(line) as { facts?: Fact[] };
        return Array.isArray(record.facts) ? record.facts : [];
      } catch {
        return [];
      }
    });

export type CaptureState =
  | { state: "running"; phase: string }
  | { state: "done"; note: string; screens: AgentScreen[] }
  | { state: "failed"; error: string };

const describeCall = (name = "", url = ""): string | null => {
  if (name === "log_in") {
    return "Signing in…";
  }
  if (name === "browser__open") {
    return url ? `Opening ${url}…` : "Opening a page…";
  }
  if (name === "capture_screen") {
    return "Taking screenshots…";
  }
  if (name.startsWith("browser__")) {
    return "Exploring the app…";
  }
  return null;
};

/** The end of a capture: its result, or why it stopped. */
const settled = (
  facts: Fact[],
  outcome: string | undefined,
  result: unknown
): CaptureState => {
  if (outcome !== "completed") {
    // The reason is on the session's end, which can be recorded after this.
    const ended = facts.find(
      (f) => f.type === "session.ended" && f.data?.error
    );
    return {
      error: ended?.data?.error?.message ?? `The agent stopped (${outcome}).`,
      state: "failed",
    };
  }
  const value = (result ?? {}) as { note?: unknown; screens?: unknown };
  return {
    note: typeof value.note === "string" ? value.note : "",
    screens: Array.isArray(value.screens)
      ? (value.screens as AgentScreen[])
      : [],
    state: "done",
  };
};

/** Where a capture stands, from its recorded events. */
export const captureState = (facts: Fact[]): CaptureState => {
  let phase = "Starting the browser…";
  let result: unknown;
  for (const fact of facts) {
    const data = fact.data ?? {};
    if (fact.type === "call.requested") {
      phase = describeCall(data.capability?.name, data.input?.url) ?? phase;
    } else if (fact.type === "content.completed" && data.kind === "result") {
      result = data.value;
    } else if (fact.type === "session.ended" && data.error) {
      return {
        error: data.error.message ?? "The agent stopped.",
        state: "failed",
      };
    } else if (fact.type === "turn.settled") {
      return settled(facts, data.outcome, result);
    }
  }
  return { phase, state: "running" };
};

/** Reads a capture's recorded events without waiting for more. */
export const readCapture = async (sessionId: string): Promise<CaptureState> => {
  const res = await fetch(
    `${agentUrl()}/eve/v1/session/${encodeURIComponent(sessionId)}/stream?follow=false`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`The audit agent could not be read (${res.status}).`);
  }
  return captureState(parseFacts(await res.text()));
};

/** Retires the agent session; its sandbox and browser go with it. */
export const endCapture = async (sessionId: string): Promise<void> => {
  await fetch(
    `${agentUrl()}/eve/v1/session/${encodeURIComponent(sessionId)}/end`,
    { body: "{}", headers: headers(), method: "POST" }
  ).catch(() => undefined);
};

const PRIVATE_BLOB_HOST = /^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

/**
 * Only a signed link into a private Vercel Blob store is fetched. The link
 * comes back through the model's answer, so anything else — another host, a
 * plain address — is refused rather than requested.
 */
export const isAgentImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      PRIVATE_BLOB_HOST.test(url.host) &&
      url.searchParams.has("vercel-blob-signature")
    );
  } catch {
    return false;
  }
};

const copyImage = async (
  image: ReviewImage,
  prefix: string
): Promise<ReviewImage | null> => {
  if (!isAgentImageUrl(image.url)) {
    return null;
  }
  const res = await fetch(image.url, { redirect: "error" });
  if (!res.ok) {
    return null;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isPng = PNG_MAGIC.every((b, i) => bytes[i] === b);
  if (!isPng || bytes.byteLength > MAX_IMAGE_BYTES) {
    return null;
  }
  const blob = await put(
    `${prefix}/${crypto.randomUUID()}.png`,
    Buffer.from(bytes),
    {
      access: "public",
      contentType: "image/png",
      token: blobToken(),
    }
  );
  return { height: image.height, url: blob.url, width: image.width };
};

/** The agent's screens as review screens, with pictures in this site's store. */
export const storeScreens = async (
  screens: AgentScreen[],
  prefix: string
): Promise<ReviewScreen[]> => {
  const stored = await Promise.all(
    screens.slice(0, 20).map(async (s): Promise<ReviewScreen | null> => {
      const image = s?.image ? await copyImage(s.image, prefix) : null;
      if (!image) {
        return null;
      }
      return {
        id: newItemId(),
        image,
        marks: [],
        note: "",
        pins: [],
        sourceUrl: typeof s.sourceUrl === "string" ? s.sourceUrl : "",
        title: typeof s.title === "string" ? s.title.slice(0, 160) : "",
        viewport: s.viewport === "mobile" ? "mobile" : "desktop",
      };
    })
  );
  return stored.filter((s): s is ReviewScreen => s !== null);
};
