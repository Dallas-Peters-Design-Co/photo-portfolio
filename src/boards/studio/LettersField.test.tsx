import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { LettersField } from "./LettersField";

/** A colour for each letter: one well per letter, one colour each. */
function Harness({ out }: { out: { value: string } }) {
  const [value, setValue] = useState("");
  out.value = value;
  return (
    <LettersField
      label="Letter colours"
      onChange={setValue}
      text={"20\n27"}
      value={value}
    />
  );
}

const cells = (host: HTMLElement) =>
  host.querySelectorAll<HTMLElement>(".studio-letters__cell");

/** Opens a letter's well and types a colour into the picker. */
const colour = async (host: HTMLElement, i: number, hex: string) => {
  await act(async () =>
    cells(host)
      [i]?.querySelector<HTMLButtonElement>(".color-well__swatch")
      ?.click()
  );
  const field = document.querySelector<HTMLInputElement>(".oklch__text");
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(() => {
    set?.call(field, hex);
    field?.dispatchEvent(new Event("input", { bubbles: true }));
    return Promise.resolve();
  });
  // Close the picker.
  await act(async () =>
    document.querySelector<HTMLButtonElement>(".color-well__scrim")?.click()
  );
};

it("gives each letter its own single colour, and puts one back", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const out = { value: "" };
  const root = createRoot(host);
  await act(async () => root.render(<Harness out={out} />));

  await colour(host, 1, "#ff0000"); // the "0"
  await colour(host, 3, "#0000ff"); // the "7" (text index 4, after the break)
  expect(out.value).toBe(",#ff0000,,,#0000ff");
  expect(cells(host)[0]?.dataset.own).toBeUndefined();
  expect(cells(host)[1]?.dataset.own).toBe("");

  // The cross puts a letter back to the type colours.
  await act(async () =>
    cells(host)[1]
      ?.querySelector<HTMLButtonElement>(".studio-letters__clear")
      ?.click()
  );
  expect(out.value).toBe(",,,,#0000ff");
  root.unmount();
});
