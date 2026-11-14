import { createHash } from "node:crypto";
import { head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { ReviewDoc, ReviewScreen } from "../../config/review.js";

/**
 * Review screenshots kept in a private Blob store.
 *
 * The store is shared with the audit agent (agents/audit): the agent writes
 * each capture there, and this site reads them. Nothing in it is public. A
 * review stores each picture's plain address; whoever may read the review —
 * the admin, or a visitor holding the review's pass — gets short-lived signed
 * links instead, made fresh on every read. Saving strips the signature again,
 * so an expired link is never what is kept.
 *
 * Connected to the site project with the env prefix REVIEW_BLOB, so its token
 * sits beside the public photo store's BLOB_READ_WRITE_TOKEN without
 * replacing it.
 */

/** How long a signed link in a read review keeps working. */
const READ_LIFETIME_MS = 12 * 60 * 60 * 1000;
/** Long enough to fetch and tile every screen of one audit. */
export const AUDIT_LIFETIME_MS = 30 * 60 * 1000;

const STORE_ID = /^vercel_blob_rw_([A-Za-z0-9]+)_/;

const reviewBlobToken = (): string | undefined =>
  process.env.REVIEW_BLOB_READ_WRITE_TOKEN?.trim() || undefined;

/** The private store's host, read from its token; null when not configured. */
export const reviewStoreHost = (token = reviewBlobToken()): string | null => {
  const id = token ? STORE_ID.exec(token)?.[1] : undefined;
  return id ? `${id.toLowerCase()}.private.blob.vercel-storage.com` : null;
};

const parse = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** Whether a picture lives in the private review store. */
export const isReviewImageUrl = (
  value: string,
  host = reviewStoreHost()
): boolean => {
  const url = parse(value);
  return Boolean(host && url?.protocol === "https:" && url.host === host);
};

/** Any private Blob address, from this store or another: never public. */
export const isPrivateBlobUrl = (value: string): boolean =>
  parse(value)?.host.endsWith(".private.blob.vercel-storage.com") ?? false;

/** A private picture's plain address, with any signature removed. */
export const plainImageUrl = (value: string): string => {
  const url = parse(value);
  if (!(url && isPrivateBlobUrl(value))) {
    return value;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
};

const mapImages = async (
  screens: ReviewScreen[],
  convert: (url: string) => Promise<string> | string
): Promise<ReviewScreen[]> =>
  Promise.all(
    screens.map(async (s) =>
      s.image
        ? { ...s, image: { ...s.image, url: await convert(s.image.url) } }
        : s
    )
  );

/** Screens with every private picture back at its plain address, for saving. */
export const unsignScreens = (
  screens: ReviewScreen[]
): Promise<ReviewScreen[]> => mapImages(screens, plainImageUrl);

export const unsignDoc = async (doc: ReviewDoc): Promise<ReviewDoc> => ({
  ...doc,
  screens: await unsignScreens(doc.screens),
});

const PUBLIC_BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
const MAX_COPY_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * A public Blob picture copied into the private review store; its address
 * there, or the original when the copy cannot be made.
 *
 * A board's pictures are public (the canvas has to read them), so a screen
 * published from a board, or captured or uploaded the old way, arrives with
 * a public address. The copy is named from that address, so saving the same
 * picture again finds the copy already there instead of making another.
 */
const copyToPrivate = async (url: string, token: string): Promise<string> => {
  const parsed = parse(url);
  if (!(parsed?.protocol === "https:" && PUBLIC_BLOB_HOST.test(parsed.host))) {
    return url;
  }
  const key = createHash("sha256").update(url).digest("hex").slice(0, 40);
  // No extension in the name, so the copy can be looked for before the
  // picture is downloaded; the stored content type says what it is.
  const pathname = `reviews/copied/${key}`;
  try {
    const existing = await head(pathname, { token }).catch(() => null);
    if (existing) {
      return existing.url;
    }
    const res = await fetch(url, { redirect: "error" });
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!(res.ok && IMAGE_TYPES.has(type))) {
      return url;
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_COPY_BYTES) {
      return url;
    }
    const blob = await put(pathname, Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: type,
      token,
    });
    return blob.url;
  } catch (e) {
    console.error("[review images] copy failed", e);
    return url;
  }
};

/**
 * A review doc as it is stored: signatures stripped, and every public
 * picture copied into the private store, so a review's pictures stay
 * private however they arrived. Sites without the store keep what they had.
 */
export const storeDoc = async (doc: ReviewDoc): Promise<ReviewDoc> => {
  const plain = await unsignDoc(doc);
  const token = reviewBlobToken();
  if (!token) {
    return plain;
  }
  return {
    ...plain,
    screens: await mapImages(plain.screens, (url) => copyToPrivate(url, token)),
  };
};

/**
 * Screens with every picture from the private store as a signed link that
 * works until `lifetimeMs` from now. One delegation is issued per call and
 * each link is signed for its own pathname, so a link opens one picture only.
 */
export const signScreens = async (
  screens: ReviewScreen[],
  lifetimeMs = READ_LIFETIME_MS
): Promise<ReviewScreen[]> => {
  const token = reviewBlobToken();
  const host = reviewStoreHost(token);
  const plain = await unsignScreens(screens);
  if (
    !(
      token && plain.some((s) => s.image && isReviewImageUrl(s.image.url, host))
    )
  ) {
    return plain;
  }
  const validUntil = Date.now() + lifetimeMs;
  const signed = await issueSignedToken({
    operations: ["get"],
    pathname: "*",
    token,
    validUntil,
  });
  return mapImages(plain, async (url) => {
    if (!isReviewImageUrl(url, host)) {
      return url;
    }
    const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
    const { presignedUrl } = await presignUrl(signed, {
      access: "private",
      operation: "get",
      pathname,
      validUntil,
    });
    return presignedUrl;
  });
};

export const signDoc = async <T extends { doc: ReviewDoc }>(
  review: T
): Promise<T> => ({
  ...review,
  doc: { ...review.doc, screens: await signScreens(review.doc.screens) },
});

/**
 * The plain address of an agent capture, once it is confirmed to be a PNG in
 * the review store. The link arrives through the model's answer, so anything
 * else — another host, a missing file, another type — is refused.
 */
export const confirmAgentImage = async (
  value: string
): Promise<string | null> => {
  const token = reviewBlobToken();
  const plain = plainImageUrl(value);
  if (!(token && isReviewImageUrl(plain, reviewStoreHost(token)))) {
    return null;
  }
  try {
    const blob = await head(plain, { token });
    return blob.contentType === "image/png" ? plain : null;
  } catch {
    return null;
  }
};
