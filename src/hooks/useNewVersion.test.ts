import { describe, expect, it } from "vitest";
import { builtScript } from "./useNewVersion";

describe("builtScript", () => {
  it("finds the main script in the page or a script URL", () => {
    expect(
      builtScript('<script type="module" src="/assets/index-BlVV4aB3.js">')
    ).toBe("/assets/index-BlVV4aB3.js");
    expect(
      builtScript("https://www.dallaspeters.com/assets/index-C9u_Lx-4y.js")
    ).toBe("/assets/index-C9u_Lx-4y.js");
    expect(builtScript('<script src="/src/main.tsx">')).toBeNull();
  });
});
