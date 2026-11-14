import { installAgentBrowser } from "@eve/agent-browser/sandbox";
import { DefaultSandbox, defineSandbox } from "eve/sandbox";

// Chrome for Testing (agent-browser's default browser) has no Linux ARM64
// build. Docker on Apple Silicon runs ARM64 Linux, so there we install
// Playwright's Chromium instead and point agent-browser at it.
const ARM_CHROME = "/usr/local/bin/audit-chrome";
const hostIsArm = process.arch === "arm64";

export const environment = DefaultSandbox.environment({
  // Vercel Sandbox runs x86_64, so only local Docker needs the ARM browser.
  docker: hostIsArm ? { env: { AGENT_BROWSER_EXECUTABLE_PATH: ARM_CHROME } } : {},
  // Chromium is installed once into the prepared template, so each audit
  // session starts with a ready browser.
  prepare: async (sandbox) => {
    const arch = (await sandbox.run({ command: "uname -m" })).stdout.trim();
    if (arch !== "aarch64" && arch !== "arm64") {
      await installAgentBrowser(sandbox);
      return;
    }
    await installAgentBrowser(sandbox, { installBrowser: false });
    const result = await sandbox.run({
      command: [
        "npx -y playwright@latest install --with-deps chromium",
        `sudo ln -sf "$(ls -d $HOME/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -1)" ${ARM_CHROME}`,
        `test -x ${ARM_CHROME}`,
      ].join(" && "),
    });
    if (result.exitCode !== 0) {
      throw new Error(`ARM Chromium install failed: ${result.stderr || result.stdout}`);
    }
  },
});

export default defineSandbox(() => environment.open());
