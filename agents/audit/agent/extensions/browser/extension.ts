import browser from "@eve/agent-browser";

import { BROWSER_SESSION } from "../../lib/browser-session";

export default browser({
  // Shared with the log_in tool, so the agent browses with the logged-in cookies.
  session: BROWSER_SESSION,
  // Mark page text as untrusted content in model output.
  contentBoundaries: true,
  inlineScreenshots: true,
  // No Chrome for Testing build exists for ARM64 Linux; agent/sandbox.ts installs Chromium there.
  installBrowser: process.arch !== "arm64",
});
