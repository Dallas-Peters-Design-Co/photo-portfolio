/**
 * The directions a logo board can start with, one line on its Iterate node each.
 *
 * Each prompt says only what the direction is. What the logo is *for* comes
 * from the brief wired into every node, and the two are joined on the run.
 * Adapted from the logo-creator skill's style guide (logo-creator/references).
 */
export const LOGO_STYLES = [
  {
    id: "minimal",
    label: "Minimal mark",
    prompt:
      "minimalist flat logo mark, simple geometric shapes, clean lines, generous negative space, two colours at most",
  },
  {
    id: "lettermark",
    label: "Lettermark",
    prompt:
      "lettermark logo built from the brand's initials, custom modern letterforms, strong silhouette",
  },
  {
    id: "wordmark",
    label: "Wordmark",
    prompt:
      "wordmark logo, the brand name set in distinctive custom typography, careful kerning, no icon",
  },
  {
    id: "abstract",
    label: "Abstract",
    prompt:
      "abstract geometric logo symbol, bold balanced composition, memorable at small sizes",
  },
  {
    id: "emblem",
    label: "Emblem",
    prompt:
      "emblem or badge logo, contained shape, the name integrated into the badge, vintage-inspired but clean",
  },
  {
    id: "mascot",
    label: "Mascot",
    prompt:
      "friendly mascot character logo, simple vector illustration style, expressive but uncluttered",
  },
  {
    id: "hand-drawn",
    label: "Hand-drawn",
    prompt:
      "hand-drawn logo, confident brush or ink linework, organic and warm, still simple enough to trace",
  },
  {
    id: "pixel",
    label: "Pixel art",
    prompt:
      "pixel art logo, 8-bit retro style, crisp square pixels on a strict grid, limited palette",
  },
] as const;

export type LogoStyleId = (typeof LOGO_STYLES)[number]["id"];

/** What a new logo board starts with ticked. */
export const DEFAULT_LOGO_STYLES: LogoStyleId[] = [
  "minimal",
  "lettermark",
  "wordmark",
  "abstract",
];

/**
 * Models worth making a logo with, best first. All of them are rows in the
 * `models` table already; this only says which to offer and why.
 *
 * Nano Banana is last on purpose: a general image model, good at pictures,
 * poor at marks — muddy shapes and invented lettering.
 */
export const LOGO_MODELS = [
  {
    hint: "Draws real SVG, so there is nothing to trace. Clean, flat marks.",
    id: "fal-ai/recraft/v4/pro/text-to-vector",
    label: "Recraft v4 Pro · Vector",
    vector: true,
  },
  {
    hint: "Best with type: wordmarks and lettermarks. Uses your exact colours.",
    id: "fal-ai/ideogram/v3",
    label: "Ideogram v3",
    vector: false,
  },
  {
    hint: "Faster, cheaper vector drafts for a first round.",
    id: "fal-ai/recraft/v4.1/text-to-vector",
    label: "Recraft v4.1 · Vector",
    vector: true,
  },
  {
    hint: "Quick typographic drafts.",
    id: "ideogram/v4/instant",
    label: "Ideogram v4 Instant",
    vector: false,
  },
  {
    hint: "General image model. Weak at marks and lettering.",
    id: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    vector: false,
  },
] as const;

export type LogoModelId = (typeof LOGO_MODELS)[number]["id"];

export const DEFAULT_LOGO_MODEL: LogoModelId = LOGO_MODELS[0].id;
