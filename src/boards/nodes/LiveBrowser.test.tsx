import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { browserConfigOf } from "../../../config/nodes/browser.js";

const uploaded: File[] = [];
vi.mock("../../services/portfolioService", () => ({
  portfolioService: {
    uploadImageFile: (file: File) => {
      uploaded.push(file);
      return Promise.resolve({ url: "https://blob.example/shot.jpg" });
    },
  },
}));

const { addressOf, canBrowseLive, LiveBrowser } = await import("./LiveBrowser");

afterEach(() => {
  window.photosDesktop = undefined;
});

it("reads a typed address as https unless it says otherwise", () => {
  expect(addressOf(" example.com/pricing ")).toBe(
    "https://example.com/pricing"
  );
  expect(addressOf("http://localhost:3000")).toBe("http://localhost:3000");
  expect(addressOf("")).toBe("");
});

it("is only offered in a desktop build that can screenshot a page", () => {
  expect(canBrowseLive()).toBe(false);
  window.photosDesktop = {
    captureWebview: () => Promise.reject(new Error("no")),
  } as unknown as Window["photosDesktop"];
  expect(canBrowseLive()).toBe(true);
});

it("opens the page in its own storage and turns a screenshot into the node's picture", async () => {
  window.photosDesktop = {
    captureWebview: (id: number) =>
      Promise.resolve({
        // "hi" as base64: the bytes don't matter here.
        data: "aGk=",
        height: 2400,
        title: `Page ${id}`,
        url: "https://example.com/pricing",
        width: 2880,
      }),
  } as unknown as Window["photosDesktop"];
  const patches: Record<string, unknown>[] = [];
  let captured = 0;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <LiveBrowser
        cfg={browserConfigOf({ url: "https://example.com" })}
        onCaptured={() => {
          captured += 1;
        }}
        update={(p) => patches.push(p)}
      />
    )
  );
  const view = host.querySelector("webview") as HTMLElement & {
    getWebContentsId?: () => number;
  };
  expect(view.getAttribute("src")).toBe("https://example.com");
  expect(view.getAttribute("partition")).toBe("persist:review-browser");
  // Outside the desktop app a <webview> is an unknown element: stand in for
  // the one method the screenshot needs.
  view.getWebContentsId = () => 7;
  const shoot = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Screenshot")
  ) as HTMLElement;
  await act(async () => {
    shoot.click();
    await vi.waitFor(() => expect(captured).toBe(1));
  });
  expect(uploaded[0]?.type).toBe("image/jpeg");
  expect(patches.at(-1)).toMatchObject({
    captureHeight: 2400,
    captureUrl: "https://blob.example/shot.jpg",
    captureWidth: 2880,
    pageUrl: "https://example.com/pricing",
    title: "Page 7",
  });
  act(() => root.unmount());
  host.remove();
});
