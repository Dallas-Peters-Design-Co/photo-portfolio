import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { outlinePdf } from "./outlinePdf";

it.each([false, true])(
  "outlines print text and preserves the press boxes (CMYK %s)",
  async (cmyk) => {
    const source = await PDFDocument.create();
    const page = source.addPage([288, 216]);
    page.setTrimBox(18, 18, 252, 180);
    page.setBleedBox(9, 9, 270, 198);
    const face = await source.embedFont(StandardFonts.Helvetica);
    page.drawText("Frame proof", { font: face, x: 24, y: 64 });
    const pdf = await outlinePdf(
      new Blob([new Uint8Array(await source.save())], {
        type: "application/pdf",
      }),
      cmyk
    );
    const output = await PDFDocument.load(await pdf.arrayBuffer());
    const sheet = output.getPage(0);
    expect(sheet.getTrimBox()).toEqual(page.getTrimBox());
    expect(sheet.getBleedBox()).toEqual(page.getBleedBox());
    expect(sheet.node.Resources()?.has(PDFName.of("Font"))).toBe(false);
    expect(sheet.node.Contents()).toBeDefined();
  }
);
