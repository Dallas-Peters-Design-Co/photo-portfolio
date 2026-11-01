import { createHash, timingSafeEqual } from "node:crypto";

/**
 * A small Model Context Protocol server: just enough of the Streamable HTTP
 * transport for Claude to list and call tools, stateless, one JSON response
 * per request. No SDK — the protocol for tools is a handful of JSON-RPC
 * methods, and a serverless function has no session to keep anyway.
 */

export const SERVER_INFO = { name: "dallaspeters-photos", version: "1.0.0" };

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export interface JsonSchema {
  properties?: Record<string, unknown>;
  required?: string[];
  type: "object";
  [key: string]: unknown;
}

export interface McpTool<Ctx> {
  description: string;
  inputSchema: JsonSchema;
  name: string;
  run: (args: Record<string, unknown>, ctx: Ctx) => Promise<unknown>;
  /** Changes something on the site; Claude asks before calling these. */
  writes?: boolean;
}

interface RpcRequest {
  id?: string | number | null;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
}

export type RpcResponse =
  | { id: string | number | null; jsonrpc: "2.0"; result: unknown }
  | {
      error: { code: number; message: string };
      id: string | number | null;
      jsonrpc: "2.0";
    };

/** Thrown by a tool for a problem the caller can fix (bad input, not found). */
export class ToolError extends Error {}

const ok = (id: RpcRequest["id"], result: unknown): RpcResponse => ({
  id: id ?? null,
  jsonrpc: "2.0",
  result,
});

const fail = (
  id: RpcRequest["id"],
  code: number,
  message: string
): RpcResponse => ({
  error: { code, message },
  id: id ?? null,
  jsonrpc: "2.0",
});

const asText = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

const callTool = async <Ctx>(
  msg: RpcRequest,
  tools: McpTool<Ctx>[],
  ctx: Ctx
): Promise<RpcResponse> => {
  const name = msg.params?.name;
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return fail(msg.id, -32_602, `Unknown tool: ${String(name)}`);
  }
  const raw = msg.params?.arguments;
  const args =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  try {
    const value = await tool.run(args, ctx);
    return ok(msg.id, { content: [{ text: asText(value), type: "text" }] });
  } catch (e) {
    // A tool's own failure is a result Claude can read and recover from, not
    // a protocol error.
    const message =
      e instanceof ToolError
        ? e.message
        : "The site couldn't do that just now.";
    if (!(e instanceof ToolError)) {
      console.error(`[mcp] ${tool.name}`, e);
    }
    return ok(msg.id, {
      content: [{ text: message, type: "text" }],
      isError: true,
    });
  }
};

/**
 * One JSON-RPC message in, its response out — or null for a notification,
 * which gets no response.
 */
export const handleRpc = <Ctx>(
  msg: RpcRequest,
  tools: McpTool<Ctx>[],
  ctx: Ctx
): Promise<RpcResponse | null> | RpcResponse | null => {
  if (msg.id === undefined || msg.id === null) {
    return null;
  }
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      const protocolVersion =
        typeof asked === "string" && SUPPORTED_VERSIONS.includes(asked)
          ? asked
          : SUPPORTED_VERSIONS[0];
      return ok(msg.id, {
        capabilities: { tools: { listChanged: false } },
        instructions:
          "Dallas Peters' site admin: proposals, agreements, invoices, client reviews, brand kits, recent activity and the photo library. Invoices made here are drafts; they're sent from the site's admin after a last look. Brand kit references are dated notes (decisions, feedback, call notes) with a source; add them with add_brand_reference, citing the note or email they came from.",
        protocolVersion,
        serverInfo: SERVER_INFO,
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: tools.map((t) => ({
          annotations: {
            destructiveHint: false,
            readOnlyHint: !t.writes,
          },
          description: t.description,
          inputSchema: t.inputSchema,
          name: t.name,
        })),
      });
    case "tools/call":
      return callTool(msg, tools, ctx);
    default:
      return fail(msg.id, -32_601, `Method not found: ${String(msg.method)}`);
  }
};

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The minimum length of MCP_ACCESS_TOKEN; anything shorter is refused. */
export const MIN_TOKEN = 32;

/** Constant-time check of a presented key against MCP_ACCESS_TOKEN. */
export const keyMatches = (
  presented: string | undefined,
  expected: string | undefined
): boolean => {
  if (!(presented && expected) || expected.length < MIN_TOKEN) {
    return false;
  }
  return timingSafeEqual(digest(presented), digest(expected));
};
