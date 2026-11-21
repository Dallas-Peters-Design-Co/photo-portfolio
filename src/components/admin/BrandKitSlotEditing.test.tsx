import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { EMPTY_KIT, sanitizeKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { fromStyle, styleElement } from "../../../config/conceptStyle.js";
import { BrandKitComponents } from "./BrandKitComponents";

it("keeps a linked slot button editable across the full kit width and after reopening", async () => {
  const button = {
    ...createConceptElement("button"),
    id: "manual",
    styleId: "ghost",
    text: "User Manual",
  };
  let doc = sanitizeKitDoc({
    ...EMPTY_KIT,
    componentStyles: [
      {
        id: "ghost",
        kind: "button",
        look: { paddingX: 16 },
        name: "Ghost Dark",
      },
      {
        id: "navigation",
        kind: "navbar",
        look: { contents: { header: { elements: [button] } } },
        name: "Navigation",
      },
    ],
  });
  const host = document.createElement("div");
  document.body.append(host);
  host.style.width = "1400px";
  const root = createRoot(host);
  function render() {
    root.render(
      <BrandKitComponents
        doc={doc}
        effective={doc}
        kitId="kit"
        onChange={(next) => {
          doc = sanitizeKitDoc(JSON.parse(JSON.stringify(next)));
          render();
        }}
      />
    );
  }
  function field<T extends HTMLElement>(
    selector: string,
    container: ParentNode = host
  ): T {
    const found = container.querySelector<T>(selector);
    if (!found) {
      throw new Error(`Missing control ${selector}`);
    }
    return found;
  }
  const section = () => field<HTMLElement>('section[aria-label="button"]');
  const toggle = () =>
    [...section().querySelectorAll("label")]
      .find((label) => label.textContent?.includes("Customize flex sizing"))
      ?.querySelector("input");
  try {
    await act(render);
    await userEvent.click(field('[aria-label="Open Navbar Navigation"]'));
    await userEvent.click(field(".review-concepts__element-toggle", section()));
    const slot = section().closest(".review-concepts__slot");
    expect(slot?.getBoundingClientRect().width).toBeGreaterThan(1300);
    const start = field(
      '[aria-label="Button start icon"]',
      section()
    ).getBoundingClientRect();
    const end = field(
      '[aria-label="Button end icon"]',
      section()
    ).getBoundingClientRect();
    expect(end.top).toBe(start.top);
    expect(end.left).toBeGreaterThan(start.right);
    await userEvent.click(toggle() as HTMLInputElement);
    expect(toggle()?.checked).toBe(true);
    await userEvent.fill(field('[aria-label="Padding X"]', section()), "32");
    const [, style] = doc.componentStyles;
    if (!style) {
      throw new Error("Missing saved navbar");
    }
    const placed = styleElement(
      fromStyle(createConceptElement("navbar"), style),
      doc.componentStyles
    );
    expect(placed.slots?.header?.elements[0]).toMatchObject({
      flex: { grow: 0, shrink: 1 },
      paddingX: 32,
      styleId: "ghost",
      text: "User Manual",
    });
    expect(doc.componentStyles[0]?.look.paddingX).toBe(16);
    await act(() => root.render(null));
    await act(render);
    expect(toggle()?.checked).toBe(true);
    expect(
      field<HTMLInputElement>('[aria-label="Padding X"]', section()).value
    ).toBe("32");
    await userEvent.click(toggle() as HTMLInputElement);
    expect(toggle()?.checked).toBe(false);
    host.style.width = "360px";
    expect(section().scrollWidth).toBeLessThanOrEqual(
      section().clientWidth + 1
    );
    expect(
      field('[aria-label="Button end icon"]', section()).getBoundingClientRect()
        .top
    ).toBeGreaterThan(
      field(
        '[aria-label="Button start icon"]',
        section()
      ).getBoundingClientRect().top
    );
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
