import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { bootstrapEnv } from "./bootstrapEnv.js";

bootstrapEnv();

const BCRYPT_ROUNDS = 10;

export const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

/** A member who signs in with Google has no password: nothing matches. */
export const verifyPassword = async (
  plain: string,
  hash: string | null
): Promise<boolean> => (hash ? bcrypt.compare(plain, hash) : false);

/**
 * Who a session is. 'admin' reaches everything; 'member' reaches only the
 * boards shared with them (boardAccess.ts). A token from before roles has
 * none, and was only ever given to the owner, so it reads as admin.
 */
export type UserRole = "admin" | "member";

interface TokenClaims {
  email: string;
  role?: UserRole;
  sub: string;
}

export const roleOf = (value: unknown): UserRole =>
  value === "member" ? "member" : "admin";

export const signToken = (payload: {
  email: string;
  role: UserRole;
  sub: string;
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (minimum 16 characters)");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

export const verifyToken = (token: string): TokenClaims | null => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return null;
    }
    return jwt.verify(token, secret) as TokenClaims;
  } catch {
    return null;
  }
};

/** Anyone signed in, admin or member, with their role. */
export const getSessionUser = (
  authHeader: string | undefined
): { email: string; role: UserRole; userId: string } | null => {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const decoded = verifyToken(authHeader.slice(7));
  if (!(decoded?.sub && decoded.email)) {
    return null;
  }
  return {
    email: decoded.email,
    role: roleOf(decoded.role),
    userId: decoded.sub,
  };
};

/**
 * The admin, or null. Every admin-only endpoint asks this, so a member's
 * token is turned away everywhere at once; the board endpoints that a
 * member may use ask getSessionUser and boardAccess.ts as well.
 */
export const getBearerUser = (
  authHeader: string | undefined
): { userId: string; email: string } | null => {
  const session = getSessionUser(authHeader);
  return session?.role === "admin"
    ? { email: session.email, userId: session.userId }
    : null;
};
