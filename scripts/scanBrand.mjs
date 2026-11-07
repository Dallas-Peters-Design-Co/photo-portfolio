/**
 * A rendered page's colour theme and logo, read the way scanPage.mjs reads
 * its components: plain browser JavaScript run against `win` (the admin's
 * sandboxed frame, src/lib/scanSite.ts), each function carrying its helpers
 * inside so it can also be handed to Playwright's page.evaluate().
 */

/**
 * The page's colour variables: every custom property whose value is a
 * colour, from the page's own CSS (its <style> blocks, any stylesheet the
 * browser lets this read, and `extraCss`, the linked stylesheets the server
 * fetched, since a sandboxed frame can't read those itself). Values are the
 * browser's own, so a variable made of other variables resolves; each comes
 * back as #rrggbb with how often the page uses it and what for.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: serialised into the page by page.evaluate, so it has to carry its helpers inside
export function scanColors(win = window, extraCss = "") {
  const doc = win.document;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const supports = (v) => {
    try {
      return win.CSS.supports("color", v);
    } catch {
      return false;
    }
  };
  const hex = (color) => {
    if (!(color && ctx && supports(color))) {
      return;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a < 128) {
      return;
    }
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };

  const texts = [...doc.querySelectorAll("style")].map((s) => s.textContent);
  for (const sheet of [...doc.styleSheets]) {
    try {
      texts.push([...sheet.cssRules].map((r) => r.cssText).join("\n"));
    } catch {
      // Another origin's sheet: the server sends those as extraCss.
    }
  }
  texts.push(extraCss);
  // Builders like Framer set most colours in style attributes on elements.
  for (const el of [...doc.querySelectorAll("[style*='var(']")].slice(
    0,
    8000
  )) {
    texts.push(`x{${el.getAttribute("style")}}`);
  }
  const cssText = texts.join("\n").slice(0, 6_000_000);
  // A builder's or framework's own plumbing, not the brand's theme.
  const plumbing =
    // biome-ignore lint/performance/useTopLevelRegex: serialised into the page by page.evaluate, so it has to be inside
    /^--(framer|tw|chakra|mantine|radix|swiper|bs-btn|toastify)-/;

  const defined = new Map();
  for (const m of cssText.matchAll(/(--[\w-]{1,80})\s*:\s*([^;}]{1,200})/g)) {
    if (!defined.has(m[1])) {
      defined.set(m[1], m[2].trim());
    }
  }
  // What each variable is used for: the property that reads it.
  const uses = new Map();
  for (const m of cssText.matchAll(
    /([a-z-]{1,40})\s*:\s*[^;}]{0,200}?var\(\s*(--[\w-]{1,80})/g
  )) {
    const [, prop, variable] = m;
    let role = "accent";
    if (prop === "color" || prop.endsWith("text-color")) {
      role = "text";
    } else if (prop.startsWith("background")) {
      role = "background";
    } else if (prop.startsWith("border") || prop.startsWith("outline")) {
      role = "border";
    }
    const was = uses.get(variable) ?? { count: 0, roles: {} };
    was.count += 1;
    was.roles[role] = (was.roles[role] ?? 0) + 1;
    uses.set(variable, was);
  }

  const root = win.getComputedStyle(doc.documentElement);
  const byValue = new Map();
  for (const [name, raw] of defined) {
    if (plumbing.test(name)) {
      continue;
    }
    const resolved = root.getPropertyValue(name).trim();
    const value =
      hex(resolved) ?? (raw.includes("var(") ? undefined : hex(raw));
    if (!value) {
      continue;
    }
    const used = uses.get(name) ?? { count: 0, roles: {} };
    const role =
      Object.entries(used.roles).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const was = byValue.get(value);
    if (!was || used.count > was.uses) {
      byValue.set(value, {
        name,
        role,
        uses: used.count + (was?.uses ?? 0),
        value,
      });
    } else {
      was.uses += used.count;
    }
  }
  const all = [...byValue.values()].sort((a, b) => b.uses - a.uses);
  const used = all.filter((c) => c.uses > 0);
  return (used.length >= 4 ? used : all).slice(0, 24);
}

/**
 * The site's logo: the mark in the link home, or anything labelled a logo,
 * near the top of the page. An <img> comes back as its address; an inline
 * <svg> as markup with the colours the page gave it written in (they often
 * come from the page's CSS, which a copy on its own wouldn't have), any
 * <use> it borrows from filled in, and nothing that runs.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: serialised into the page by page.evaluate, so it has to carry its helpers inside
export function scanLogo(win = window) {
  const doc = win.document;
  const home = (a) => {
    const href = a.getAttribute("href") ?? "";
    if (["/", "./", "", "#"].includes(href.trim())) {
      return true;
    }
    try {
      const u = new URL(a.href, doc.baseURI);
      return u.origin === new URL(doc.baseURI).origin && u.pathname === "/";
    } catch {
      return false;
    }
  };
  const said = (el) =>
    `${el.getAttribute("class") ?? ""} ${el.id ?? ""} ${el.getAttribute("alt") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`.toLowerCase();
  const marks = (el) =>
    el.matches("img, svg") ? [el] : [...el.querySelectorAll("img, svg")];

  const scored = [];
  const seen = new Set();
  const consider = (mark, bonus) => {
    if (seen.has(mark)) {
      return;
    }
    seen.add(mark);
    const rect = mark.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 8 || rect.top > 400) {
      return;
    }
    const tooBig = rect.width > 600 || rect.height > 240;
    let score = bonus + (tooBig ? -4 : 0);
    if (mark.closest("header, nav, [role=banner]")) {
      score += 3;
    }
    // biome-ignore lint/performance/useTopLevelRegex: serialised into the page by page.evaluate, so it has to be inside
    if (/logo|brand|wordmark/.test(said(mark))) {
      score += 3;
    }
    if (mark.closest("a") && home(mark.closest("a"))) {
      score += 4;
    }
    score += Math.max(0, 2 - rect.left / 400);
    scored.push({ mark, score });
  };
  for (const a of doc.querySelectorAll("a")) {
    if (home(a)) {
      for (const mark of marks(a)) {
        consider(mark, 2);
      }
    }
  }
  for (const el of doc.querySelectorAll(
    "[class*=logo i], [id*=logo i], [alt*=logo i], [aria-label*=logo i]"
  )) {
    for (const mark of marks(el)) {
      consider(mark, 1);
    }
  }
  const [best] = scored.sort((a, b) => b.score - a.score);
  if (!best || best.score < 4) {
    return null;
  }
  const { mark: chosen } = best;
  const label = (chosen.getAttribute("alt") || doc.title || "Logo").slice(
    0,
    80
  );
  if (chosen.tagName.toLowerCase() === "img") {
    const src = chosen.currentSrc || chosen.src;
    return src ? { alt: label, kind: "img", src } : null;
  }

  // An inline SVG: borrowed <use> parts filled in, page colours written in.
  const copy = chosen.cloneNode(true);
  const originals = [chosen, ...chosen.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  originals.forEach((el, i) => {
    const target = copies[i];
    if (!target) {
      return;
    }
    const cs = win.getComputedStyle(el);
    for (const prop of [
      "fill",
      "stroke",
      "opacity",
      "fill-opacity",
      "stroke-width",
    ]) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== "normal") {
        target.setAttribute(prop, v);
      }
    }
  });
  for (const use of [...copy.querySelectorAll("use")]) {
    const ref = (
      use.getAttribute("href") ||
      use.getAttribute("xlink:href") ||
      ""
    ).trim();
    const source = ref.startsWith("#")
      ? doc.getElementById(ref.slice(1))
      : null;
    if (!source) {
      use.remove();
      continue;
    }
    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    const inner =
      source.tagName.toLowerCase() === "symbol"
        ? [...source.childNodes]
        : [source];
    for (const node of inner) {
      g.append(node.cloneNode(true));
    }
    for (const attr of ["fill", "stroke", "transform", "opacity"]) {
      const v = use.getAttribute(attr);
      if (v) {
        g.setAttribute(attr, v);
      }
    }
    use.replaceWith(g);
  }
  // Colours that come from the page's variables (fill="var(--a, var(--b,
  // blue))"), resolved against the site's theme rather than one spot's
  // override, so the chosen keeps its own colours as a file.
  const rootCs = win.getComputedStyle(doc.documentElement);
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a small bracket-matching parser, clearer in one piece
  const resolveVars = (value, depth) => {
    const at = value.indexOf("var(");
    if (at < 0 || depth > 8) {
      return value;
    }
    let level = 0;
    let comma = -1;
    let end = -1;
    for (let i = at + 4; i < value.length; i += 1) {
      const ch = value[i];
      if (ch === "(") {
        level += 1;
      } else if (ch === ")") {
        if (level === 0) {
          end = i;
          break;
        }
        level -= 1;
      } else if (ch === "," && level === 0 && comma < 0) {
        comma = i;
      }
    }
    if (end < 0) {
      return value;
    }
    const name = value.slice(at + 4, comma < 0 ? end : comma).trim();
    const fallback = comma < 0 ? "" : value.slice(comma + 1, end).trim();
    const own = rootCs.getPropertyValue(name).trim();
    const swapped = own || resolveVars(fallback, depth + 1);
    return resolveVars(
      value.slice(0, at) + swapped + value.slice(end + 1),
      depth + 1
    );
  };
  for (const el of [copy, ...copy.querySelectorAll("*")]) {
    for (const attr of ["fill", "stroke", "stop-color", "color"]) {
      const v = el.getAttribute(attr);
      if (v?.includes("var(")) {
        el.setAttribute(attr, resolveVars(v, 0) || "currentColor");
      }
    }
  }
  for (const el of [...copy.querySelectorAll("script, foreignObject, style")]) {
    el.remove();
  }
  for (const el of [copy, ...copy.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const v = attr.value.trim().toLowerCase();
      if (
        attr.name.startsWith("on") ||
        attr.name === "class" ||
        attr.name === "style" ||
        // biome-ignore lint/performance/useTopLevelRegex: serialised into the page by page.evaluate, so it has to be inside
        (/href$/.test(attr.name) &&
          !v.startsWith("#") &&
          !v.startsWith("data:image/"))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
  const rect = chosen.getBoundingClientRect();
  if (!copy.getAttribute("viewBox")) {
    copy.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  }
  copy.setAttribute("width", String(Math.round(rect.width)));
  copy.setAttribute("height", String(Math.round(rect.height)));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svg = copy.outerHTML;
  return svg.length < 400_000 ? { alt: label, kind: "svg", svg } : null;
}
