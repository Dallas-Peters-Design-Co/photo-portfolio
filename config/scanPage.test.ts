import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error a plain .mjs script, run inside the page by Playwright
import { scanPage } from "../scripts/scanPage.mjs";

const HEX = /^#[0-9a-f]{6}$/;

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelector("style[data-scan]")?.remove();
});

describe("scanPage", () => {
  it("reads components, type and scales from what the browser draws", () => {
    const style = document.createElement("style");
    style.dataset.scan = "";
    style.textContent = `
      header{display:flex;padding:16px 32px;background:#0b1112}
      header a{color:#f0e7d2;font:600 14px Arial;text-transform:uppercase}
      h1{font:700 64px/1.05 Arial}
      p{font:400 18px/1.6 Georgia;margin:0 0 16px}
      .btn{display:inline-block;padding:12px 24px;border-radius:4px;font:700 14px Arial}
      .btn-primary{background:oklch(0.55 0.17 30);color:#f0e7d2}
      .btn-ghost{border:2px solid #0b1112;color:#0b1112}
      input{padding:10px;border:1px solid #928b7f;border-radius:4px}`;
    document.head.append(style);
    document.body.innerHTML = `
      <header><nav><a href="#">Books</a></nav></header>
      <h1>Centrifuge</h1>
      <p>AI reveals what organizations actually are, and what they only perform.</p>
      <a class="btn btn-primary" href="#">Buy the book</a>
      <a class="btn btn-primary" href="#">Read free</a>
      <a class="btn btn-ghost" href="#">Newsletter</a>
      <input type="email"><input type="range">`;
    const scan = scanPage();
    const byName = Object.fromEntries(
      scan.components.map((c: { name: string }) => [c.name, c])
    );
    expect(byName["button-primary"].count).toBe(2);
    expect(byName["button-primary"].style.backgroundColor).toMatch(HEX);
    expect(byName["button-secondary"].style.border).toBe("2px solid #0b1112");
    expect(byName.input.style.border).toBe("1px solid #928b7f");
    expect(byName.nav.style.backgroundColor).toBe("#0b1112");
    expect(scan.typography.map((t: { name: string }) => t.name)).toEqual([
      "h1",
      "body",
    ]);
    expect(scan.rounded).toContain("4px");
  });
});
