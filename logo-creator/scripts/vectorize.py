#!/usr/bin/env python3
"""
Convert a raster logo to SVG with Recraft's vectorizer on fal.

Usage: python3 vectorize.py INPUT.png OUTPUT.svg

Recraft's limits: PNG, JPG or WEBP under 5 MB, each side between 256 and
4096 px. Vectorize the cropped PNG (with or without its background), not the
full-margin original.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _fal import call, data_uri, download  # noqa: E402

MODEL = "fal-ai/recraft/vectorize"
MAX_BYTES = 5 * 1024 * 1024


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, target = sys.argv[1], sys.argv[2]
    if Path(source).stat().st_size >= MAX_BYTES:
        sys.exit(f"{source} is over 5 MB; Recraft will reject it. Crop or downscale first.")
    result = call(MODEL, {"image_url": data_uri(source)})
    print(download(result["image"]["url"], target))


if __name__ == "__main__":
    main()
