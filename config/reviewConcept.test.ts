import { describe, expect, it } from "vitest";
import { cleanIconSvg, conceptIconName } from "./conceptIcon.js";
import { SHADOW_PRESETS, shadowCss } from "./conceptShadow.js";
import { cleanConcept, joinCardText, splitCardText } from "./reviewConcept.js";

describe("card text", () => {
  it("splits the first line into the title and keeps the rest as the body", () => {
    expect(splitCardText("Card title\nLine one\nLine two")).toEqual({
      body: "Line one\nLine two",
      title: "Card title",
    });
  });

  it("reads a single line as a title with no body", () => {
    expect(splitCardText("Only a title")).toEqual({
      body: "",
      title: "Only a title",
    });
  });

  it("round-trips a title and a body", () => {
    const text = joinCardText("Title", "Body\nMore");
    expect(splitCardText(text)).toEqual({ body: "Body\nMore", title: "Title" });
  });

  it("keeps a pasted newline in the title from moving text into the body", () => {
    expect(joinCardText("Two\nlines", "Body")).toBe("Two lines\nBody");
  });
});

describe("card border and shadow", () => {
  it("keeps a valid border color and shadow on a card", () => {
    const [card] = cleanConcept({
      elements: [{ borderColor: "#e8e4dc", kind: "card", shadow: "strong" }],
    }).elements;
    expect(card).toMatchObject({
      borderColor: "#e8e4dc",
      shadow: SHADOW_PRESETS.strong,
    });
  });

  it("drops a bad border color and shadow, and ignores them on other kinds", () => {
    const [card, button] = cleanConcept({
      elements: [
        { borderColor: "red", kind: "card", shadow: "huge" },
        { borderColor: "#ffffff", kind: "button", shadow: "soft" },
      ],
    }).elements;
    expect(card?.borderColor).toBeUndefined();
    expect(card?.shadow).toBeUndefined();
    expect(button?.borderColor).toBeUndefined();
    expect(button?.shadow).toBeUndefined();
  });
});

describe("concept icons", () => {
  it("reads an old Lucide name as its Hugeicons match", () => {
    expect(conceptIconName("heart")).toBe("FavouriteIcon");
    expect(conceptIconName("shopping-bag")).toBe("ShoppingBag01Icon");
  });

  it("keeps a Hugeicons name and rejects anything else", () => {
    expect(conceptIconName("Camera01Icon")).toBe("Camera01Icon");
    expect(conceptIconName("<script>")).toBeNull();
    expect(conceptIconName(42)).toBeNull();
  });

  it("migrates a saved icon and gives an icon element a star by default", () => {
    const [icon, card, broken] = cleanConcept({
      elements: [
        { iconName: "bell", kind: "icon" },
        { iconName: "nope", kind: "card" },
        { iconName: "nope", kind: "icon" },
      ],
    }).elements;
    expect(icon?.iconName).toBe("Notification01Icon");
    expect(card?.iconName).toBeUndefined();
    expect(broken?.iconName).toBe("StarIcon");
  });
});

describe("card shadow and icon settings", () => {
  it("keeps a tuned shadow, clamped to its ranges", () => {
    const [card] = cleanConcept({
      elements: [
        {
          kind: "card",
          shadow: {
            blur: 500,
            color: "#336699",
            opacity: 40,
            spread: 2,
            x: -3,
            y: 9,
          },
        },
      ],
    }).elements;
    expect(card?.shadow).toEqual({
      blur: 128,
      color: "#336699",
      opacity: 40,
      spread: 2,
      x: -3,
      y: 9,
    });
  });

  it("draws no shadow at zero opacity, and a soft one when none is stored", () => {
    expect(shadowCss(SHADOW_PRESETS.none)).toBe("none");
    expect(shadowCss()).toContain("14px");
  });

  it("keeps a card's icon size and color", () => {
    const [card] = cleanConcept({
      elements: [
        {
          iconColor: "#ff0000",
          iconName: "StarIcon",
          iconSize: 200,
          kind: "card",
        },
      ],
    }).elements;
    expect(card).toMatchObject({ iconColor: "#ff0000", iconSize: 96 });
  });
});

describe("saved icon drawings", () => {
  const rocket = [
    ["path", { d: "M4 12h16", stroke: "currentColor", strokeWidth: 1.5 }],
    ["circle", { cx: 12, cy: 12, r: 3 }],
  ];

  it("keeps plain shapes and drawing attributes", () => {
    expect(cleanIconSvg(rocket)).toEqual(rocket);
  });

  it("drops a drawing with any other tag or attribute", () => {
    expect(cleanIconSvg([["script", { d: "x" }]])).toBeUndefined();
    expect(cleanIconSvg([["path", { onload: "alert(1)" }]])).toBeUndefined();
    expect(cleanIconSvg([["path", { href: "javascript:x" }]])).toBeUndefined();
    expect(cleanIconSvg("not a drawing")).toBeUndefined();
  });

  it("saves the drawing with an icon or card, never on its own", () => {
    const [icon, card, button] = cleanConcept({
      elements: [
        { iconName: "Rocket01Icon", iconSvg: rocket, kind: "icon" },
        { iconSvg: rocket, kind: "card" },
        { iconName: "Rocket01Icon", iconSvg: rocket, kind: "button" },
      ],
    }).elements;
    expect(icon?.iconSvg).toEqual(rocket);
    expect(card?.iconSvg).toBeUndefined();
    expect(button?.iconSvg).toBeUndefined();
  });
});

describe("icons on inputs", () => {
  it("lets an input carry an icon with its size and color, and not a button", () => {
    const [input, button] = cleanConcept({
      elements: [
        {
          iconColor: "#667085",
          iconName: "Search01Icon",
          iconSize: 18,
          kind: "input",
        },
        { iconColor: "#667085", iconName: "Search01Icon", kind: "button" },
      ],
    }).elements;
    expect(input).toMatchObject({
      iconColor: "#667085",
      iconName: "Search01Icon",
      iconSize: 18,
    });
    expect(button?.iconName).toBeUndefined();
    expect(button?.iconColor).toBeUndefined();
  });
});

describe("badge and card borders", () => {
  it("keeps a badge's border color and width, and None as transparent", () => {
    const [badge, none, button] = cleanConcept({
      elements: [
        { borderColor: "#c7d7fe", borderWidth: 20, kind: "badge" },
        { borderColor: "transparent", kind: "card" },
        { borderColor: "#c7d7fe", borderWidth: 2, kind: "button" },
      ],
    }).elements;
    expect(badge).toMatchObject({ borderColor: "#c7d7fe", borderWidth: 8 });
    expect(none?.borderColor).toBe("transparent");
    expect(button?.borderColor).toBeUndefined();
    expect(button?.borderWidth).toBeUndefined();
  });
});

describe("checkbox accent and size", () => {
  it("keeps a checkbox's accent and size, clamped, and only on checkboxes", () => {
    const [box, button] = cleanConcept({
      elements: [
        { accentColor: "#ff0000", checkSize: 90, kind: "checkbox" },
        { accentColor: "#ff0000", checkSize: 20, kind: "button" },
      ],
    }).elements;
    expect(box).toMatchObject({ accentColor: "#ff0000", checkSize: 40 });
    expect(button?.accentColor).toBeUndefined();
    expect(button?.checkSize).toBeUndefined();
  });
});
