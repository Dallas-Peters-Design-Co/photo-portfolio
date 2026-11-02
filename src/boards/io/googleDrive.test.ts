import { afterEach, describe, expect, it } from "vitest";
import { cachedToken } from "./googleDrive";

const DRIVE = "https://www.googleapis.com/auth/drive.file";

afterEach(() => localStorage.clear());

const store = (token: string, expiresAt: number, scope: string) => {
  localStorage.setItem("drive-picker-token", token);
  localStorage.setItem("drive-picker-token-expiry", String(expiresAt));
  localStorage.setItem("drive-picker-token-scope", scope);
};

describe("Drive picker token", () => {
  it("reuses a stored token that is still good, so consent isn't asked every pick", () => {
    store("abc", 10_000_000, `openid ${DRIVE}`);
    expect(cachedToken(1000)).toBe("abc");
  });

  it("asks again once it has expired or doesn't cover Drive", () => {
    store("abc", 1000 + 30_000, DRIVE);
    expect(cachedToken(1000)).toBeNull();
    store("abc", 10_000_000, "openid");
    expect(cachedToken(1000)).toBeNull();
  });
});
