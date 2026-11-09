/**
 * The shader behind Liquid Gradients (liquid.ts): the Silk and Marble looks,
 * colour that looks poured, worked out per pixel on the GPU. Aura and Mesh
 * are plain SVG (liquidSvg.ts) and never come here.
 *
 * WebGL, not the shader library's WebGPU, for the reason halftoneGl.ts gives:
 * a WebGPU canvas hands back nothing to `drawImage` or `toDataURL`, and the
 * whole point here is to read the picture back, into the preview and into the
 * file that goes on the board.
 *
 * One canvas and one compiled program for the whole app, made the first time
 * a picture is asked for. Browsers allow only a handful of WebGL contexts at
 * once and drop the oldest without a word, so every preview and every export
 * shares this one: it is drawn, copied out, and drawn again for the next.
 *
 * Everything that moves is a whole number of turns of `phase` (0 to 1), so a
 * picture at phase 1 is the picture at phase 0 and a video of one cycle loops
 * without a jump. Nothing is random in here either: the seed's numbers are
 * worked out by the caller and handed in, so a seed draws the same picture on
 * any machine.
 */

/**
 * The longest side drawn in one go, whatever the GPU would allow. A 24×36
 * poster at 300 dpi is 78 million pixels: a GPU that agreed to draw it would
 * hand back a file too big to carry as text. The colour has no fine detail,
 * so past this it is drawn smaller and stretched (liquid.ts).
 */
const LONGEST = 4096;

/** How many colours the shader blends between, at most. */
export const LIQUID_COLOURS = 6;

/** The four looks. The first two are the shader's; `look` counts them in this order. */
export const LIQUID_LOOKS = ["silk", "marble", "aura", "mesh"] as const;
export type LiquidLook = (typeof LIQUID_LOOKS)[number];

export interface LiquidFrame {
  /** The turn of the whole picture, in radians. */
  angle: number;
  /** The colours as OKLab triples, blended there so mixes stay clean. */
  colours: [number, number, number][];
  look: LiquidLook;
  /** Where in the loop, 0 to 1. */
  phase: number;
  /**
   * A point per colour, for the looks drawn as discs (liquidSvg.ts): x and y
   * (0 to 1 over the piece), its size, and where on its orbit it starts.
   */
  points: [number, number, number, number][];
  /** How much of the pattern fits across the piece: 1 as made, 2 twice as much. */
  scale: number;
  /** Four numbers from the seed, each 0 to 1. */
  seed: [number, number, number, number];
  /** 0 hard bands, 1 the softest blend. */
  soft: number;
  /** How far the colour is pushed about; 0 is flat. */
  warp: number;
}

const VERTEX_SOURCE =
  "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAGMENT_SOURCE = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uLab[6];
uniform float uAngle;
uniform vec4 uSeed;
uniform float uCount;
uniform float uLook;
uniform float uPhase;
uniform float uScale;
uniform float uWarp;
uniform float uSoft;
const float TAU = 6.28318530718;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float a = .5, s = 0.;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= .5; }
  return s;
}

// The colours as a ramp, 0 the first and 1 the last. Softness is how much of
// the way between two neighbours is spent blending: all of it, or a hairline.
vec3 ramp(float t){
  float n = max(uCount - 1., 1.);
  float x = clamp(t, 0., 1.) * n;
  float i = min(floor(x), n - 1.);
  float e = mix(.02, .5, uSoft);
  float f = smoothstep(.5 - e, .5 + e, x - i);
  vec3 a = uLab[0];
  vec3 b = uLab[0];
  for (int k = 0; k < 6; k++) {
    if (float(k) == i) a = uLab[k];
    if (float(k) == i + 1.) b = uLab[k];
  }
  return mix(a, b, f);
}

// Silk: the plane folded over itself by waves of waves, read off as bands.
vec3 silk(vec2 p){
  float ph = TAU * uPhase;
  vec2 q = p * uScale * 1.5 + (uSeed.xy - .5) * 12.;
  for (int i = 1; i <= 5; i++) {
    float k = float(i);
    q += uWarp * .8 / k * vec2(
      sin(k * 1.3 * q.y + ph + uSeed.z * TAU + k * 1.7),
      cos(k * 1.1 * q.x - ph + uSeed.w * TAU + k * 2.3));
  }
  // One wave bent by another, so the bands run the whole ramp: averaging two
  // waves instead pulled everything to the middle and lost the end colours.
  float t = .5 + .5 * sin(q.x * .9 + q.y * .7 + .8 * sin(q.y * 1.3 - q.x * .4 + 1.7));
  return ramp(smoothstep(.04, .96, t));
}

// Marble: noise pushed about by noise, twice, then cut into veins.
vec3 marble(vec2 p){
  vec2 c = .35 * vec2(cos(TAU * uPhase), sin(TAU * uPhase));
  vec2 q = p * uScale * 1.3 + (uSeed.xy - .5) * 40.;
  vec2 w = vec2(fbm(q + c), fbm(q + vec2(5.2, 1.3) - c));
  vec2 r = vec2(fbm(q + 2. * uWarp * w + vec2(1.7, 9.2) + c.yx),
                fbm(q + 2. * uWarp * w + vec2(8.3, 2.8)));
  float t = fbm(q + 2. * uWarp * r);
  return ramp(.5 + .5 * sin(TAU * (t * 1.1 + r.x * .6 + uSeed.z)));
}

vec3 toSrgb(vec3 c){
  float l = c.x + .3963377774 * c.y + .2158037573 * c.z;
  float m = c.x - .1055613458 * c.y - .0638541728 * c.z;
  float s = c.x - .0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 lin = clamp(vec3(
    4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.7076147010 * s), 0., 1.);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1. / 2.4)) - .055, step(.0031308, lin));
}

void main(){
  vec2 asp = vec2(uRes.x / uRes.y, 1.);
  vec2 p = (gl_FragCoord.xy / uRes - .5) * asp;
  float c = cos(uAngle), s = sin(uAngle);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  vec3 lab = uLook < .5 ? silk(p) : marble(p);
  gl_FragColor = vec4(toSrgb(lab), 1.);
}`;

const UNIFORMS = [
  "uRes",
  "uLab",
  "uAngle",
  "uSeed",
  "uCount",
  "uLook",
  "uPhase",
  "uScale",
  "uWarp",
  "uSoft",
] as const;
type Uniform = (typeof UNIFORMS)[number];

interface Prepared {
  at: Record<Uniform, WebGLUniformLocation | null>;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  /** The longest side drawn in one go: the GPU's limit, or ours if lower. */
  limit: number;
}

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

const link = (gl: WebGLRenderingContext): WebGLProgram | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  if (!(vertex && fragment && program)) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
};

const prepare = (): Prepared | null => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    // Drawn to be read back: without this the canvas can be emptied before
    // the copy is taken.
    preserveDrawingBuffer: true,
  });
  const program = gl ? link(gl) : null;
  if (!(gl && program)) {
    return null;
  }
  // WebGL's useProgram, not a React hook — the linter matches on the name.
  // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a GL call
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
  return {
    at: Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
    ) as Record<Uniform, WebGLUniformLocation | null>,
    canvas,
    gl,
    limit: Math.min(
      LONGEST,
      Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 2048,
      dims?.[0] ?? 2048,
      dims?.[1] ?? 2048
    ),
  };
};

/** `undefined` until first asked for; `null` where WebGL is not to be had. */
let shared: Prepared | null | undefined;

const ready = (): Prepared | null => {
  // A context the browser took back is gone for good: start again.
  if (shared === undefined || shared?.gl.isContextLost()) {
    shared = prepare();
  }
  return shared;
};

/** The longest side the picture can be drawn at here, or 0 without WebGL. */
export const liquidLimit = (): number => ready()?.limit ?? 0;

/** `count` entries of `width` numbers each, the last one repeated to fill. */
const padded = (rows: number[][], width: number): Float32Array => {
  const out = new Float32Array(LIQUID_COLOURS * width);
  for (let i = 0; i < LIQUID_COLOURS; i += 1) {
    const row = rows[Math.min(i, rows.length - 1)] ?? [];
    for (let k = 0; k < width; k += 1) {
      out[i * width + k] = row[k] ?? 0;
    }
  }
  return out;
};

/**
 * Draws the picture at `width` by `height` pixels and hands back the shared
 * canvas holding it, or null where WebGL is not available. Copy it out
 * straight away (`drawImage`, `toDataURL`): the next call draws over it.
 */
export const paintLiquid = (
  frame: LiquidFrame,
  width: number,
  height: number
): HTMLCanvasElement | null => {
  const made = ready();
  if (!made || frame.colours.length === 0) {
    return null;
  }
  const { at, canvas, gl } = made;
  const w = Math.max(1, Math.min(made.limit, Math.round(width)));
  const h = Math.max(1, Math.min(made.limit, Math.round(height)));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(at.uRes, w, h);
  gl.uniform3fv(at.uLab, padded(frame.colours, 3));
  gl.uniform1f(at.uAngle, frame.angle);
  gl.uniform4fv(at.uSeed, frame.seed);
  gl.uniform1f(at.uCount, Math.min(LIQUID_COLOURS, frame.colours.length));
  gl.uniform1f(at.uLook, Math.max(0, LIQUID_LOOKS.indexOf(frame.look)));
  gl.uniform1f(at.uPhase, frame.phase);
  gl.uniform1f(at.uScale, frame.scale);
  gl.uniform1f(at.uWarp, frame.warp);
  gl.uniform1f(at.uSoft, frame.soft);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return gl.isContextLost() ? null : canvas;
};
