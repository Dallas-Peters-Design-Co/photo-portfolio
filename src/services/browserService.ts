import type { BrowserViewport } from "../../config/nodes/browser.js";
import type { ReviewImage } from "../../config/review.js";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/**
 * The board's browser node talking to api/reviews/browse.ts. Every call is a
 * real browser on the server, so each takes a few seconds.
 */

export interface BrowseStep {
  image: ReviewImage | null;
  /** A JPEG data URL of the page, to show and click on. */
  preview: string | null;
  previewHeight: number;
  /** The site's session after this step, sealed: send it with the next. */
  session: string;
  title: string;
  url: string;
  width: number;
}

export interface BrowseRequest {
  click?: { x: number; y: number } | null;
  enter?: boolean;
  sealedLogin?: string;
  session?: string;
  slug?: string;
  text?: string;
  url: string;
  viewport: BrowserViewport;
}

const post = async <T>(body: unknown, fallback: string): Promise<T> => {
  const res = await fetch(`${apiBase()}/api/reviews/browse`, {
    body: JSON.stringify(body),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  return (await res.json()) as T;
};

export const browserApi = {
  /** A full-page screenshot of where the step ends, stored as an image. */
  capture: (input: BrowseRequest) =>
    post<BrowseStep>(
      { ...input, action: "capture" },
      "Couldn't take the screenshot"
    ),

  /** Seals a login on the server; the password never comes back. */
  seal: (login: { loginUrl: string; password: string; username: string }) =>
    post<{ sealedLogin: string; username: string }>(
      { action: "seal", login },
      "Couldn't save that login"
    ),

  step: (input: BrowseRequest) =>
    post<BrowseStep>({ ...input, action: "step" }, "Couldn't open that page"),
};
