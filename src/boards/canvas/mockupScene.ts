/**
 * Where a book sits in a mockup, as arithmetic.
 *
 * Pure and DOM-free, like coverLayout and wrapLayout: this decides where each
 * face of the book lands on the output and how a pixel there maps back into
 * the cover, and it can be checked without a GPU. mockupGl.ts turns the
 * numbers into a picture and knows nothing about books.
 *
 * The book is a box one unit wide. Its height comes from the cover's aspect,
 * its depth from the spine — thickness over trim width, so a 312-page cream
 * 6×9 is 0.13 deep. A pinhole camera projects the corners of each face; a
 * homography from those four corners back to the unit square is what the
 * shader samples with. Faces that turn away from the camera are dropped, so
 * a view that shows the spine cannot also show the page block on the far
 * side.
 */

export type MockupView = "flat" | "angled" | "spread";

export const isMockupView = (value: unknown): value is MockupView =>
  value === "flat" || value === "angled" || value === "spread";

/** Which picture a face samples, and where in it. */
export type FaceSource = "cover" | "wrap" | "paint";

export interface Face {
  /** Inverse homography, row-major 3×3: output pixel → face UV. */
  inverse: readonly number[];
  /** Brightness, 1 is unlit-neutral. Spines and page edges sit darker. */
  shade: number;
  source: FaceSource;
  /** UV window inside the source picture: u0, v0, u1, v1. Whole picture is 0,0,1,1. */
  window: readonly [number, number, number, number];
}

export interface Shadow {
  /** Ellipse in output pixels. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  strength: number;
}

export interface Scene {
  /** Back to front — the last face drawn wins. */
  faces: readonly Face[];
  shadow: Shadow;
}

export interface SceneInput {
  /** Cover width over height. */
  coverAspect: number;
  height: number;
  /** Spine thickness over trim width; 0 for a single sheet. */
  thickness: number;
  view: MockupView;
  width: number;
  /**
   * The wrap's layout, when a wrap is wired: how much of its width is the
   * front, and where the spine sits. Fractions of the wrap image's width.
   */
  wrap: { frontU0: number; frontU1: number; spineU0: number; spineU1: number; v0: number; v1: number } | null;
}

type Vec3 = [number, number, number];
type Vec2 = [number, number];

/**
 * Homography sending the unit square's corners to `dst`.
 *
 * The four-point DLT solved by hand — eight unknowns, two equations per point.
 * A general solver would be forty lines of Gaussian elimination for a case
 * that has a closed form; this is the form projective-texture code has used
 * since the 90s.
 */
const homographyFromUnitSquare = (dst: readonly Vec2[]): number[] => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = dst;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = det === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;
  // Maps (u, v) with corners (0,0)→p0, (1,0)→p1, (1,1)→p2, (0,1)→p3.
  return [a, b, c, d, e, f, g, h, 1];
};

const invert3 = (m: readonly number[]): number[] => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (det === 0) {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  const s = 1 / det;
  return [
    A * s,
    -(b * i - c * h) * s,
    (b * f - c * e) * s,
    B * s,
    (a * i - c * g) * s,
    -(a * f - c * d) * s,
    C * s,
    -(a * h - b * g) * s,
    (a * e - b * d) * s,
  ];
};

/** Applies a homography to a point. Exported for the tests. */
export const apply = (m: readonly number[], p: Vec2): Vec2 => {
  const [x, y] = p;
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
};

const rotateY = ([x, y, z]: Vec3, radians: number): Vec3 => {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [x * c + z * s, y, -x * s + z * c];
};

const rotateX = ([x, y, z]: Vec3, radians: number): Vec3 => {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [x, y * c - z * s, y * s + z * c];
};

/** Faces of a unit-wide box, each as four corners in (u,v) order. */
const boxFaces = (
  w: number,
  h: number,
  d: number
): { corners: Vec3[]; normal: Vec3; source: FaceSource }[] => {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  return [
    // Spine: the left side, seen with its top at the top. u runs along the
    // spine's width (front to back), v down its height.
    {
      corners: [
        [-x, y, -z],
        [-x, y, z],
        [-x, -y, z],
        [-x, -y, -z],
      ],
      normal: [-1, 0, 0],
      source: "wrap",
    },
    // Page block on the right, in case the view turns that way.
    {
      corners: [
        [x, y, z],
        [x, y, -z],
        [x, -y, -z],
        [x, -y, z],
      ],
      normal: [1, 0, 0],
      source: "paint",
    },
    // Front.
    {
      corners: [
        [-x, y, z],
        [x, y, z],
        [x, -y, z],
        [-x, -y, z],
      ],
      normal: [0, 0, 1],
      source: "cover",
    },
  ];
};

/**
 * The scene for one view.
 *
 * `flat` and `spread` are the same machinery with the rotation set to zero,
 * so a straight-on view goes through exactly the code an angled one does and
 * cannot drift from it.
 */
export const mockupScene = (input: SceneInput): Scene => {
  const { coverAspect, height, thickness, view, width, wrap } = input;
  const spread = view === "spread";
  const angled = view === "angled";

  const bookW = spread && wrap ? 1 / ((wrap.frontU1 - wrap.frontU0) || 1) : 1;
  const bookH = 1 / Math.max(0.2, coverAspect);
  const depth = spread ? 0 : Math.max(0.02, thickness);

  const yaw = angled ? (30 * Math.PI) / 180 : 0;
  const pitch = angled ? (-5 * Math.PI) / 180 : 0;

  // Camera on +z looking down -z. Focal length and distance chosen so the
  // book fills the frame without fisheye: at 5 units away a 1.5-tall book
  // subtends about a third of the view, which the fit below scales up.
  const camZ = 5;
  const focal = 4;
  const project = (p: Vec3): Vec2 => {
    const r = rotateX(rotateY(p, yaw), pitch);
    const dz = camZ - r[2];
    return [(r[0] * focal) / dz, (r[1] * focal) / dz];
  };
  const facing = (n: Vec3): boolean => {
    const r = rotateX(rotateY(n, yaw), pitch);
    // The view direction is -z; a face is visible when its normal has a
    // component toward the camera.
    return r[2] > 0.02;
  };

  const faces = boxFaces(bookW, bookH, depth);
  const projected = faces.map((face) => ({
    ...face,
    screen: face.corners.map(project),
  }));

  // Fit: the visible silhouette fills the target fraction of the height,
  // centred, whatever the view. The margin leaves room for the shadow.
  const visible = projected.filter((f) => facing(f.normal));
  const pts = visible.flatMap((f) => f.screen);
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const fill = spread ? 0.84 : angled ? 0.8 : 0.74;
  const scale = Math.min(
    (width * fill) / Math.max(1e-6, maxX - minX),
    (height * fill) / Math.max(1e-6, maxY - minY)
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const toPixels = ([x, y]: Vec2): Vec2 => [
    width / 2 + (x - cx) * scale,
    height / 2 - (y - cy) * scale,
  ];

  const out: Face[] = visible.map((face) => {
    const corners = face.screen.map(toPixels);
    const forward = homographyFromUnitSquare(corners);
    const isSpine = face.source === "wrap";
    const isFront = face.source === "cover";
    let source: FaceSource = face.source;
    let window: [number, number, number, number] = [0, 0, 1, 1];
    if (isSpine) {
      if (wrap) {
        window = [wrap.spineU0, wrap.v0, wrap.spineU1, wrap.v1];
      } else {
        source = "paint";
      }
    } else if (isFront) {
      if (spread && wrap) {
        source = "wrap";
        window = [0, 0, 1, 1];
      } else if (wrap) {
        source = "wrap";
        window = [wrap.frontU0, wrap.v0, wrap.frontU1, wrap.v1];
      }
    }
    return {
      inverse: invert3(forward),
      shade: isFront ? 1 : isSpine ? 0.78 : 0.9,
      source,
      window,
    };
  });

  // Shadow under the book: an ellipse hugging the bottom edge, wider than
  // the book by a little and squashed. Flat views get a softer, offset one
  // that reads as a sheet lying on paper rather than a box standing on it.
  const frontPx = projected[2].screen.map(toPixels);
  const bottomY = Math.max(...frontPx.map((p) => p[1]));
  const leftX = Math.min(...pts.map((p) => toPixels(p)[0]));
  const rightX = Math.max(...pts.map((p) => toPixels(p)[0]));
  const shadow: Shadow = angled
    ? {
        cx: (leftX + rightX) / 2,
        cy: bottomY + height * 0.012,
        rx: ((rightX - leftX) / 2) * 1.08,
        ry: height * 0.045,
        strength: 0.42,
      }
    : {
        cx: (leftX + rightX) / 2 + width * 0.012,
        cy: (Math.min(...frontPx.map((p) => p[1])) + bottomY) / 2 + height * 0.02,
        rx: ((rightX - leftX) / 2) * 1.04,
        ry: ((bottomY - Math.min(...frontPx.map((p) => p[1]))) / 2) * 1.04,
        strength: 0.3,
      };

  return { faces: out, shadow };
};

/**
 * How a wrap image divides into back, spine and front.
 *
 * Worked out from the picture's own proportions and the trim, so it does not
 * need the page count: the wrap is 2 × trim + spine + 2 × bleed wide and
 * trim + 2 × bleed tall, and the height is known, so the spine is whatever is
 * left over. KDP's bleed is fixed at ⅛".
 */
export const wrapWindows = (
  wrapAspect: number,
  trimWidthIn: number,
  trimHeightIn: number
): NonNullable<SceneInput["wrap"]> & { spineIn: number } => {
  const bleed = 0.125;
  const totalH = trimHeightIn + bleed * 2;
  const totalW = wrapAspect * totalH;
  const spineIn = Math.max(0, totalW - trimWidthIn * 2 - bleed * 2);
  const u = (inches: number) => inches / totalW;
  return {
    frontU0: u(bleed + trimWidthIn + spineIn),
    frontU1: u(bleed + trimWidthIn * 2 + spineIn),
    spineIn,
    spineU0: u(bleed + trimWidthIn),
    spineU1: u(bleed + trimWidthIn + spineIn),
    v0: bleed / totalH,
    v1: (bleed + trimHeightIn) / totalH,
  };
};
