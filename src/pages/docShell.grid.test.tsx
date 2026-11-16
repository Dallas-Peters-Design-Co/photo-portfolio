import "../index.css";
import "./docShell.css";
import { expect, it } from "vitest";
import { page as browser } from "vitest/browser";

it("lines up every split band's words on one grid, whatever its heading", async () => {
  // Wide enough for the side-by-side layout.
  await browser.viewport(1440, 900);
  const page = document.createElement("div");
  page.style.width = "1400px";
  // As the review page draws them: a short heading, and a long one.
  page.innerHTML = ["Findings", "Cognitive load & complexity"]
    .map(
      (title) => `<section class="doc-band doc-band--split">
        <h2 class="doc-band__title">${title}</h2>
        <div class="doc-band__body"><p>Words about it.</p></div>
      </section>`
    )
    .join("");
  document.body.append(page);
  const bodies = [...page.querySelectorAll(".doc-band__body")].map((body) =>
    body.getBoundingClientRect()
  );
  const titles = [...page.querySelectorAll(".doc-band__title")].map((title) =>
    title.getBoundingClientRect()
  );
  // The same column for every band's words, the same width too.
  expect(bodies[1]?.left).toBeCloseTo(bodies[0]?.left ?? 0, 0);
  expect(bodies[1]?.width).toBeCloseTo(bodies[0]?.width ?? 0, 0);
  // The long heading stays in its column, beside its words.
  expect(titles[1]?.right).toBeLessThanOrEqual(bodies[1]?.left ?? 0);
  expect(bodies[1]?.top).toBeCloseTo(titles[1]?.top ?? 0, -1);
  page.remove();
});
