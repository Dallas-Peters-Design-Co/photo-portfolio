import { describe, expect, it } from "vitest";
import type { ReviewScreen } from "../../../config/review.js";
import {
  parseAuditReply,
  placeOnScreens,
  sourcesFromScreens,
} from "./audit.js";
import { cleanMarkup } from "./page.js";
import { isStoredImage, toScreenPoint } from "./tiles.js";

describe("placeOnScreens & parseAuditReply", () => {
  const tiles = [
    { bottom: 0.5, label: "T1", screenId: "home", top: 0 },
    { bottom: 1, label: "T2", screenId: "home", top: 0.5 },
  ];

  it("maps tile-relative coordinates onto the parent screen", () => {
    const audit = placeOnScreens(
      {
        execSummary: "Solid foundation.",
        findings: [
          {
            area: "Navigation",
            detail: "The CTA blends into the hero background.",
            headline: "Make the primary action stand out",
            kind: "recommendation",
            tile: "T2",
            x: 0.4,
            y: 0.5,
          },
          {
            area: "Accessibility",
            detail: "Site-wide focus styles can be unified.",
            headline: "Consistent keyboard focus",
            kind: "issue",
            tile: null,
          },
        ],
      },
      tiles,
      ["home"]
    );

    expect(audit.findings[0]).toMatchObject({
      kind: "recommendation",
      screenId: "home",
      x: 0.4,
      y: 0.75,
    });
    expect(audit.findings[1]?.screenId).toBeNull();
  });

  it("extracts JSON wrapped in markdown fences", () => {
    const reply = '```json\n{"execSummary":"Hello","findings":[]}\n```';
    const audit = parseAuditReply(reply, tiles, ["home"]);
    expect(audit.execSummary).toBe("Hello");
  });
});

describe("cleanMarkup", () => {
  it("strips scripts, styles, comments, and flags empty shells", () => {
    const shell = cleanMarkup(
      '<html><head><style>body{color:red}</style></head><body><div id="root"></div><script>alert(1)</script></body></html>'
    );
    expect(shell.html).not.toContain("<script>");
    expect(shell.html).not.toContain("<style>");
    expect(shell.isShell).toBe(true);
  });
});

describe("tiles helpers", () => {
  it("accepts only HTTPS Vercel Blob URLs as stored screenshots", () => {
    expect(
      isStoredImage("https://abc.public.blob.vercel-storage.com/shot.png")
    ).toBe(true);
    expect(
      isStoredImage("http://abc.public.blob.vercel-storage.com/a.png")
    ).toBe(false);
    expect(isStoredImage("https://evil.example.com/a.png")).toBe(false);
  });

  it("extracts valid tile sources from review screens", () => {
    const screens: ReviewScreen[] = [
      {
        id: "s1",
        image: {
          height: 1800,
          url: "https://store.public.blob.vercel-storage.com/s1.png",
          width: 1440,
        },
        marks: [],
        note: "",
        pins: [],
        sourceUrl: "https://example.com",
        title: "Landing",
        viewport: "desktop",
      },
      {
        id: "s2",
        image: null,
        marks: [],
        note: "",
        pins: [],
        sourceUrl: "",
        title: "Empty",
        viewport: "mobile",
      },
    ];
    expect(sourcesFromScreens(screens)).toEqual([
      {
        id: "s1",
        title: "Landing",
        url: "https://store.public.blob.vercel-storage.com/s1.png",
        viewport: "desktop",
      },
    ]);
    const point = toScreenPoint({ bottom: 0.8, top: 0.4 }, 0.25, 0.5);
    expect(point.x).toBe(0.25);
    expect(point.y).toBeCloseTo(0.6);
  });
});
