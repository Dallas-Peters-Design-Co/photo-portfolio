/**
 * The parts of imagetracer.js this project calls. The library has more
 * (drawing layers to a container, loading from a URL); they are not typed
 * because they are not used, and typing them would be a claim nobody checks.
 */
export interface ImageTracerOptions {
  /** Blur radius before tracing, 0–5. Softens noise into fewer, larger shapes. */
  blurradius?: number;
  blurdelta?: number;
  /** 0: deterministic palette, 1: random sampling, 2: deterministic sampling. */
  colorsampling?: 0 | 1 | 2;
  colorquantcycles?: number;
  /** 0: stacked (each layer covers the last), 1: parallel (each is cut out). */
  layering?: 0 | 1;
  linefilter?: boolean;
  /** Straight-line error threshold; smaller is more faithful, more nodes. */
  ltres?: number;
  mincolorratio?: number;
  numberofcolors?: number;
  /** Paths with fewer than this many points are dropped. */
  pathomit?: number;
  /** Quadratic-spline error threshold; smaller is more faithful. */
  qtres?: number;
  rightangleenhance?: boolean;
  roundcoords?: number;
  scale?: number;
  strokewidth?: number;
  viewbox?: boolean;
  desc?: boolean;
}

export interface ImageTracer {
  versionnumber: string;
  imagedataToSVG(imageData: ImageData, options?: ImageTracerOptions | string): string;
}

declare const tracer: ImageTracer;
export default tracer;
