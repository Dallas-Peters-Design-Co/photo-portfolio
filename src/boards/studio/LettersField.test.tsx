import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { LettersField } from "./LettersField";

/** Painting single letters with a set of colours each, not one flat colour. */
function Harness({ out }: { out: { value: string } }) {
  const [value, setValue] = useState("");
  out.value = value;
  return (
    <LettersField
      label="Letter colours"
      onChange={setValue}
      start={["#111111", "#222222", "#333333"]}
      text={"20\n27"}
      value={value}
    />
  );
}

const letter = (host: HTMLElement, i: number) =>
  host.querySelectorAll<HTMLButtonElement>(".studio-letters__letter")[i];

it("paints a letter with every colour in the brush, and puts it back", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const out = { value: "" };
  const root = createRoot(host);
  await act(async () => root.render(<Harness out={out} />));

  // The "0": its own set of three colours, kept in step with the text.
  await act(async () => letter(host, 1)?.click());
  expect(out.value).toBe(",#111111|#222222|#333333");
  expect(letter(host, 1)?.style.background).toContain("linear-gradient");

  // The second line's "7" (text index 4, after the line break).
  await act(async () => letter(host, 3)?.click());
  expect(out.value.split(",")[4]).toBe("#111111|#222222|#333333");

  // Clicking again with the same colours puts the letter back.
  await act(async () => letter(host, 1)?.click());
  expect(out.value.split(",")[1]).toBe("");
  root.unmount();
});
