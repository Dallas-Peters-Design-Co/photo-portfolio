import { colorVector } from "./halftoneGl";

/**
 * A cover's finishing, as one WebGL pass.
 *
 * Palette clamp, print screen, grain and vignette in a single fragment shader
 * rather than four filters over the same pixels. 1800×2700 is 4.86 million of
 * them, and the difference between one pass and four is the difference between
 * a slider that drags and a slider that stutters — PhotoPipeline makes the same
 * point about the photo editor.
 *
 * Deliberately a sibling of halftoneGl.ts rather than a caller of it. That
 * shader resolves a photograph to two colours, which is a conversion; this one
 * overprints a screen on artwork that already has its own colour, which is a
 * texture. Sharing the code would mean one of them lying about what it does.
 * What is shared is `colorVector`, because parsing a hex is parsing a hex.
 *
 * Three decisions inherited from that file because they were paid for once:
 *
 * - **WebGL, not WebGPU.** A WebGPU canvas hands back a fully transparent image
 *   to `toBlob`, `drawImage` and `createImageBitmap` alike. Every cover leaves
 *   here through `toBlob`.
 * - **`preserveDrawingBuffer`.** Without it the buffer is discarded once
 *   composited and every read after the drawing frame comes back blank.
 * - **The program is compiled once per canvas.** Linking is tens of
 *   milliseconds on the main thread; doing it per paint is what made ten
 *   halftone nodes freeze the board.
 *
 * One decision of its own: the clamp is nearest-colour in luma-weighted RGB,
 * not a gradient map. A gradient map ramps by brightness, so two hues of equal
 * brightness — a brick red field and a forest green one, which is exactly this
 * palette — collapse onto the same swatch. Nearest-colour keeps them apart.
 */

export class CoverGlError extends Error {}

/** The most swatches the shader carries. The house rule is four; this allows six. */
export const MAX_PALETTE = 6;

export interface CoverGlOptions {
  /** How hard to pull toward the palette. 0 passes the artwork through. */
  clamp: number;
  /** Dot pitch in output pixels. 0 turns the screen off. */
  dot: number;
  /** Above 1 lightens the midtones before screening, below 1 darkens them. */
  gamma: number;
  grain: number;
  /** Up to MAX_PALETTE hexes. Fewer is normal. */
  palette: readonly string[];
  /** Stable per cover, so a re-render is the same grain rather than new grain. */
  seed: number;
  /** The darkest brand tone. Vignette only. */
  shadow: string;
  vignette: number;
}

export const COVER_GL_DEFAULTS: Omit<CoverGlOptions, "palette" | "seed"> = {
  clamp: 0,
  dot: 0,
  gamma: 1,
  grain: 0.18,
  shadow: "#0a1112",
  vignette: 0.14,
};

const VERTEX_SOURCE =
  "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 v;
uniform sampler2D art;
uniform vec2 res;
uniform float imgAspect;
uniform vec3 pal[${MAX_PALETTE}];
uniform int palN;
uniform float clampAmt;
uniform float dot_;
uniform float gamma;
uniform float grain;
uniform float vig;
uniform vec3 shadow;
uniform float seed;

const vec3 LUMA = vec3(.299, .587, .114);

// Cover-fit, lifted from halftoneGl for the same reason: the artwork fills the
// trim and the excess is cropped, rather than squashed to fit 2:3.
vec2 coverUV(vec2 uv){
    float canvasAspect = res.x / res.y;
    vec2 s = canvasAspect > imgAspect
        ? vec2(1., imgAspect / canvasAspect)
        : vec2(canvasAspect / imgAspect, 1.);
    return (uv - .5) * s + .5;
}

// Fixed loop bound with the guard inside: GLSL ES 1.00 wants a constant bound,
// and several drivers mis-compile a dynamic break.
vec3 toPalette(vec3 c){
    vec3 best = c;
    float bestD = 1e9;
    for (int i = 0; i < ${MAX_PALETTE}; i++) {
        if (i < palN) {
            vec3 d = (c - pal[i]) * LUMA * 3.;
            float dist = dot(d, d);
            if (dist < bestD) { bestD = dist; best = pal[i]; }
        }
    }
    return best;
}

float bayer2(vec2 p){vec2 q=mod(p,2.);if(q.y<1.)return q.x<1.?0.:2.;return q.x<1.?3.:1.;}
float bayer4(vec2 p){return 4.*bayer2(mod(p,2.))+bayer2(floor(p/2.));}
float bayer8(vec2 p){return 4.*bayer4(mod(p,4.))+bayer2(floor(p/4.));}

float hash(vec2 p){return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453123);}

void main(){
    vec3 col = texture2D(art, coverUV(v)).rgb;

    col = mix(col, toPalette(col), clampAmt);

    if (dot_ > 0.) {
        // Multiplied at part strength rather than replacing the pixel: this is
        // an overprint on colour that is already right, not a two-tone
        // conversion. halftoneGl does the conversion.
        vec2 cell = floor(gl_FragCoord.xy / dot_);
        float coverage = pow(clamp(1. - dot(col, LUMA), 0., 1.), gamma);
        float threshold = 1. - bayer8(mod(cell, 8.)) / 64.;
        col *= 1. - step(threshold, coverage) * .3;
    }

    if (grain > 0.) {
        col += (hash(floor(gl_FragCoord.xy)) - .5) * grain * .18;
    }

    if (vig > 0.) {
        vec2 d = v - .5;
        // Aspect-corrected, or a 2:3 trim gets an obviously oval vignette.
        d.x *= res.x / res.y;
        col = mix(col, shadow, smoothstep(.30, .74, length(d)) * vig);
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
  texture: WebGLTexture | null;
  uploaded: HTMLImageElement | null;
}

/** Weak, so a canvas that goes away takes its program with it. */
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
    throw new CoverGlError("This browser cannot draw the cover.");
  }

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  if (!(vertex && fragment)) {
    throw new CoverGlError("The cover shader would not compile.");
  }
  const program = gl.createProgram();
  if (!program) {
    throw new CoverGlError("The cover shader would not compile.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new CoverGlError("The cover shader would not link.");
  }
  // WebGL's useProgram, not a React hook — the linter matches on the name.
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

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, "art"), 0);

  const ready: Prepared = { gl, program, texture, uploaded: null };
  prepared.set(canvas, ready);
  return ready;
};

/**
 * Palette uniforms, padded to MAX_PALETTE.
 *
 * Padded rather than sized: a `vec3[6]` uniform wants six values whatever
 * `palN` says, and an under-filled array reads whatever the slot held last —
 * a stray swatch that only appears after a six-colour cover has been drawn once.
 */
const paletteUniform = (palette: readonly string[]): Float32Array => {
  const out = new Float32Array(MAX_PALETTE * 3);
  const used = palette.slice(0, MAX_PALETTE);
  const last = used.at(-1) ?? "#000000";
  for (let i = 0; i < MAX_PALETTE; i++) {
    const [r, g, b] = colorVector(used[i] ?? last, [0, 0, 0]);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
};

/** Draws `image` finished, at whatever size the canvas already is. */
export const paintCover = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: CoverGlOptions
): void => {
  const { gl, program, texture, uploaded } = prepare(canvas);
  gl.useProgram(program);

  if (uploaded !== image) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
    } catch (err) {
      // A cross-origin picture without CORS headers cannot become a texture,
      // and the browser will not say which one — so name the cause here.
      throw new CoverGlError(
        "That picture could not be read. It came from another origin without permission.",
        { cause: err }
      );
    }
    const entry = prepared.get(canvas);
    if (entry) {
      entry.uploaded = image;
    }
  }

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uniform("res"), canvas.width, canvas.height);
  gl.uniform1f(
    uniform("imgAspect"),
    image.naturalWidth / Math.max(1, image.naturalHeight)
  );
  gl.uniform3fv(uniform("pal"), paletteUniform(options.palette));
  gl.uniform1i(
    uniform("palN"),
    Math.min(MAX_PALETTE, Math.max(0, options.palette.length))
  );
  gl.uniform1f(uniform("clampAmt"), options.palette.length > 0 ? options.clamp : 0);
  gl.uniform1f(uniform("dot_"), Math.max(0, options.dot));
  gl.uniform1f(uniform("gamma"), Math.max(0.01, options.gamma));
  gl.uniform1f(uniform("grain"), Math.max(0, options.grain));
  gl.uniform1f(uniform("vig"), Math.max(0, options.vignette));
  gl.uniform3fv(uniform("shadow"), colorVector(options.shadow, [0, 0, 0]));
  gl.uniform1f(uniform("seed"), options.seed);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

const number = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

/** Hexes out of a comma, space or newline separated list. Bad ones are dropped. */
export const paletteFrom = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(/[\s,]+/)
        .map((part) => part.trim())
        .filter((part) => HEX.test(part))
        .slice(0, MAX_PALETTE)
    : [];

/** A node's stored settings, read as options. Unset or malformed falls back. */
export const coverGlOptionsFrom = (
  config: Record<string, unknown>,
  seed: number
): CoverGlOptions => ({
  clamp: number(config.clamp, COVER_GL_DEFAULTS.clamp),
  dot: number(config.dot, COVER_GL_DEFAULTS.dot),
  gamma: number(config.gamma, COVER_GL_DEFAULTS.gamma),
  grain: number(config.grain, COVER_GL_DEFAULTS.grain),
  palette: paletteFrom(config.palette),
  seed,
  shadow:
    typeof config.shadow === "string" && HEX.test(config.shadow.trim())
      ? config.shadow.trim()
      : COVER_GL_DEFAULTS.shadow,
  vignette: number(config.vignette, COVER_GL_DEFAULTS.vignette),
});
