import { expect, it } from "vitest";
import { parseFrameConfig } from "./frameConfig.js";

it("keeps a designed frame's flattened picture through a save", () => {
  expect(
    parseFrameConfig({
      designed: true,
      renderKey: "1x2y3z.4k",
      renderUrl: "https://blob.example.com/boards/frames/frame.png",
    })
  ).toEqual({
    designed: true,
    renderKey: "1x2y3z.4k",
    renderUrl: "https://blob.example.com/boards/frames/frame.png",
  });
});

it("refuses a picture that isn't a public https address", () => {
  for (const renderUrl of [
    "blob:https://x/1",
    "javascript:alert(1)",
    "http://x/a.png",
  ]) {
    expect(
      parseFrameConfig({ designed: true, renderKey: "k", renderUrl })
    ).toEqual({ designed: true });
  }
});
