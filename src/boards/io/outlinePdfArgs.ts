/** Outline the final, shaped glyphs. CMYK conversion shares the same pass. */
export const outlinePdfArgs = (cmyk: boolean): string[] => [
  "-q",
  "-dNOPAUSE",
  "-dBATCH",
  "-dSAFER",
  "-sDEVICE=pdfwrite",
  ...(cmyk
    ? [
        "-dPDFSETTINGS=/prepress",
        "-sColorConversionStrategy=CMYK",
        "-sProcessColorModel=DeviceCMYK",
      ]
    : ["-sColorConversionStrategy=LeaveColorUnchanged"]),
  "-dNoOutputFonts",
  "-dAutoRotatePages=/None",
  "-sOutputFile=out.pdf",
  "in.pdf",
];
