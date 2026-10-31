import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRpc, keyMatches, type McpTool, ToolError } from "../_lib/mcp.js";
import { richToText, SITE_TOOLS } from "../_lib/mcpTools.js";

vi.mock("../_lib/db.js", () => ({ getSql: () => ({}) }));

const TOKEN = "t".repeat(40);

const echo: McpTool<null> = {
  description: "Echo",
  inputSchema: { properties: {}, type: "object" },
  name: "echo",
  run: (args) => {
    if (args.fail === "user") {
      throw new ToolError("Bad input");
    }
    if (args.fail === "crash") {
      throw new Error("db down");
    }
    return Promise.resolve(args);
  },
};

const call = (name: string, args: Record<string, unknown>) =>
  handleRpc(
    {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: args, name },
    },
    [echo],
    null
  );

describe("handleRpc", () => {
  it("initializes with a supported protocol version", async () => {
    const out = await handleRpc(
      {
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      },
      [echo],
      null
    );
    expect(out).toMatchObject({
      result: {
        capabilities: { tools: {} },
        protocolVersion: "2025-03-26",
        serverInfo: { name: "dallaspeters-photos" },
      },
    });
  });

  it("falls back to its newest version for an unknown one", async () => {
    const out = await handleRpc(
      {
        id: 1,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      },
      [echo],
      null
    );
    expect(out).toMatchObject({ result: { protocolVersion: "2025-06-18" } });
  });

  it("gives notifications no response", () => {
    expect(
      handleRpc({ method: "notifications/initialized" }, [echo], null)
    ).toBeNull();
  });

  it("lists tools with read-only hints", async () => {
    const out = await handleRpc({ id: 2, method: "tools/list" }, SITE_TOOLS, {
      sql: {} as never,
    });
    const { tools } = (
      out as {
        result: {
          tools: { annotations: { readOnlyHint: boolean }; name: string }[];
        };
      }
    ).result;
    expect(tools.map((t) => t.name)).toContain("draft_invoice");
    expect(
      tools.find((t) => t.name === "draft_invoice")?.annotations.readOnlyHint
    ).toBe(false);
    expect(
      tools.find((t) => t.name === "list_proposals")?.annotations.readOnlyHint
    ).toBe(true);
  });

  it("returns a tool's result as text", async () => {
    expect(await call("echo", { a: 1 })).toMatchObject({
      result: { content: [{ text: '{\n  "a": 1\n}', type: "text" }] },
    });
  });

  it("reports a tool's own error to Claude, hiding internal ones", async () => {
    expect(await call("echo", { fail: "user" })).toMatchObject({
      result: { content: [{ text: "Bad input" }], isError: true },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const crash = await call("echo", { fail: "crash" });
    expect(JSON.stringify(crash)).not.toContain("db down");
  });

  it("rejects unknown tools and methods", async () => {
    expect(await call("nope", {})).toMatchObject({ error: { code: -32_602 } });
    expect(
      await handleRpc({ id: 3, method: "resources/list" }, [echo], null)
    ).toMatchObject({ error: { code: -32_601 } });
  });
});

describe("keyMatches", () => {
  it("needs a long configured token and an exact match", () => {
    expect(keyMatches(TOKEN, TOKEN)).toBe(true);
    expect(keyMatches(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(keyMatches(undefined, TOKEN)).toBe(false);
    expect(keyMatches("short", "short")).toBe(false);
    expect(keyMatches(TOKEN, undefined)).toBe(false);
  });
});

describe("richToText", () => {
  it("flattens an editor doc into lines", () => {
    const doc = {
      content: [
        {
          content: [
            { text: "Hello ", type: "text" },
            { text: "there", type: "text" },
          ],
          type: "paragraph",
        },
        { content: [{ text: "Next", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    };
    expect(richToText(doc)).toBe("Hello there\nNext\n");
    expect(richToText("plain")).toBe("plain");
    expect(richToText(null)).toBe("");
  });
});

describe("the endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const run = async (req: Partial<VercelRequest>) => {
    const { default: handler } = await import("./[key].js");
    const res = {
      body: undefined as unknown,
      code: 0,
      end() {
        return this;
      },
      json(b: unknown) {
        this.body = b;
        return this;
      },
      setHeader: () => undefined,
      status(c: number) {
        this.code = c;
        return this;
      },
    };
    await handler(req as VercelRequest, res as unknown as VercelResponse);
    return res;
  };

  const ping = {
    body: { id: 9, jsonrpc: "2.0", method: "ping" },
    method: "POST",
  };

  it("is off without MCP_ACCESS_TOKEN", async () => {
    vi.stubEnv("MCP_ACCESS_TOKEN", "");
    expect(
      (await run({ ...ping, headers: {}, query: { key: TOKEN } })).code
    ).toBe(401);
  });

  it("accepts the key in the URL or as a bearer token", async () => {
    vi.stubEnv("MCP_ACCESS_TOKEN", TOKEN);
    const viaUrl = await run({ ...ping, headers: {}, query: { key: TOKEN } });
    expect(viaUrl.code).toBe(200);
    expect(viaUrl.body).toMatchObject({ id: 9, result: {} });
    const viaHeader = await run({
      ...ping,
      headers: { authorization: `Bearer ${TOKEN}` },
      query: { key: "connect" },
    });
    expect(viaHeader.code).toBe(200);
  });

  it("refuses a wrong key and treats 'connect' as no key", async () => {
    vi.stubEnv("MCP_ACCESS_TOKEN", TOKEN);
    expect(
      (await run({ ...ping, headers: {}, query: { key: "x".repeat(40) } })).code
    ).toBe(401);
    expect(
      (await run({ ...ping, headers: {}, query: { key: "connect" } })).code
    ).toBe(401);
  });

  it("acknowledges notifications with 202", async () => {
    vi.stubEnv("MCP_ACCESS_TOKEN", TOKEN);
    const out = await run({
      body: { jsonrpc: "2.0", method: "notifications/initialized" },
      headers: {},
      method: "POST",
      query: { key: TOKEN },
    });
    expect(out.code).toBe(202);
  });
});
