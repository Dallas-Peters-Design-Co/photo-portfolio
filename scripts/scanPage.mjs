/**
 * Reads a rendered page's design: run inside the page with page.evaluate().
 *
 * Plain browser JavaScript with nothing from outside its own body, because it
 * is serialised into the page. Colours come back as #rrggbb (via a 1×1 canvas,
 * so oklch() and named colours convert too), sizes as computed pixels.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: serialised into the page by page.evaluate, so it has to carry its helpers inside
export function scanPage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const hex = (color) => {
    if (!color || color === "transparent" || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a < 13) {
      return;
    }
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };

  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return false;
    }
    const cs = getComputedStyle(el);
    return (
      cs.visibility !== "hidden" &&
      cs.display !== "none" &&
      Number(cs.opacity) > 0.1
    );
  };

  const px = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const dim = (n) => `${Math.round(n * 100) / 100}px`;

  const padding = (cs) => {
    const [t, r, b, l] = [
      cs.paddingTop,
      cs.paddingRight,
      cs.paddingBottom,
      cs.paddingLeft,
    ].map(px);
    if (t + r + b + l === 0) {
      return;
    }
    return t === b && r === l
      ? `${dim(t)} ${dim(r)}`
      : `${dim(t)} ${dim(r)} ${dim(b)} ${dim(l)}`;
  };

  const text = (el) =>
    (el.innerText || el.value || el.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

  const typeOf = (cs) => {
    const size = px(cs.fontSize);
    const lh = px(cs.lineHeight);
    const ls = px(cs.letterSpacing);
    return {
      fontFamily: cs.fontFamily,
      fontSize: dim(size),
      fontWeight: cs.fontWeight,
      letterSpacing:
        cs.letterSpacing === "normal" || ls === 0
          ? undefined
          : `${Math.round((ls / size) * 1000) / 1000}em`,
      lineHeight:
        lh && size ? String(Math.round((lh / size) * 100) / 100) : undefined,
      textTransform: cs.textTransform === "none" ? undefined : cs.textTransform,
    };
  };

  const styleOf = (el, withSize) => {
    const cs = getComputedStyle(el);
    const radius = px(cs.borderTopLeftRadius);
    const bw = px(cs.borderTopWidth);
    const rect = el.getBoundingClientRect();
    return {
      ...typeOf(cs),
      backgroundColor: hex(cs.backgroundColor),
      border:
        bw > 0 && cs.borderTopStyle !== "none" && hex(cs.borderTopColor)
          ? `${dim(bw)} ${cs.borderTopStyle} ${hex(cs.borderTopColor)}`
          : undefined,
      height: withSize ? dim(Math.round(rect.height)) : undefined,
      padding: padding(cs),
      rounded: radius > 0 ? dim(radius) : undefined,
      textColor: hex(cs.color),
    };
  };

  const signature = (s) =>
    [
      s.backgroundColor,
      s.textColor,
      s.rounded,
      s.border,
      s.fontWeight,
      s.fontSize,
      s.textTransform,
    ].join("|");

  /** The most common looks among the elements, most common first. */
  const groups = (els, withSize) => {
    const map = new Map();
    for (const el of els) {
      const style = styleOf(el, withSize);
      const key = signature(style);
      const hit = map.get(key);
      if (hit) {
        hit.count += 1;
      } else {
        map.set(key, { count: 1, sample: text(el), style });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  };

  const pick = (selector, ok = () => true) =>
    [...document.querySelectorAll(selector)].filter(
      (el) => visible(el) && ok(el)
    );

  const saturated = (hexValue) => {
    if (!hexValue) {
      return false;
    }
    const c = [1, 3, 5].map((i) =>
      Number.parseInt(hexValue.slice(i, i + 2), 16)
    );
    return (Math.max(...c) - Math.min(...c)) / 255 > 0.18;
  };

  const components = [];
  const add = (name, group) => {
    if (group) {
      components.push({
        count: group.count,
        name,
        sample: group.sample,
        style: group.style,
      });
    }
  };

  // Buttons: filled in a brand colour first, then filled, then outlined.
  const buttonEls = pick(
    'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i]',
    (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.height >= 24 &&
        r.height <= 96 &&
        r.width <= 520 &&
        text(el).length > 0
      );
    }
  );
  const buttons = groups(buttonEls, true);
  const filled = buttons.filter((b) => b.style.backgroundColor);
  const primary =
    filled.find((b) => saturated(b.style.backgroundColor)) ?? filled[0];
  const rest = buttons.filter((b) => b !== primary);
  add("button-primary", primary);
  add(
    "button-secondary",
    rest.find((b) => b.style.backgroundColor || b.style.border)
  );
  add(
    "button-tertiary",
    rest.find(
      (b) => b !== rest.find((x) => x.style.backgroundColor || x.style.border)
    )
  );

  const buttonSet = new Set(buttonEls);
  const links = groups(
    pick(
      "p a, li a, main a, article a",
      (el) => !buttonSet.has(el) && text(el).length > 1
    ),
    false
  );
  add("link", links[0]);

  add(
    "input",
    groups(
      pick(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, select'
      ),
      true
    )[0]
  );

  const cards = groups(
    pick('article, [class*="card" i]', (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const framed =
        hex(cs.backgroundColor) ||
        px(cs.borderTopWidth) > 0 ||
        (cs.boxShadow && cs.boxShadow !== "none");
      return framed && r.width >= 160 && r.width <= 760 && r.height >= 100;
    }),
    false
  );
  add("card", cards[0]);

  add(
    "badge",
    groups(
      pick(
        '[class*="badge" i], [class*="chip" i], [class*="pill" i], [class*="tag" i]',
        (el) => {
          const r = el.getBoundingClientRect();
          return r.height <= 40 && r.width <= 240 && text(el).length > 0;
        }
      ),
      true
    )[0]
  );

  const [nav] = pick(
    "header nav, nav, header",
    (el) => el.getBoundingClientRect().width >= innerWidth * 0.6
  );
  if (nav) {
    const navLink = [...nav.querySelectorAll("a")].find(visible);
    const navStyle = styleOf(nav, true);
    const linkStyle = navLink ? typeOf(getComputedStyle(navLink)) : {};
    components.push({
      count: 1,
      name: "nav",
      sample: navLink ? text(navLink) : "",
      style: {
        ...navStyle,
        ...linkStyle,
        textColor: navLink
          ? hex(getComputedStyle(navLink).color)
          : navStyle.textColor,
      },
    });
  }
  const [footer] = pick("footer");
  if (footer) {
    components.push({
      count: 1,
      name: "footer",
      sample: "",
      style: styleOf(footer, false),
    });
  }

  // The type scale: the first of each heading on screen, and for body copy
  // the paragraph style the page uses most (not the big intro).
  const typography = [];
  for (const [name, selector] of [
    ["h1", "h1"],
    ["h2", "h2"],
    ["h3", "h3"],
    ["h4", "h4"],
    ["small", "small, figcaption, [class*='caption' i], [class*='meta' i]"],
  ]) {
    const [el] = pick(selector);
    if (el) {
      typography.push({ name, style: typeOf(getComputedStyle(el)) });
    }
  }
  const bodyCounts = new Map();
  for (const el of pick("p", (p) => text(p).length >= 40)) {
    const style = typeOf(getComputedStyle(el));
    const key = JSON.stringify(style);
    const hit = bodyCounts.get(key);
    bodyCounts.set(key, { n: (hit?.n ?? 0) + text(el).length, style });
  }
  const [body] = [...bodyCounts.values()].sort((a, b) => b.n - a.n);
  if (body) {
    typography.splice(4, 0, { name: "body", style: body.style });
  }

  // Radii and spacing: the values the page actually repeats.
  const radii = new Map();
  const spaces = new Map();
  const bump = (map, v) => map.set(v, (map.get(v) ?? 0) + 1);
  for (const el of [...document.querySelectorAll("body *")].slice(0, 4000)) {
    if (!visible(el)) {
      continue;
    }
    const cs = getComputedStyle(el);
    const r = px(cs.borderTopLeftRadius);
    if (r > 0) {
      bump(radii, r >= 100 ? 9999 : Math.round(r));
    }
    for (const v of [
      cs.paddingTop,
      cs.paddingLeft,
      cs.rowGap,
      cs.columnGap,
      cs.marginBottom,
    ]) {
      const n = Math.round(px(v));
      if (n >= 2 && n <= 160) {
        bump(spaces, n);
      }
    }
  }
  const top = (map, min, n) =>
    [...map.entries()]
      .filter(([, c]) => c >= min)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([v]) => `${v}px`);

  return {
    components: components.map((c) => ({
      ...c,
      style: Object.fromEntries(
        Object.entries(c.style).filter(([, v]) => v !== undefined)
      ),
    })),
    rounded: top(radii, 1, 5),
    spacing: top(spaces, 4, 8),
    title: document.title,
    typography: typography.map((t) => ({
      ...t,
      style: Object.fromEntries(
        Object.entries(t.style).filter(([, v]) => v !== undefined)
      ),
    })),
  };
}
