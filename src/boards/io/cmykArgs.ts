/**
 * Ghostscript's settings for a print PDF in CMYK.
 *
 * pdfwrite rewrites the file rather than rasterising it, so type stays type
 * and shapes stay paths; every colour, and every picture's pixels, goes
 * through Ghostscript's default CMYK profile. /prepress is the press preset:
 * fonts embedded, pictures kept at print resolution. The TrimBox and
 * BleedBox carry over as they are.
 */
export const CMYK_ARGS = [
  "-q",
  "-dNOPAUSE",
  "-dBATCH",
  "-dSAFER",
  "-sDEVICE=pdfwrite",
  "-dPDFSETTINGS=/prepress",
  "-sColorConversionStrategy=CMYK",
  "-sProcessColorModel=DeviceCMYK",
  "-dAutoRotatePages=/None",
  "-sOutputFile=out.pdf",
  "in.pdf",
];
