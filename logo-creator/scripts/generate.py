#!/usr/bin/env python3
"""
Generate logo variations with Nano Banana Pro (Gemini 3 Pro Image) on fal.

Usage:
  python3 generate.py "PROMPT" -n 20 --ratio 1:1 -d OUT_DIR [-p logo] [--start 1]
  python3 generate.py "PROMPT" -n 10 -d OUT_DIR -p logo-05-v --start 1

Files are numbered from --start: logo-01.png, logo-02.png, ... Existing files
are never overwritten; numbering skips past them. Rebuilds OUT_DIR/preview.html
when done.
"""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _fal import call, download  # noqa: E402
from preview import build_preview  # noqa: E402

MODEL = "fal-ai/nano-banana-pro"
RATIOS = ["1:1", "21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "auto"]
PER_CALL = 4  # Kept small so one failed call loses little.


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("prompt")
    parser.add_argument("-n", "--count", type=int, default=20)
    parser.add_argument("--ratio", default="1:1", choices=RATIOS)
    parser.add_argument("--resolution", default="1K", choices=["1K", "2K", "4K"])
    parser.add_argument("-d", "--dir", required=True)
    parser.add_argument("-p", "--prefix", default="logo-")
    parser.add_argument("--start", type=int, default=1)
    args = parser.parse_args()

    out_dir = Path(args.dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    batches = []
    remaining = args.count
    while remaining > 0:
        batches.append(min(PER_CALL, remaining))
        remaining -= batches[-1]

    def run(size):
        result = call(MODEL, {
            "prompt": args.prompt,
            "num_images": size,
            "aspect_ratio": args.ratio,
            "resolution": args.resolution,
            "output_format": "png",
            # One picture per round, so num_images really is the count.
            "limit_generations": True,
        })
        return [image["url"] for image in result.get("images", [])]

    with ThreadPoolExecutor(max_workers=3) as pool:
        urls = [url for batch in pool.map(run, batches) for url in batch]

    number = args.start
    saved = []
    for url in urls:
        while True:
            path = out_dir / f"{args.prefix}{number:02d}.png"
            number += 1
            if not path.exists():
                break
        download(url, path)
        saved.append(path)
        print(path)

    build_preview(out_dir)
    print(f"{len(saved)} saved. Preview: {out_dir / 'preview.html'}")


if __name__ == "__main__":
    main()
