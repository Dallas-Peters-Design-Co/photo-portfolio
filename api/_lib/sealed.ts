import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Sealing a value the browser holds but must not be able to read.
 *
 * A browser node's login (and the cookies it gets back) are kept on the
 * node, in the board's own data, so the node can browse again whenever it's
 * opened. Kept there as plaintext, anyone who could read the board could
 * read the password. So the server seals them with AES-256-GCM before they
 * leave it: the board stores ciphertext, and only this server can open it.
 * GCM's tag means a sealed value that's been edited is refused rather than
 * opened as something else.
 *
 * The key is BROWSER_LOGIN_KEY when it's set, otherwise derived from
 * JWT_SECRET under a label of its own, so no new secret is needed. Change
 * either and saved logins stop opening; the node asks for them again.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

const keyOf = (): Buffer => {
  const secret = process.env.BROWSER_LOGIN_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("There is no key to seal logins with");
  }
  return Buffer.from(
    hkdfSync("sha256", secret, "browser-node", "sealed-login-v1", 32)
  );
};

export const seal = (value: unknown): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOf(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, body]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url")
    )
    .join(".");
};

/** The sealed value, or null when it isn't one, was altered, or the key changed. */
export const unseal = <T>(token: unknown): T | null => {
  if (typeof token !== "string") {
    return null;
  }
  const [version, iv, tag, body] = token.split(".");
  if (version !== VERSION || !(iv && tag && body)) {
    return null;
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyOf(),
      Buffer.from(iv, "base64url")
    );
    const tagBytes = Buffer.from(tag, "base64url");
    if (tagBytes.length !== TAG_BYTES) {
      return null;
    }
    decipher.setAuthTag(tagBytes);
    const text = Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};
