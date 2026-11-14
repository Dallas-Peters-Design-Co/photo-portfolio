import "../index.css";
import "./ReviewPage.css";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";

/** Beside its notes, a review's screenshot stays in view as the notes scroll. */

const notes = Array.from(
  { length: 40 },
  (_, i) => `<p style="height:120px">Note ${i + 1}</p>`
).join("");

afterEach(() => {
  document.body.innerHTML = "";
  window.scrollTo(0, 0);
});

it("holds a tall screenshot in a pane beside its notes", async () => {
  await page.viewport(1400, 800);
  document.body.innerHTML = `
    <div class="review-page__screen">
      <figure class="review-page__figure" id="f">
        <img class="review-page__image" style="height:6000px" alt="">
      </figure>
      <div>${notes}</div>
    </div>`;
  const figure = document.getElementById("f") as HTMLElement;
  expect(getComputedStyle(figure).position).toBe("sticky");
  expect(figure.getBoundingClientRect().height).toBeLessThanOrEqual(800);
  window.scrollTo(0, 2000);
  await new Promise((r) => requestAnimationFrame(r));
  const { top } = figure.getBoundingClientRect();
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(40);
});

it("prints the whole picture rather than a scrolling pane", async () => {
  await page.viewport(1400, 800);
  document.body.innerHTML = `
    <div class="review-page__screen">
      <figure class="review-page__figure" id="f"><img alt=""></figure>
    </div>`;
  const sheet = [...document.styleSheets].flatMap((s) => [...s.cssRules]);
  const print = sheet.find(
    (r) => r instanceof CSSMediaRule && r.conditionText === "print"
  ) as CSSMediaRule | undefined;
  const reset = [...(print?.cssRules ?? [])].find(
    (r) =>
      r instanceof CSSStyleRule &&
      r.selectorText === ".review-page__screen .review-page__figure"
  ) as CSSStyleRule | undefined;
  expect(reset?.style.position).toBe("relative");
  expect(reset?.style.maxHeight).toBe("none");
});
