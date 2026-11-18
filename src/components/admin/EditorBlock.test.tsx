import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { EditorBlock } from "./EditorBlock";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("defers a folded editor and retains its DOM and state after opening", async () => {
  const mount = vi.fn();
  function Body() {
    mount();
    return <input aria-label="Draft" defaultValue="Kept" />;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (collapsed: boolean) =>
    act(() =>
      root.render(
        <EditorBlock
          collapsed={collapsed}
          onToggle={() => undefined}
          title="Screen"
        >
          <Body />
        </EditorBlock>
      )
    );
  try {
    await render(true);
    expect(mount).not.toHaveBeenCalled();
    await render(false);
    const input = host.querySelector("input");
    if (input) {
      input.value = "Unsaved edit";
    }
    await render(true);
    await render(false);
    expect(host.querySelector("input")).toBe(input);
    expect(input?.value).toBe("Unsaved edit");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
