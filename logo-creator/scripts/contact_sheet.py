#!/usr/bin/env python3
"""
One numbered PNG of every logo in a folder, for an agent to look at.

Usage: python3 contact_sheet.py OUT_DIR

Exists because an agent can view a PNG but not an SVG or an HTML page. The
review step in SKILL.md reads this image before showing the user anything.

SVGs are rasterised with the first renderer available: cairosvg (pip),
rsvg-convert, or macOS Quick Look (qlmanage). Needs Pillow.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

TILE = 256
LABEL = 22
COLUMNS = 5


def _raster_svg(svg: Path, size: int) -> Image.Image:
    try:
        import cairosvg  # type: ignore

        with tempfile.NamedTemporaryFile(suffix=".png") as out:
            cairosvg.svg2png(url=str(svg), write_to=out.name, output_width=size, output_height=size)
            return Image.open(out.name).convert("RGBA")
    except ImportError:
        pass
    if shutil.which("rsvg-convert"):
        png = subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), str(svg)],
            capture_output=True,
            check=True,
        ).stdout
        with tempfile.NamedTemporaryFile(suffix=".png") as out:
            Path(out.name).write_bytes(png)
            return Image.open(out.name).convert("RGBA")
    if shutil.which("qlmanage"):
        with tempfile.TemporaryDirectory() as folder:
            subprocess.run(
                ["qlmanage", "-t", "-s", str(size), "-o", folder, str(svg)],
                capture_output=True,
                check=True,
            )
            made = next(Path(folder).glob("*.png"))
            return Image.open(made).convert("RGBA")
    raise RuntimeError("no SVG renderer: pip install cairosvg, or install librsvg")


def _load(path: Path) -> Image.Image:
    image = _raster_svg(path, TILE) if path.suffix.lower() == ".svg" else Image.open(path).convert("RGBA")
    image.thumbnail((TILE, TILE))
    return image


def build_sheet(out_dir) -> Path:
    out_dir = Path(out_dir)
    files = sorted(
        p
        for p in out_dir.iterdir()
        if p.suffix.lower() in {".png", ".svg"} and p.name != "contact-sheet.png"
    )
    if not files:
        raise RuntimeError("no logos in the folder")
    rows = (len(files) + COLUMNS - 1) // COLUMNS
    sheet = Image.new("RGB", (COLUMNS * TILE, rows * (TILE + LABEL)), "white")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(files):
        x = (index % COLUMNS) * TILE
        y = (index // COLUMNS) * (TILE + LABEL)
        try:
            tile = _load(path)
            sheet.paste(tile, (x + (TILE - tile.width) // 2, y + (TILE - tile.height) // 2), tile)
        except Exception as error:
            draw.text((x + 8, y + TILE // 2), f"unreadable: {error}"[:40], fill="red")
        draw.rectangle([x, y, x + TILE - 1, y + TILE + LABEL - 1], outline="#dddddd")
        draw.text((x + 6, y + TILE + 4), path.stem, fill="black")
    target = out_dir / "contact-sheet.png"
    sheet.save(target)
    return target


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(build_sheet(sys.argv[1]))
