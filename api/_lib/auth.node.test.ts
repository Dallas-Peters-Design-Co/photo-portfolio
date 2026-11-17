import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it } from "vitest";
import { getBearerUser, getSessionUser, signToken } from "./auth.js";

const SECRET = "test-secret-long-enough-for-jwt";

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

const bearer = (token: string) => `Bearer ${token}`;

describe("a session's role", () => {
  it("lets the admin through every admin check", () => {
    const token = signToken({ email: "me@x.test", role: "admin", sub: "u1" });
    expect(getBearerUser(bearer(token))).toEqual({
      email: "me@x.test",
      userId: "u1",
    });
  });

  it("keeps a member out of every admin check, but knows who they are", () => {
    const token = signToken({
      email: "guest@x.test",
      role: "member",
      sub: "u2",
    });
    expect(getBearerUser(bearer(token))).toBeNull();
    expect(getSessionUser(bearer(token))).toEqual({
      email: "guest@x.test",
      role: "member",
      userId: "u2",
    });
  });

  it("reads a token from before roles as the admin's", () => {
    const legacy = jwt.sign({ email: "me@x.test", sub: "u1" }, SECRET);
    expect(getBearerUser(bearer(legacy))?.userId).toBe("u1");
  });

  it("refuses a token signed with another key", () => {
    const forged = jwt.sign(
      { email: "me@x.test", role: "admin", sub: "u1" },
      "some-other-secret-entirely"
    );
    expect(getBearerUser(bearer(forged))).toBeNull();
    expect(getSessionUser(bearer(forged))).toBeNull();
  });
});
