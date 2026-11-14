import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";

const step = vi.fn();
const capture = vi.fn();
const seal = vi.fn();

vi.mock("../../services/browserService", () => ({
  browserApi: { capture, seal, step },
}));
vi.mock("../../theme/SiteSettingsProvider", () => ({
  useSiteSettings: () => ({ settings: { theme: { accent: "#c4421a" } } }),
}));

const { BrowserNode } = await import("./BrowserNode");

/** A 1×1 picture, so the preview has something to load. */
const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
});

const node = (config: Record<string, unknown>): BoardItem =>
  ({
    config,
    height: 640,
    id: "browser-1",
    kind: "op",
    nodeType: "browser",
    width: 760,
    x: 0,
    y: 0,
  }) as unknown as BoardItem;

/** Mounts the node and feeds every config change back in, as the board does. */
const mount = (initial: Record<string, unknown>) => {
  let config = initial;
  const changes: Record<string, unknown>[] = [];
  host = document.createElement("div");
  host.style.cssText =
    "position:absolute;left:0;top:0;width:760px;height:640px";
  document.body.append(host);
  root = createRoot(host);
  const render = () =>
    root?.render(
      <BrowserNode
        item={node(config)}
        onConfigChange={(next) => {
          changes.push(next);
          config = next;
          render();
        }}
        readOnly={false}
      />
    );
  act(render);
  return { changes, current: () => config };
};

const settle = () =>
  act(async () => await new Promise((r) => setTimeout(r, 20)));

describe("BrowserNode", () => {
  it("opens an address, keeps where it is and the sealed session, then screenshots it", async () => {
    step.mockResolvedValue({
      image: null,
      preview: PIXEL,
      previewHeight: 900,
      session: "sealed-session",
      title: "Pretext",
      url: "https://app.example.com/home",
      width: 1440,
    });
    capture.mockResolvedValue({
      image: {
        height: 3000,
        url: "https://blob.example.com/shot.png",
        width: 1440,
      },
      preview: null,
      previewHeight: 0,
      session: "sealed-session-2",
      title: "Pretext",
      url: "https://app.example.com/home",
      width: 1440,
    });
    const { current } = mount({
      loginUser: "dallas@example.com",
      sealedLogin: "sealed-login",
    });
    const input = host?.querySelector(
      'input[aria-label="Address"]'
    ) as HTMLInputElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      set?.call(input, "app.example.com");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.form?.requestSubmit();
    });
    await settle();
    expect(step).toHaveBeenCalledWith(
      expect.objectContaining({
        sealedLogin: "sealed-login",
        url: "app.example.com",
        viewport: "desktop",
      })
    );
    expect(current()).toMatchObject({
      pageUrl: "https://app.example.com/home",
      session: "sealed-session",
      url: "https://app.example.com/home",
    });
    expect(document.querySelector(".browser-node__page-shot")).not.toBeNull();

    const shoot = [...(host?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent?.includes("Screenshot")
    ) as HTMLButtonElement;
    act(() => shoot.click());
    await settle();
    expect(current()).toMatchObject({
      captureUrl: "https://blob.example.com/shot.png",
      captureWidth: 1440,
      session: "sealed-session-2",
    });
    // Now it's a picture to mark up.
    expect(document.querySelector(".browser-node__shot")).not.toBeNull();
  });

  it("saves a login sealed, never the password", async () => {
    seal.mockResolvedValue({
      sealedLogin: "sealed!",
      username: "dallas@example.com",
    });
    const { current } = mount({});
    act(() =>
      (
        document.querySelector(
          'button[aria-label="Add a login"]'
        ) as HTMLButtonElement
      ).click()
    );
    const fill = (label: string, value: string) => {
      const el = host?.querySelector(
        `input[aria-label="${label}"]`
      ) as HTMLInputElement;
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    act(() => {
      fill("Username or email", "dallas@example.com");
      fill("Password", "hunter22");
    });
    act(() =>
      (
        document.querySelector(".browser-node__login") as HTMLFormElement
      ).requestSubmit()
    );
    await settle();
    expect(seal).toHaveBeenCalledWith({
      loginUrl: "",
      password: "hunter22",
      username: "dallas@example.com",
    });
    expect(current()).toEqual({
      loginUser: "dallas@example.com",
      sealedLogin: "sealed!",
      session: "",
    });
    expect(JSON.stringify(current())).not.toContain("hunter22");
  });

  it("pins a numbered note on the screenshot and lists it beside the node", () => {
    const { current } = mount({
      captureHeight: 1000,
      captureUrl: "https://blob.example.com/shot.png",
      captureWidth: 1000,
      pageUrl: "https://app.example.com/home",
    });
    const surface = host?.querySelector(
      ".browser-node__surface"
    ) as HTMLElement;
    const box = surface.getBoundingClientRect();
    act(() => {
      surface.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: box.left + box.width / 2,
          clientY: box.top + 10,
          pointerId: 1,
        })
      );
    });
    const notes = current().notes as { x: number }[];
    expect(notes).toHaveLength(1);
    expect(notes[0]?.x).toBeCloseTo(0.5, 1);
    expect(document.querySelector(".browser-node__notes li")).not.toBeNull();
    expect(
      document.querySelector('button[aria-label="Note 1"]')
    ).not.toBeNull();
  });

  it("reshapes an arrow with the Edit tool", () => {
    const { current } = mount({
      captureHeight: 1000,
      captureUrl: "https://blob.example.com/shot.png",
      captureWidth: 1000,
      marks: [
        {
          id: "a1",
          kind: "arrow",
          points: [
            [0.1, 0.1],
            [0.3, 0.3],
          ],
        },
      ],
      pageUrl: "https://app.example.com/home",
    });
    const edit = host?.querySelector<HTMLButtonElement>(
      'button[aria-label^="Edit:"]'
    );
    act(() => edit?.click());
    const mark = host?.querySelector(".review-markup__mark");
    act(() => {
      mark?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const tip = host?.querySelectorAll(".review-mark-edit__handle")[1];
    expect(tip).toBeDefined();
    const surface = host?.querySelector(
      ".browser-node__surface"
    ) as HTMLElement;
    const box = surface.getBoundingClientRect();
    const send = (type: string, fx: number, fy: number) =>
      act(() => {
        tip?.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            clientX: box.left + box.width * fx,
            clientY: box.top + box.height * fy,
            pointerId: 1,
          })
        );
      });
    send("pointerdown", 0.3, 0.3);
    send("pointermove", 0.8, 0.6);
    send("pointerup", 0.8, 0.6);
    const [arrow] = current().marks as { points: [number, number][] }[];
    expect(arrow?.points[0]).toEqual([0.1, 0.1]);
    expect(arrow?.points[1]?.[0]).toBeCloseTo(0.8, 1);
    expect(arrow?.points[1]?.[1]).toBeCloseTo(0.6, 1);
  });
});
