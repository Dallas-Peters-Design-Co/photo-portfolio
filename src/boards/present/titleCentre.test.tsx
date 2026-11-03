import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { PresentDeck } from "./PresentDeck";

it("centres the title card's type in the window", async () => {
  await page.viewport(1440, 900);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <PresentDeck
        onExit={() => undefined}
        slides={[
          {
            kind: "title",
            subtitle: "Dallas Peters Design",
            title: "RoleModel 2027 Vision Posters",
          },
        ]}
      />
    )
  );
  await new Promise((r) => setTimeout(r, 700));
  const middle = window.innerWidth / 2;
  for (const el of host.querySelectorAll(
    ".present__title, .present__subtitle"
  )) {
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const line of range.getClientRects()) {
      // Each line centred to within a few pixels.
      expect(Math.abs(line.left + line.width / 2 - middle)).toBeLessThan(8);
    }
  }
  act(() => root.unmount());
  host.remove();
});
