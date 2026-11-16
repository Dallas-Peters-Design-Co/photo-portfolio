import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { SocialPreview } from "./SocialPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const draw = (boxStyle: string) => {
  const host = document.createElement("div");
  host.style.cssText = boxStyle;
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <SocialPreview platform="instagram-post">
        <div style={{ background: "#888", height: "100%", width: "100%" }} />
      </SocialPreview>
    )
  );
  return host;
};

it("scales the whole mock-up to fit a box with a height", async () => {
  const host = draw("width: 400px; height: 300px");
  await new Promise((done) => setTimeout(done, 50));
  const stage = (
    host.querySelector(".social-mock__stage") as HTMLElement
  ).getBoundingClientRect();
  expect(stage.height).toBeLessThanOrEqual(301);
  expect(stage.height).toBeGreaterThan(250);
});

it("fits the width, and takes the height it needs, in a box sized by its content", async () => {
  const host = draw("width: 400px");
  await new Promise((done) => setTimeout(done, 50));
  const mock = (
    host.querySelector(".social-mock") as HTMLElement
  ).getBoundingClientRect();
  const stage = (
    host.querySelector(".social-mock__stage") as HTMLElement
  ).getBoundingClientRect();
  expect(mock.height).toBeGreaterThan(400);
  expect(Math.round(stage.width)).toBe(400);
});
