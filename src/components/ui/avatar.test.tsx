import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Avatar } from "./avatar";

it("shows initials for missing and failed images and recovers when the URL changes", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (src?: string) =>
    act(() =>
      root.render(<Avatar alt="Dallas Peters" initials="DP" src={src} />)
    );
  try {
    render();
    expect(host.textContent).toBe("DP");
    const valid =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    render(valid);
    await vi.waitFor(() =>
      expect(host.querySelector("img")?.naturalWidth).toBe(1)
    );
    expect(host.textContent).toBe("");
    render("data:image/png;base64,AAAA");
    await vi.waitFor(() => expect(host.textContent).toBe("DP"));
    await vi.waitFor(() => expect(host.querySelector("img")).toBeNull());
    render(valid);
    await vi.waitFor(() =>
      expect(host.querySelector("img")?.naturalWidth).toBe(1)
    );
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Dallas Peters"
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
