import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { type BrandKitDoc, sanitizeKitDoc } from "../../../config/brandKit.js";
import { TypefaceEditor } from "./BrandFontsEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let saved: BrandKitDoc | null = null;

function Harness() {
  const [doc, setDoc] = useState(() => sanitizeKitDoc({}));
  return (
    <TypefaceEditor
      doc={doc}
      onChange={(next) => {
        // As the server keeps it.
        saved = sanitizeKitDoc(next);
        setDoc(next);
      }}
    />
  );
}

it("adds an app font such as Exposure to a brand kit", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Harness />));
  const open = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "App fonts"
  ) as HTMLButtonElement;
  await userEvent.click(open);
  const exposure = [
    ...host.querySelectorAll<HTMLButtonElement>(".brand-fonts__result"),
  ].find((b) => b.textContent?.startsWith("Exposure")) as HTMLButtonElement;
  await userEvent.click(exposure);
  // Kept after the server's cleaning, with a ref the rest of the app loads.
  expect(saved?.typefaces).toEqual([
    expect.objectContaining({ name: "Exposure", ref: "p:exposure" }),
  ]);
  expect(host.textContent).toContain("App font");
  act(() => root.unmount());
  host.remove();
});
