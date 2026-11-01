import "../../index.css";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Look } from "../presets";
import { LooksPanel } from "./LooksPanel";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );

afterEach(() => {
  root?.unmount();
  host?.remove();
});

const saved: Look = {
  code: "BC",
  edit: { contrast: 0.2 },
  family: "saved",
  id: "saved:1",
  index: 1,
  name: "Bird Creek Warm",
};

const render = async (
  props: Partial<Parameters<typeof LooksPanel>[0]> = {}
) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <LooksPanel
      active={null}
      onChoose={vi.fn()}
      onSave={vi.fn(() => Promise.resolve())}
      onStrength={vi.fn()}
      strength={100}
      {...props}
    />
  );
  await flush();
  return host;
};

const openTab = async (el: HTMLElement, letter: string) => {
  const tab = [...el.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === letter
  );
  tab?.click();
  await flush();
};

describe("LooksPanel saved and brand looks", () => {
  it("shows saved looks and saves the current edit by name", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const onChoose = vi.fn();
    const el = await render({
      canSave: true,
      onChoose,
      onSave,
      savedLooks: [saved],
    });
    await openTab(el, "★");
    const tile = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "BC"
    );
    tile?.click();
    expect(onChoose).toHaveBeenCalledWith(saved);
    const input = el.querySelector(
      'input[aria-label="Name for this look"]'
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, "Moody Teal");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await flush();
    expect(onSave).toHaveBeenCalledWith("Moody Teal");
  });

  it("won't save an unedited photo", async () => {
    const el = await render({ canSave: false });
    await openTab(el, "★");
    expect(
      (el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(el.textContent).toContain("Nothing saved yet");
  });

  it("explains an empty Brands tab", async () => {
    const el = await render();
    await openTab(el, "B");
    expect(el.textContent).toContain("No brand kit has a look yet");
  });

  it("keeps the old strip when saving isn't offered", async () => {
    const el = await render({ onSave: undefined });
    expect(
      [...el.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === "★"
      )
    ).toBe(false);
  });
});
