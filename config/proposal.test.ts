import { describe, expect, it } from "vitest";
import {
  type EditorDoc,
  isRichTextEmpty,
  sanitizeProposalDoc,
  trimEditorDoc,
} from "./proposal";

/**
 * Blank paragraphs at the edges of an editor doc. The editor leaves one
 * after the last line as a matter of course, and it rendered on the page
 * as an empty paragraph with a full margin under every section.
 */

const p = (text?: string): unknown =>
  text
    ? { content: [{ text, type: "text" }], type: "paragraph" }
    : { type: "paragraph" };

const doc = (...content: unknown[]): EditorDoc => ({ content, type: "doc" });

describe("trimEditorDoc", () => {
  it("drops blank paragraphs at the start and the end", () => {
    const trimmed = trimEditorDoc(doc(p(), p("One"), p("Two"), p(), p()));
    expect(trimmed.content).toEqual([p("One"), p("Two")]);
  });

  it("keeps a blank paragraph between two real ones", () => {
    const trimmed = trimEditorDoc(doc(p("One"), p(), p("Two")));
    expect(trimmed.content).toHaveLength(3);
  });

  it("empties a doc that was only blanks, and leaves a clean doc alone", () => {
    expect(trimEditorDoc(doc(p(), p())).content).toEqual([]);
    const clean = doc(p("One"));
    expect(trimEditorDoc(clean)).toBe(clean);
  });

  it("treats a paragraph with an empty content array as blank", () => {
    const trimmed = trimEditorDoc(
      doc(p("One"), { content: [], type: "paragraph" })
    );
    expect(trimmed.content).toEqual([p("One")]);
  });

  it("is applied to every rich field a proposal saves", () => {
    const saved = sanitizeProposalDoc({
      closing: doc(p("Bye"), p()),
      intro: doc(p(), p("Hi")),
      sections: [{ body: doc(p("Body"), p()), heading: "H", id: "s" }],
      summary: doc(p()),
    });
    expect((saved.intro as EditorDoc).content).toEqual([p("Hi")]);
    expect((saved.closing as EditorDoc).content).toEqual([p("Bye")]);
    const [section] = saved.sections;
    expect((section?.body as EditorDoc).content).toEqual([p("Body")]);
    expect(isRichTextEmpty(saved.summary)).toBe(true);
  });
});
