import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const uploaded: File[] = [];
vi.mock("../../../services/portfolioService", () => ({
  portfolioService: {
    uploadImageFile: (file: File) => {
      uploaded.push(file);
      return Promise.resolve({ url: "https://blob.example/shot.jpg" });
    },
  },
}));

const { useExtensionCaptures } = await import("./useExtensionCaptures");

/** Posts as the extension's content script does, and waits for the answer. */
const ask = (message: Record<string, unknown>) =>
  new Promise<Record<string, unknown>>((resolve) => {
    const id = Math.random().toString(36);
    const onAnswer = (event: MessageEvent) => {
      if (event.data?.source === "board-capture-page" && event.data.id === id) {
        window.removeEventListener("message", onAnswer);
        resolve(event.data as Record<string, unknown>);
      }
    };
    window.addEventListener("message", onAnswer);
    window.postMessage(
      { ...message, id, source: "board-capture-extension" },
      window.location.origin
    );
  });

it("answers the extension and places a captured page as a Browser node", async () => {
  const placed: unknown[] = [];
  function Board() {
    useExtensionCaptures((page) => placed.push(page));
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Board />));

  expect(await ask({ type: "ping" })).toMatchObject({ ok: true });

  let answer: Record<string, unknown> = {};
  await act(async () => {
    answer = await ask({
      data: "aGk=",
      height: 4200,
      title: "Pretext · Dashboard",
      type: "capture",
      url: "https://pretext.viask.ai/app",
      width: 2880,
    });
  });
  expect(answer.ok).toBe(true);
  expect(uploaded[0]?.type).toBe("image/jpeg");
  expect(placed).toEqual([
    {
      captureHeight: 4200,
      captureUrl: "https://blob.example/shot.jpg",
      captureWidth: 2880,
      pageUrl: "https://pretext.viask.ai/app",
      title: "Pretext · Dashboard",
      url: "https://pretext.viask.ai/app",
    },
  ]);

  // Not a screenshot: refused, and said so.
  const bad = await ask({ type: "capture", width: 10 });
  expect(bad.ok).toBe(false);
  expect(placed).toHaveLength(1);
  act(() => root.unmount());
});
