import { describe, expect, it, vi } from "vitest";

const html = `<!doctype html><html><head><title>Fixture</title><style>
  :root{--brand-ink:#0b1112;--brand-paper:#f0e7d2;--token-6f08dd7e-87b0:#c63b2e;--framer-text-color:#000}
  body{margin:0;font:18px/1.6 Georgia;background:var(--brand-paper);color:var(--brand-ink)}
  header{display:flex;padding:16px 32px;background:#0b1112}
  header a{color:#f0e7d2;font:600 14px Arial}
  h1{font:700 64px/1.05 Arial}
  .btn{display:inline-block;padding:12px 24px;border-radius:4px;background:#c63b2e;color:#f0e7d2;font:700 14px Arial}
</style></head><body>
<header><nav><a aria-label="Home" href="/"><svg viewBox="0 0 40 20" width="80" height="40"><rect width="40" height="20" fill="var(--brand-x, var(--token-6f08dd7e-87b0, #123456))" onclick="alert(1)"/></svg></a><a href="/books">Books</a></nav></header>
<h1 onclick="window.parent.__ran = true">Centrifuge</h1>
<p>AI reveals what organizations actually are, and what they only perform.</p>
<a class="btn" href="/buy">Buy the book</a>
<script>window.parent.__ran = true</script>
</body></html>`;

vi.mock("../services/brandKitService", () => ({
  brandKitsApi: {
    sitePage: vi.fn(async () => ({
      // A linked stylesheet the server fetched, as the frame can't read it.
      css: ".btn{background:var(--brand-accent)} :root{--brand-accent:#c63b2e}",
      html,
      url: "https://unrulychain.com/",
    })),
  },
}));

const { scanSite, withBase } = await import("./scanSite");

describe("scanSite", () => {
  it("puts the page at its own address with scripts off", () => {
    const out = withBase(
      "<html><head><title>x</title></head></html>",
      "https://a.com/"
    );
    expect(out).toContain('<head><base href="https://a.com/">');
    expect(out).toContain("script-src 'none'");
  });

  it("reads a page's design in a hidden frame without running its scripts", async () => {
    const { scan } = await scanSite("unrulychain.com");
    expect(scan.url).toBe("https://unrulychain.com/");
    const primary = scan.components.find((c) => c.name === "button-primary");
    expect(primary?.style.backgroundColor).toBe("#c63b2e");
    expect(primary?.sample).toBe("Buy the book");
    expect(scan.components.map((c) => c.name)).toContain("nav");
    expect(scan.typography.map((t) => t.name)).toEqual(["h1", "body"]);
    expect((window as unknown as { __ran?: boolean }).__ran).toBeUndefined();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("reads the colour theme from CSS variables, leaving builder plumbing out", async () => {
    const { colors } = await scanSite("unrulychain.com");
    const byValue = new Map(colors.map((c) => [c.value, c]));
    expect(byValue.get("#f0e7d2")?.role).toBe("background");
    expect(byValue.get("#0b1112")?.role).toBe("text");
    expect(byValue.has("#c63b2e")).toBe(true);
    expect(colors.some((c) => c.name.startsWith("--framer-"))).toBe(false);
  });

  it("takes the logo from the link home as a clean SVG in its own colours", async () => {
    const { logo } = await scanSite("unrulychain.com");
    expect(logo?.kind).toBe("svg");
    const svg = logo?.kind === "svg" ? logo.svg : "";
    expect(svg).toContain('fill="rgb(198, 59, 46)"');
    expect(svg).not.toContain("onclick");
    expect(svg).not.toContain("var(");
  });
});
