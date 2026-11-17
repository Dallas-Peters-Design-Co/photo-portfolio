import sharp from "sharp";
import { expect, it } from "vitest";
import { colourBlindTiles, VISION_KINDS } from "./colourBlind.js";

it("re-colours the top of each screen once per kind of colour-blindness", async () => {
  const red = await sharp({
    create: {
      background: { b: 0, g: 0, r: 220 },
      channels: 3,
      height: 20,
      width: 20,
    },
  })
    .jpeg()
    .toBuffer();
  const tile = {
    bottom: 1,
    data: red.toString("base64"),
    label: "T1",
    screenId: "s1",
    screenTitle: "Home",
    top: 0,
  };
  const made = await colourBlindTiles(new Map([["s1", [tile]]]));
  expect(made).toHaveLength(VISION_KINDS.length);
  expect(made[0]?.label).toContain('"Home"');
  // Red as protanopia sees it is no longer red.
  const { data } = await sharp(Buffer.from(made[0]?.data ?? "", "base64"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(data[0]).toBeLessThan(150);
});
