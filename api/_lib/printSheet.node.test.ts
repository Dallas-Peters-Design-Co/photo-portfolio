import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { setPrintBoxes, sheetSize, sheetSpecFrom } from "./printSheet.js";

describe("print sheet", () => {
  it("takes a sane sheet and refuses the rest", () => {
    expect(
      sheetSpecFrom({
        bleedIn: 0.125,
        heightIn: 11,
        marksIn: 0.25,
        widthIn: 8.5,
      })
    ).toEqual({ bleedIn: 0.125, heightIn: 11, marksIn: 0.25, widthIn: 8.5 });
    expect(sheetSpecFrom({ heightIn: 11, widthIn: 8.5 })?.bleedIn).toBe(0);
    expect(sheetSpecFrom({ heightIn: 11, widthIn: 900 })).toBeNull();
    expect(sheetSpecFrom({ heightIn: "11", widthIn: 8.5 })).toBeNull();
  });

  it("marks the trim and bleed on the printed page", async () => {
    const spec = { bleedIn: 0.125, heightIn: 11, marksIn: 0.25, widthIn: 8.5 };
    const size = sheetSize(spec);
    expect(size).toEqual({ heightIn: 11.75, widthIn: 9.25 });
    const doc = await PDFDocument.create();
    doc.addPage([size.widthIn * 72, size.heightIn * 72]);
    const out = await PDFDocument.load(
      await setPrintBoxes(await doc.save(), spec)
    );
    const [page] = out.getPages();
    expect(page?.getTrimBox()).toEqual({
      height: 792,
      width: 612,
      x: 27,
      y: 27,
    });
    expect(page?.getBleedBox()).toEqual({
      height: 810,
      width: 630,
      x: 18,
      y: 18,
    });
  });
});
