import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { browse } from "./browse.js";
import { seal, unseal } from "./sealed.js";

/**
 * A browser node against a real (local) site: a sign-in that asks for the
 * email first and the password on the next screen, a page only a signed-in
 * visitor sees, and a link to click on it.
 */

vi.stubEnv("JWT_SECRET", "test-secret-for-sealing");

const page = (body: string) =>
  `<!doctype html><html><head><title>T</title></head><body style="margin:0;font:16px sans-serif">${body}</body></html>`;

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const signedIn = (req.headers.cookie ?? "").includes("sid=ok");
    const send = (html: string, headers: Record<string, string> = {}) => {
      res.writeHead(200, { "content-type": "text/html", ...headers });
      res.end(page(html));
    };
    if (url.pathname === "/login") {
      return send(
        '<form method="get" action="/password"><input type="email" name="email"><button>Next</button></form>'
      );
    }
    if (url.pathname === "/password") {
      return send(
        `<form method="get" action="/session"><input type="hidden" name="email" value="${url.searchParams.get("email")}"><input type="password" name="pw"><button>Sign in</button></form>`
      );
    }
    if (url.pathname === "/session") {
      const ok =
        url.searchParams.get("email") === "dallas@example.com" &&
        url.searchParams.get("pw") === "s3cret";
      res.writeHead(302, {
        location: ok ? "/app" : "/login",
        ...(ok ? { "set-cookie": "sid=ok; Path=/" } : {}),
      });
      return res.end();
    }
    if (!signedIn) {
      res.writeHead(302, { location: "/login" });
      return res.end();
    }
    if (url.pathname === "/app") {
      return send(
        '<h1>Dashboard</h1><a href="/app/settings" style="display:block;position:absolute;left:0;top:300px;width:400px;height:60px">Settings</a>'
      );
    }
    return send("<h1>Settings page</h1>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const anyHost = async () => true;
const login = {
  loginUrl: "",
  password: "s3cret",
  username: "dallas@example.com",
};

describe("sealing a login", () => {
  it("opens what it sealed, and nothing that was altered", () => {
    const sealed = seal(login);
    expect(sealed).not.toContain("s3cret");
    expect(unseal(sealed)).toEqual(login);
    const flipped = `${sealed.slice(0, -2)}${sealed.endsWith("A") ? "B" : "A"}x`;
    expect(unseal(flipped)).toBeNull();
    expect(unseal("nonsense")).toBeNull();
  });
});

describe("browse", () => {
  it("signs in through a two-step form, keeps the session, and follows a click", async () => {
    const first = await browse({
      allowHost: anyHost,
      login,
      session: null,
      url: `${base}/app`,
      width: 800,
    });
    expect(new URL(first.url).pathname).toBe("/app");
    expect(first.preview?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(first.session.cookies.some((c) => c.name === "sid")).toBe(true);

    // The next step carries the session, so no sign-in this time.
    const next = await browse({
      allowHost: anyHost,
      click: { x: 100, y: 330 },
      login: null,
      session: first.session,
      url: first.url,
      width: 800,
    });
    expect(new URL(next.url).pathname).toBe("/app/settings");
  }, 60_000);

  it("never lets the page reach a host that isn't allowed", async () => {
    const blocked = await browse({
      allowHost: async () => false,
      login: null,
      session: null,
      url: `${base}/login`,
      width: 800,
    }).catch((e: Error) => e);
    expect(blocked).toBeInstanceOf(Error);
  }, 60_000);
});
