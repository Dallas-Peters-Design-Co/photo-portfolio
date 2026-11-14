import type { Page } from "playwright-core";
import { expect, it } from "vitest";
import { shootPage } from "./screenshot.js";

/** A page whose browser can't take a picture taller than `limit`. */
const pageThatManages = (limit: number) => {
  const asked: (number | "view")[] = [];
  const page = {
    evaluate: () => Promise.resolve(),
    screenshot: (options: { clip?: { height: number } }) => {
      const tall = options.clip?.height;
      asked.push(tall ?? "view");
      if (tall !== undefined && tall > limit) {
        return Promise.reject(new Error("Unable to capture screenshot"));
      }
      return Promise.resolve(Buffer.from("picture"));
    },
    viewportSize: () => ({ height: 950, width: 1440 }),
    waitForTimeout: () => Promise.resolve(),
  } as unknown as Page;
  return { asked, page };
};

const want = { height: 9000, type: "png" as const, width: 1440 };

it("takes the full height when the browser can", async () => {
  const { asked, page } = pageThatManages(20_000);
  expect((await shootPage(page, want)).height).toBe(9000);
  expect(asked).toEqual([9000]);
});

it("steps down to a shorter picture when a tall one fails", async () => {
  const { asked, page } = pageThatManages(2000);
  expect((await shootPage(page, want)).height).toBe(1600);
  expect(asked).toEqual([9000, 4000, 1600]);
});

it("falls back to what's in view, and only then gives up", async () => {
  const { asked, page } = pageThatManages(0);
  expect((await shootPage(page, want)).height).toBe(950);
  expect(asked.at(-1)).toBe("view");
  const dead = {
    ...page,
    screenshot: () => Promise.reject(new Error("Unable to capture screenshot")),
  } as unknown as Page;
  await expect(shootPage(dead, want)).rejects.toThrow("Unable to capture");
});
