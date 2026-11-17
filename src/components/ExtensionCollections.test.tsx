import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const addItem = vi.fn(() => Promise.resolve({ id: "i1" }));
vi.mock("../services/libraryService", () => ({
  collectionsApi: {
    addItem,
    list: () =>
      Promise.resolve([{ id: "c1", itemCount: 3, name: "Packaging" }]),
  },
}));
vi.mock("../services/portfolioService", () => ({
  authStorage: { getToken: () => "token" },
}));

const { ExtensionCollections } = await import("./ExtensionCollections");

const asked = (message: Record<string, unknown>) =>
  new Promise<Record<string, unknown>>((resolve) => {
    const onAnswer = (event: MessageEvent) => {
      if (
        event.data?.source === "board-capture-page" &&
        event.data.id === "x1"
      ) {
        window.removeEventListener("message", onAnswer);
        resolve(event.data);
      }
    };
    window.addEventListener("message", onAnswer);
    window.postMessage(
      { ...message, id: "x1", source: "board-capture-extension" },
      window.location.origin
    );
  });

afterEach(() => {
  document.body.innerHTML = "";
});

it("lists collections and saves an image for the extension", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<ExtensionCollections />));

  const listed = await asked({ type: "collections" });
  expect(listed).toMatchObject({
    collections: [{ id: "c1", name: "Packaging" }],
    ok: true,
  });

  const saved = await asked({
    collectionId: "c1",
    title: "Some shop",
    type: "save-image",
    url: "https://shop.example.com/tin.jpg",
  });
  expect(saved.ok).toBe(true);
  expect(addItem).toHaveBeenCalledWith("c1", {
    alt: null,
    copy: true,
    kind: "image",
    title: "Some shop",
    url: "https://shop.example.com/tin.jpg",
  });
});
