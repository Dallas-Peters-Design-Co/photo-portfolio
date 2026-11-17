import { afterEach, describe, expect, it } from "vitest";
import {
  cleanPageStyles,
  describeStyles,
  PAGE_STYLES_JS,
} from "./pageStyles.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("measuring a page's styles", () => {
  it("finds its colours, radii, buttons and pills in a real page", () => {
    document.body.innerHTML = `
      <main style="background: rgb(250, 250, 250); color: rgb(17, 17, 17)">
        <p>Some text</p>
        <button style="background: rgb(15, 118, 110); color: rgb(255, 255, 255); border-radius: 8px">Save</button>
        <span class="status-pill" style="background: rgb(220, 38, 38); color: white; border-radius: 999px; padding: 2px 8px">Failed</span>
      </main>`;
    // biome-ignore lint/security/noGlobalEval: the script is ours, and is run the way the agent runs it
    const styles = cleanPageStyles(JSON.parse(eval(PAGE_STYLES_JS) as string));
    expect(styles?.backgrounds.map((b) => b.value)).toContain(
      "rgb(15, 118, 110)"
    );
    expect(styles?.radii.map((r) => r.value)).toContain("8px");
    const kinds = styles?.components.map((c) => `${c.kind}:${c.text}`);
    expect(kinds).toContain("button:Save");
    expect(kinds).toContain("pill:Failed");
    expect(describeStyles("Home", styles ?? ({} as never))).toContain(
      'Button "Save"'
    );
  });

  it("refuses what holds nothing", () => {
    expect(cleanPageStyles({})).toBeNull();
    expect(cleanPageStyles("nope")).toBeNull();
  });
});
