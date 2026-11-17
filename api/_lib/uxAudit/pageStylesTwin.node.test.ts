import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { PAGE_STYLES_JS } from "../../../config/pageStyles.js";

const SCRIPT = /const PAGE_STYLES_JS = `([\s\S]*?)`;/;

it("the agent measures pages with the same script the site reads", () => {
  const agent = readFileSync(
    new URL(
      "../../../agents/audit/agent/tools/capture_screen.ts",
      import.meta.url
    ),
    "utf8"
  );
  const site = readFileSync(
    new URL("../../../config/pageStyles.ts", import.meta.url),
    "utf8"
  );
  const agentScript = SCRIPT.exec(agent)?.[1];
  expect(agentScript).toBeTruthy();
  expect(agentScript).toBe(SCRIPT.exec(site)?.[1]);
  expect(PAGE_STYLES_JS).toContain("JSON.stringify");
});
