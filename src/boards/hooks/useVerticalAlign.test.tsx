import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { normalizeTextStyle } from "../../../config/textStyle";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { useVerticalAlign, wordsHeight } from "./useVerticalAlign";

const textItem = (verticalAlign: "middle" | "bottom" | null): BoardItem =>
  ({
    ...BLANK_ITEM,
    body: "Two words",
    fontSize: 20,
    height: 200,
    id: "t",
    kind: "text",
    textStyle: normalizeTextStyle({
      background: "#ff0000",
      lineHeight: 1,
      verticalAlign,
    }),
    width: 300,
  }) as BoardItem;

function Field({ item }: { item: BoardItem }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useVerticalAlign(ref, item);
  return (
    <textarea
      readOnly
      ref={ref}
      style={{
        border: 0,
        boxSizing: "border-box",
        fontSize: 20,
        height: item.height,
        lineHeight: 1,
        padding: 0,
        width: item.width,
      }}
      value={item.body ?? ""}
    />
  );
}

const paddingFor = (item: BoardItem) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Field item={item} />));
  const el = host.querySelector("textarea") as HTMLTextAreaElement;
  const pad = Number.parseFloat(el.style.paddingTop || "0");
  const words = wordsHeight(el);
  act(() => root.unmount());
  host.remove();
  return { pad, words };
};

describe("useVerticalAlign", () => {
  it("keeps the vertical alignment when a style is saved", () => {
    expect(normalizeTextStyle({ verticalAlign: "middle" })).toEqual(
      expect.objectContaining({ verticalAlign: "middle" })
    );
    expect(normalizeTextStyle({ verticalAlign: "sideways" })).toBeNull();
  });

  it("pads the words down to the middle or the bottom of the box", () => {
    const top = paddingFor(textItem(null));
    expect(top.pad).toBe(0);
    const middle = paddingFor(textItem("middle"));
    expect(middle.pad).toBeCloseTo((200 - middle.words) / 2, 0);
    const bottom = paddingFor(textItem("bottom"));
    expect(bottom.pad).toBeCloseTo(200 - bottom.words, 0);
  });
});
