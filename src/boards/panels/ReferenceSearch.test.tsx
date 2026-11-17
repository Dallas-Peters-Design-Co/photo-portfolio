import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const search = vi.fn(() =>
  Promise.resolve([
    {
      colors: ["#ffbf00"],
      description: "warm amber poster",
      height: 100,
      id: "i1",
      source: "collection",
      title: "Poster",
      url: "https://example.com/poster.jpg",
      width: 80,
    },
  ])
);
vi.mock("../../services/libraryService", () => ({
  imagesApi: {
    describe: () => Promise.resolve({ described: 0, left: 0 }),
    pending: () => Promise.resolve(3),
    search,
  },
}));

const { ReferenceSearch } = await import("./ReferenceSearch");

it("searches by colour and mood, and places a hit", async () => {
  const onInsert = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<ReferenceSearch onInsert={onInsert} />));
  await vi.waitFor(() => {
    expect(host.textContent).toContain("3 images aren't searchable");
  });
  const input = host.querySelector("input") as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, "warm amber");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await vi.waitFor(() => {
    expect(host.querySelector('[title="warm amber poster"]')).not.toBeNull();
  });
  expect(search).toHaveBeenCalledWith("warm amber");
  (host.querySelector('[title="warm amber poster"]') as HTMLElement).click();
  expect(onInsert).toHaveBeenCalledWith({
    imageUrl: "https://example.com/poster.jpg",
    thumbUrl: "https://example.com/poster.jpg",
  });
  host.remove();
});
