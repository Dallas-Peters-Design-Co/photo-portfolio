import { describe, expect, it } from "vitest";
import {
  AUTHOR_FACE,
  COVER_HEIGHT,
  COVER_WIDTH,
  coverLayout,
  type CoverWords,
  TITLE_FACE,
  wordsFromText,
} from "./coverLayout";

/**
 * The measurer a browser would supply, faked.
 *
 * Half an em per character is not any real font, and it does not need to be:
 * what these tests check is that the arithmetic around the measurement is
 * right — that a longer title gets a smaller size, that tracking is paid for
 * out of the column, that the cap holds. A real font would make the numbers
 * prettier and the assertions no stronger.
 */
const measure = (text: string) => text.length * 0.5;

const WORDS: CoverWords = {
  author: "Mitch Kelly",
  subtitle: "Inside the Emerging AI Organization",
  title: "Centrifuge",
};

const COLORS = { accent: "#fa7c62", band: "#293341", ink: "#efe6d2" };

const run = (layout: ReturnType<typeof coverLayout>, role: string) =>
  layout.runs.find((r) => r.role === role);

describe("coverLayout", () => {
  it("lays out at trim size regardless of what it will be drawn into", () => {
    const layout = coverLayout("poster", WORDS, COLORS, measure);
    expect(layout.width).toBe(COVER_WIDTH);
    expect(layout.height).toBe(COVER_HEIGHT);
  });

  it("gives Poster a band and Horizon none", () => {
    expect(coverLayout("poster", WORDS, COLORS, measure).band).toEqual({
      fill: "#293341",
      height: 482,
    });
    expect(coverLayout("horizon", WORDS, COLORS, measure).band).toBeNull();
  });

  it("sets the title in Vinyl and the byline in Rift", () => {
    const layout = coverLayout("poster", WORDS, COLORS, measure);
    expect(run(layout, "title")?.face).toBe(TITLE_FACE);
    expect(run(layout, "author")?.face).toBe(AUTHOR_FACE);
  });

  it("upper-cases the title and the byline but leaves the subtitle alone", () => {
    const layout = coverLayout("poster", WORDS, COLORS, measure);
    expect(run(layout, "title")?.text).toBe("CENTRIFUGE");
    expect(run(layout, "author")?.text).toBe("MITCH KELLY");
    expect(run(layout, "subtitle")?.text).toBe(
      "Inside the Emerging AI Organization"
    );
  });

  it("shrinks a longer title so it still fits the column", () => {
    const short = coverLayout("poster", { ...WORDS, title: "Drift" }, COLORS, measure);
    const long = coverLayout(
      "poster",
      { ...WORDS, title: "The Great Equalizer" },
      COLORS,
      measure
    );
    const shortSize = run(short, "title")?.size ?? 0;
    const longSize = run(long, "title")?.size ?? 0;
    expect(longSize).toBeLessThan(shortSize);
  });

  it("caps the size so a one-word title is not a billboard", () => {
    const layout = coverLayout("poster", { ...WORDS, title: "I" }, COLORS, measure);
    expect(run(layout, "title")?.size).toBe(560);
  });

  it("sets the Poster byline on a plate, right-aligned, and Horizon's without", () => {
    const poster = coverLayout("poster", WORDS, COLORS, measure);
    expect(poster.plate).toEqual({
      fill: "#293341",
      height: 167,
      width: 672,
      x: 1043,
      y: 2418,
    });
    const author = run(poster, "author");
    expect(author?.align).toBe("right");
    expect((author?.x ?? 0) + (author?.width ?? 0)).toBe(1628);
    expect(coverLayout("horizon", WORDS, COLORS, measure).plate).toBeNull();
  });

  it("drops the plate when there is no byline to sit on it", () => {
    expect(
      coverLayout("poster", { ...WORDS, author: "" }, COLORS, measure).plate
    ).toBeNull();
  });

  it("pays for tracking out of the column, not past its edge", () => {
    // Horizon tracks its title; the fitted size must account for the gaps or
    // the last glyph lands outside the live area.
    const layout = coverLayout("horizon", WORDS, COLORS, measure);
    const title = run(layout, "title");
    if (!title) {
      throw new Error("no title run");
    }
    const glyphs = title.text.length;
    const drawn =
      measure(title.text) * title.size + title.tracking * (glyphs - 1);
    expect(drawn).toBeLessThanOrEqual(title.width + 0.001);
  });

  it("keeps the Poster subtitle in the accent and steps the Horizon one back", () => {
    expect(run(coverLayout("poster", WORDS, COLORS, measure), "subtitle")).toMatchObject(
      { fill: "#fa7c62", opacity: 1 }
    );
    expect(run(coverLayout("horizon", WORDS, COLORS, measure), "subtitle")).toMatchObject(
      { fill: "#efe6d2", opacity: 0.85 }
    );
  });

  it("omits a run rather than drawing an empty one", () => {
    const layout = coverLayout(
      "poster",
      { author: "", subtitle: "   ", title: "Centrifuge" },
      COLORS,
      measure
    );
    expect(layout.runs.map((r) => r.role)).toEqual(["title"]);
  });

  it("falls back to the cap when the measurer says nothing", () => {
    const layout = coverLayout("poster", WORDS, COLORS, () => 0);
    expect(run(layout, "title")?.size).toBe(560);
  });
});

describe("wordsFromText", () => {
  it("reads JSON", () => {
    expect(
      wordsFromText('{"title":"Citizen Scientist","author":"Mitch Kelly"}')
    ).toEqual({ author: "Mitch Kelly", title: "Citizen Scientist" });
  });

  it("reads three plain lines in order", () => {
    expect(wordsFromText("Citizen Scientist\nHow it happened\nMitch Kelly")).toEqual({
      author: "Mitch Kelly",
      subtitle: "How it happened",
      title: "Citizen Scientist",
    });
  });

  it("reads a note that only starts with a brace as lines rather than refusing it", () => {
    expect(wordsFromText("{not json after all")).toEqual({
      title: "{not json after all",
    });
  });

  it("gives nothing back for nothing, so the node's own settings stand", () => {
    expect(wordsFromText(null)).toEqual({});
    expect(wordsFromText("   ")).toEqual({});
  });
});
