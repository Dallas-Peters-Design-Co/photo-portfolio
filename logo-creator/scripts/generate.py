#!/usr/bin/env python3
"""
Generate logo variations on fal, one batch per direction.

Usage:
  python3 generate.py "BRIEF" -d OUT_DIR [--model recraft] [-n 4]
                      [--directions minimal,lettermark,wordmark,abstract]
                      [--colors "#1f4d2b,#f5efe0"]
  python3 generate.py "BRIEF" -d OUT_DIR --directions lettermark -n 6 --tag v2

BRIEF says what the logo is for ("Logo for "Back Acres", a short-term rental
outside Amarillo, quiet and a little rustic"). Each direction adds its own style
line, so one brief makes several distinct families — the same thing the app's
logo board does with an Iterate node.

Models (best first for logos):
  recraft       Recraft v4 Pro, draws real SVG. Default.
  recraft-fast  Recraft v4.1, cheaper vector drafts.
  ideogram      Ideogram v3, best with lettering; takes exact colours.
  nano          Nano Banana Pro. General image model, weak at marks.

Files: OUT_DIR/<direction>[-<tag>]-NN.(svg|png). Never overwrites. Rebuilds
preview.html and contact-sheet.png at the end.
"""

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _fal import call, download  # noqa: E402
from preview import build_preview  # noqa: E402

MODELS = {
    "recraft": "fal-ai/recraft/v4/pro/text-to-vector",
    "recraft-fast": "fal-ai/recraft/v4.1/text-to-vector",
    "ideogram": "fal-ai/ideogram/v3",
    "nano": "fal-ai/nano-banana-pro",
}

PRODUCTION = (
    "a single logo, centred, on a plain white background, no mockup, "
    "no extra text beyond the name, crisp edges, flat colour"
)
NEGATIVE = "photo, mockup, 3d render, gradient, drop shadow, misspelled text, extra letters, watermark"

# Fallback when the app's direction list is not on disk (skill used elsewhere).
FALLBACK_DIRECTIONS = {
    "minimal": "minimalist flat logo mark, simple geometric shapes, clean lines, generous negative space, two colours at most",
    "lettermark": "lettermark logo built from the brand's initials, custom modern letterforms, strong silhouette",
    "wordmark": "wordmark logo, the brand name set in distinctive custom typography, careful kerning, no icon",
    "abstract": "abstract geometric logo symbol, bold balanced composition, memorable at small sizes",
    "emblem": "emblem or badge logo, contained shape, the name integrated into the badge, vintage-inspired but clean",
    "mascot": "friendly mascot character logo, simple vector illustration style, expressive but uncluttered",
    "hand-drawn": "hand-drawn logo, confident brush or ink linework, organic and warm, still simple enough to trace",
    "pixel": "pixel art logo, 8-bit retro style, crisp square pixels on a strict grid, limited palette",
}

DIRECTION_ENTRY = re.compile(
    r'id:\s*"(?P<id>[^"]+)",\s*label:\s*"[^"]*",\s*prompt:\s*"(?P<prompt>[^"]+)"'
)


def load_directions():
    """
    The app's own direction list, so the skill and the logo board never drift.
    src/boards/logo/logoStyles.ts is the source of truth when it is on disk.
    """
    here = Path(__file__).resolve()
    for root in here.parents:
        source = root / "src" / "boards" / "logo" / "logoStyles.ts"
        if source.is_file():
            found = {m["id"]: m["prompt"] for m in DIRECTION_ENTRY.finditer(source.read_text())}
            if found:
                return found
    return FALLBACK_DIRECTIONS


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    return {"r": int(h[0:2], 16), "g": int(h[2:4], 16), "b": int(h[4:6], 16)}


def payload(model, prompt, colours, count):
    """The request body for one call, in each endpoint's own vocabulary."""
    if model.startswith("fal-ai/recraft"):
        body = {"prompt": prompt, "image_size": "square_hd", "background_color": rgb("#ffffff")}
        if colours:
            body["colors"] = [rgb(c) for c in colours]
        return body, 1  # Recraft returns one image per call.
    if model == MODELS["ideogram"]:
        body = {
            "prompt": prompt,
            "image_size": "square_hd",
            "num_images": count,
            "style": "DESIGN",
            "rendering_speed": "QUALITY",
            "negative_prompt": NEGATIVE,
            # MagicPrompt rewrites the brief into a scene; logos want it literal.
            "expand_prompt": False,
        }
        if colours:
            body["color_palette"] = {"members": [{"rgb": rgb(c), "color_weight": 0.5} for c in colours]}
        return body, count
    body = {
        "prompt": prompt + (f", using only these colours: {', '.join(colours)}" if colours else ""),
        "num_images": count,
        "aspect_ratio": "1:1",
        "output_format": "png",
        "limit_generations": True,
    }
    return body, count


def extension(url, content_type):
    if (content_type or "").endswith("svg+xml") or url.split("?")[0].endswith(".svg"):
        return ".svg"
    return ".png"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("brief")
    parser.add_argument("-d", "--dir", required=True)
    parser.add_argument("--model", default="recraft", choices=MODELS.keys())
    parser.add_argument("-n", "--count", type=int, default=4, help="variations per direction")
    parser.add_argument("--directions", default="minimal,lettermark,wordmark,abstract")
    parser.add_argument("--colors", default="", help="comma-separated hex, e.g. #1f4d2b,#f5efe0")
    parser.add_argument("--tag", default="", help="suffix for a later round, e.g. v2")
    args = parser.parse_args()

    known = load_directions()
    directions = [d.strip() for d in args.directions.split(",") if d.strip()]
    unknown = [d for d in directions if d not in known]
    if unknown:
        sys.exit(f"Unknown direction(s): {', '.join(unknown)}. Known: {', '.join(known)}")
    colours = [c.strip().lower() for c in args.colors.split(",") if re.fullmatch(r"#[0-9a-fA-F]{6}", c.strip())]
    model = MODELS[args.model]
    out_dir = Path(args.dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # One job per call: a direction, and how many images that call returns.
    jobs = []
    for direction in directions:
        prompt = f"{args.brief.strip()}, style: {known[direction]}, {PRODUCTION}"
        remaining = args.count
        while remaining > 0:
            body, returns = payload(model, prompt, colours, min(4, remaining))
            jobs.append((direction, body))
            remaining -= returns

    def run(job):
        direction, body = job
        result = call(model, body)
        return [(direction, img["url"], img.get("content_type")) for img in result.get("images", [])]

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [item for batch in pool.map(run, jobs) for item in batch]

    counters = {}
    for direction, url, content_type in results:
        stem = f"{direction}-{args.tag}" if args.tag else direction
        n = counters.get(stem, 0)
        while True:
            n += 1
            path = out_dir / f"{stem}-{n:02d}{extension(url, content_type)}"
            if not any(out_dir.glob(f"{stem}-{n:02d}.*")):
                break
        counters[stem] = n
        download(url, path)
        print(path)

    build_preview(out_dir)
    try:
        from contact_sheet import build_sheet

        sheet = build_sheet(out_dir)
        print(f"Contact sheet: {sheet}")
    except Exception as error:  # A missing renderer must not lose the batch.
        print(f"(contact sheet skipped: {error})")
    print(f"{len(results)} saved with {args.model}. Preview: {out_dir / 'preview.html'}")


if __name__ == "__main__":
    main()
