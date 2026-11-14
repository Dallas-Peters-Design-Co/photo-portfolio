import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * A review's password, and the pass a browser keeps once it's been entered.
 *
 * The password is stored as a scrypt hash with its own salt, never as typed.
 * It lives in the review's doc column under `access`, beside the client's
 * `feedback`: config/review.ts's sanitiser builds the doc from known keys
 * only, so neither is ever sent out with the review, and the designer's save
 * (which replaces the doc) carries both over from the stored row
 * (keepPrivate below). No new column, so no migration before this works.
 *
 * Entering the password gets a pass: an HMAC of the review and its current
 * hash. The page keeps it and sends it with each request. Changing the
 * password changes the hash, which ends every pass given for the old one.
 */

export interface ReviewAccess {
  hash: string;
  salt: string;
}

const KEY_BYTES = 32;
const MIN_PASSWORD = 4;
const MAX_PASSWORD = 200;

const derive = (password: string, salt: string): Buffer =>
  scryptSync(password, Buffer.from(salt, "base64url"), KEY_BYTES);

export const accessOf = (doc: unknown): ReviewAccess | null => {
  const raw = (doc as { access?: Partial<ReviewAccess> } | null)?.access;
  return typeof raw?.hash === "string" && typeof raw.salt === "string"
    ? { hash: raw.hash, salt: raw.salt }
    : null;
};

/** A password worth setting: long enough to mean something, not absurd. */
export const passwordProblem = (password: string): string | null => {
  if (password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters`;
  }
  if (password.length > MAX_PASSWORD) {
    return "That password is too long";
  }
  return null;
};

export const hashPassword = (password: string): ReviewAccess => {
  const salt = randomBytes(16).toString("base64url");
  return { hash: derive(password, salt).toString("base64url"), salt };
};

export const passwordMatches = (
  password: string,
  access: ReviewAccess
): boolean => {
  const expected = Buffer.from(access.hash, "base64url");
  const given = derive(password.slice(0, MAX_PASSWORD), access.salt);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

const passKey = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("There is no key to sign review passes with");
  }
  return secret;
};

/** The pass a browser keeps for this review once the password was right. */
export const passFor = (reviewId: string, access: ReviewAccess): string =>
  createHmac("sha256", passKey())
    .update(`review-pass:${reviewId}:${access.hash}`)
    .digest("base64url");

export const passValid = (
  pass: unknown,
  reviewId: string,
  access: ReviewAccess
): boolean => {
  if (typeof pass !== "string" || pass.length > 100) {
    return false;
  }
  const expected = Buffer.from(passFor(reviewId, access));
  const given = Buffer.from(pass);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/** The pass a request carries: a header from the page, or `?pass=` for the PDF. */
export const passOf = (req: {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}): string | null => {
  const header = req.headers["x-review-pass"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) {
    return value;
  }
  const q = req.query?.pass;
  return (Array.isArray(q) ? q[0] : q) ?? null;
};

/**
 * The private parts of a stored doc to carry into a new one: the password
 * (unless it's being set or cleared) and the client's feedback.
 *
 * `password` undefined keeps the stored one; null or "" removes it; a string
 * sets a new one.
 */
export const keepPrivate = (
  stored: unknown,
  password: unknown
): { access?: ReviewAccess; feedback?: unknown } => {
  const out: { access?: ReviewAccess; feedback?: unknown } = {};
  const feedback = (stored as { feedback?: unknown } | null)?.feedback;
  if (Array.isArray(feedback)) {
    out.feedback = feedback;
  }
  if (typeof password === "string" && password !== "") {
    out.access = hashPassword(password);
  } else if (password === undefined) {
    const access = accessOf(stored);
    if (access) {
      out.access = access;
    }
  }
  return out;
};
