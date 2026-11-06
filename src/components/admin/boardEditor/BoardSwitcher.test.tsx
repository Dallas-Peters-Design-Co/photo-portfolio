import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BoardSwitcher } from "./BoardSwitcher";

/** Jumping between boards: most recent first, filtered, Enter goes. */
const board = (id: string, title: string, updatedAt: string) => ({
  coverUrl: null,
  createdAt: updatedAt,
  id,
  isPublic: false,
  itemCount: 3,
  slug: null,
  title,
  updatedAt,
});
vi.stubGlobal("fetch", () =>
  Promise.resolve(
    Response.json([
      board("a", "Vision posters", "2026-11-01T00:00:00Z"),
      board("b", "Moodboard", "2026-11-05T00:00:00Z"),
      board("here", "This one", "2026-11-04T00:00:00Z"),
    ])
  )
);

it("lists the other boards, newest first, and goes to the one picked", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const onGo = vi.fn();
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <BoardSwitcher currentId="here" onClose={() => undefined} onGo={onGo} />
    )
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll(".collection-panel__name")).toHaveLength(2)
  );
  const names = [...host.querySelectorAll(".collection-panel__name")].map(
    (n) => n.textContent
  );
  expect(names).toEqual(["Moodboard", "Vision posters"]);

  const field = host.querySelector("input") as HTMLInputElement;
  await act(() => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    set?.call(field, "vision");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(() => {
    field.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
    );
  });
  expect(onGo).toHaveBeenCalledWith("/admin/boards/a");
  root.unmount();
});
