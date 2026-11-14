import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

// Calls Anthropic directly with ANTHROPIC_API_KEY (not the Vercel AI Gateway).
// Anthropic's commercial terms: API inputs and outputs are not used for training.
// Keys that are not scoped to one workspace must name it per request.
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  headers: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
});

export default defineAgent({
  model: anthropic("claude-opus-5-5"),
  limits: {
    // Stop a runaway audit before it gets expensive.
    sessionUsage: ({ window }) => (window.costUsd ?? 0) >= 5,
    // Audit sessions are one-shot; let idle ones expire after a day.
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,
  },
});
