#!/usr/bin/env python3
"""
Remove a logo's background with BiRefNet v2 on fal.

Usage: python3 remove_bg.py INPUT.png OUTPUT-nobg.png

Uses the Heavy general model at 2048px, which keeps thin strokes and the edges
of lettering cleaner than the default Light model.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _fal import call, data_uri, download  # noqa: E402

MODEL = "fal-ai/birefnet/v2"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, target = sys.argv[1], sys.argv[2]
    result = call(MODEL, {
        "image_url": data_uri(source),
        "model": "General Use (Heavy)",
        "operating_resolution": "2048x2048",
        "refine_foreground": True,
        "output_format": "png",
    })
    print(download(result["image"]["url"], target))


if __name__ == "__main__":
    main()
