import type { Scene } from "./mockupScene";

/**
 * Drawing a mockup scene with WebGL.
 *
 * One fragment shader, one quad. For every output pixel it runs the inverse
 * homography of each visible face, and the last face that contains the pixel
 * paints it — the scene lists faces back to front, so that is painter's
 * order. Under the faces a soft ellipse darkens the ground; over nothing, the
 * background colour. There is no geometry pipeline because a book is three
 * quads and a shadow, and a fragment shader that knows that is fewer moving
 * parts than a scene graph.
 *
 * WebGL, not WebGPU, and `preserveDrawingBuffer`, for the reasons
 * halftoneGl.ts gives: the canvas has to read back as pixels afterwards. The
 * cover is uploaded through a 2D canvas that halves it to no more than 2048
 * on a side first — a 1800×2700 cover sampled by LINEAR into a 900-pixel face
 * would shimmer, and WebGL1 cannot mipmap a non-power-of-two texture.
 */

export class MockupGlError extends Error {}

const MAX_FACES = 3;

const VERTEX_SOURCE = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0., 1.); }`;

const FRAGMENT_SOURCE = `
precision highp float;

uniform vec2 res;
uniform vec3 bg;
uniform sampler2D cover;
uniform sampler2D wrap;

uniform int faces;
uniform mat3 inv[${MAX_FACES}];
uniform vec4 win[${MAX_FACES}];
uniform int src[${MAX_FACES}];
uniform float shade[${MAX_FACES}];
uniform vec3 paint;

uniform vec4 shadowEllipse; /* cx, cy, rx, ry in pixels */
uniform float shadowStrength;

vec3 sampleFace(int which, vec2 uv, vec4 window) {
    vec2 t = mix(window.xy, window.zw, uv);
    if (which == 0) { return texture2D(cover, t).rgb; }
    if (which == 1) { return texture2D(wrap, t).rgb; }
    return paint;
}

void main() {
    vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);

    vec2 d = (px - shadowEllipse.xy) / shadowEllipse.zw;
    float s = 1. - smoothstep(0.55, 1.0, length(d));
    vec3 col = bg * (1. - shadowStrength * s);

    for (int i = 0; i < ${MAX_FACES}; i++) {
        if (i < faces) {
            vec3 h = inv[i] * vec3(px, 1.);
            vec2 uv = h.xy / h.z;
            // A one-pixel feather at the edge, so the book is not aliased
            // against the ground.
            vec2 fw = vec2(length(vec2(inv[i][0][0], inv[i][1][0])), length(vec2(inv[i][0][1], inv[i][1][1]))) / max(abs(h.z), 1e-4);
            vec2 inside = smoothstep(vec2(0.), fw, uv) * smoothstep(vec2(0.), fw, 1. - uv);
            float a = inside.x * inside.y;
            if (h.z > 0. && a > 0.) {
                vec3 c = sampleFace(src[i], clamp(uv, 0., 1.), win[i]);
                // A little more light toward the top-right, like a lamp.
                float lit = shade[i] * (0.94 + 0.08 * (uv.x * 0.5 + (1. - uv.y) * 0.5));
                col = mix(col, c * lit, a);
            }
        }
    }

    gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

interface Prepared {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  textures: [WebGLTexture | null, WebGLTexture | null];
}

const prepared = new WeakMap<HTMLCanvasElement, Prepared>();

const prepare = (canvas: HTMLCanvasElement): Prepared => {
  const already = prepared.get(canvas);
  if (already) {
    return already;
  }
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    throw new MockupGlError("This browser cannot draw the mockup.");
  }
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  if (!(vertex && fragment && program)) {
    throw new MockupGlError("The mockup shader would not compile.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new MockupGlError("The mockup shader would not link.");
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a GL call
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const textures: [WebGLTexture | null, WebGLTexture | null] = [
    gl.createTexture(),
    gl.createTexture(),
  ];
  textures.forEach((texture, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  });

  const entry = { gl, program, textures };
  prepared.set(canvas, entry);
  return entry;
};

/** The picture, no larger than `max` on a side, ready to upload. */
const shrink = (image: HTMLImageElement, max: number): TexImageSource => {
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale >= 1) {
    return image;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return image;
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const upload = (
  gl: WebGLRenderingContext,
  unit: number,
  texture: WebGLTexture | null,
  image: HTMLImageElement | null
): void => {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  try {
    if (image) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        shrink(image, 2048)
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255])
      );
    }
  } catch (err) {
    throw new MockupGlError(
      "That picture could not be read. It came from another origin without permission.",
      { cause: err }
    );
  }
};

const rgb = (hex: string): [number, number, number] => {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) {
    return [0.94, 0.93, 0.9];
  }
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export interface MockupPaint {
  background: string;
  /** Colour of a spine or page block that has no picture. */
  paint: string;
}

/** Draws `scene` into `canvas` at the canvas's own size. */
export const paintMockup = (
  canvas: HTMLCanvasElement,
  scene: Scene,
  cover: HTMLImageElement,
  wrap: HTMLImageElement | null,
  colors: MockupPaint
): void => {
  const { gl, program, textures } = prepare(canvas);
  gl.useProgram(program);
  upload(gl, 0, textures[0], cover);
  upload(gl, 1, textures[1], wrap);

  const u = (name: string) => gl.getUniformLocation(program, name);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(u("res"), canvas.width, canvas.height);
  gl.uniform3fv(u("bg"), rgb(colors.background));
  gl.uniform3fv(u("paint"), rgb(colors.paint));
  gl.uniform1i(u("cover"), 0);
  gl.uniform1i(u("wrap"), 1);

  const faces = scene.faces.slice(0, MAX_FACES);
  gl.uniform1i(u("faces"), faces.length);
  const inverses = new Float32Array(MAX_FACES * 9);
  const windows = new Float32Array(MAX_FACES * 4);
  const sources = new Int32Array(MAX_FACES);
  const shades = new Float32Array(MAX_FACES).fill(1);
  faces.forEach((face, i) => {
    // GLSL mat3 is column-major; the scene's matrix is row-major.
    const m = face.inverse;
    inverses.set([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]], i * 9);
    windows.set(face.window, i * 4);
    sources[i] = face.source === "cover" ? 0 : face.source === "wrap" ? 1 : 2;
    shades[i] = face.shade;
  });
  gl.uniformMatrix3fv(u("inv"), false, inverses);
  gl.uniform4fv(u("win"), windows);
  gl.uniform1iv(u("src"), sources);
  gl.uniform1fv(u("shade"), shades);

  const { cx, cy, rx, ry, strength } = scene.shadow;
  gl.uniform4f(u("shadowEllipse"), cx, cy, Math.max(1, rx), Math.max(1, ry));
  gl.uniform1f(u("shadowStrength"), strength);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
};
