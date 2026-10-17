#!/usr/bin/env python3
"""
Build preview.html for a folder of logos.

Usage: python3 preview.py OUT_DIR

Lists every PNG and SVG in the folder, numbered by filename, on light, dark
and checkerboard backgrounds so transparency and contrast both show. Run again
whenever files are added; generate.py does it automatically.
"""

import html
import sys
from pathlib import Path

TEMPLATE = Path(__file__).parent.parent / "templates" / "preview.html"


def build_preview(out_dir):
    out_dir = Path(out_dir)
    files = sorted(
        p for p in out_dir.iterdir()
        if p.suffix.lower() in {".png", ".svg"} and p.name != "preview.html"
    )
    tiles = "\n".join(
        f'<figure class="tile"><img src="{html.escape(p.name)}" alt="" loading="lazy">'
        f"<figcaption>{html.escape(p.stem)}</figcaption></figure>"
        for p in files
    )
    page = TEMPLATE.read_text()
    page = page.replace("{{TITLE}}", html.escape(out_dir.name))
    page = page.replace("{{COUNT}}", str(len(files)))
    page = page.replace("{{TILES}}", tiles)
    target = out_dir / "preview.html"
    target.write_text(page)
    return target


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(build_preview(sys.argv[1]))
