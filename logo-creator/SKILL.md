---
name: logo-creator
description: Create logos using AI image generation on fal. Discuss style/ratio, generate variations, iterate with user feedback, crop, remove background, and export as SVG. Use when user wants to create a logo, icon, favicon, brand mark, mascot, emblem, or design a logo.
---

# Logo Creator Skill

Create logos through AI image generation with an iterative design process. Every model call goes through fal.ai with one key.

## Prerequisites

**One API key:** `FAL_API_KEY` (or `FAL_KEY`). The scripts read it from the environment, or from the nearest `.env.development.local` / `.env.local` / `.env` walking up from the current directory, so running from inside the dallaspeters.com repo needs no setup.

**Models used (all on fal):**
| Step | Model |
|------|-------|
| Generate | `fal-ai/nano-banana-pro` (Gemini 3 Pro Image) |
| Remove background | `fal-ai/birefnet/v2` |
| Vectorize to SVG | `fal-ai/recraft/vectorize` |

**Python:** the fal scripts use the standard library only. `crop_logo.py` needs Pillow and numpy (`pip install Pillow numpy`).

`<skill_dir>` below is this skill's folder (in the dallaspeters.com repo: `logo-creator/`).

## File Output Location

```
.skill-archive/logo-creator/<yyyy-mm-dd-summaryname>/
```

**Example:**
```
.skill-archive/logo-creator/2026-01-18-opc-logo/
  logo-01.png … logo-20.png
  logo-09-v01.png …
  logo-09-cropped.png
  logo-09-nobg.png
  logo-09.svg
  preview.html
```

- Current date as `yyyy-mm-dd`, then a short kebab-case name for the project.
- Keep every variation and iteration in the same folder.
- `.skill-archive/` is gitignored. Copy the approved final files to wherever the user wants them.

## Workflow

### Step 1: Discovery & Requirements

Before generating, ask about:
1. **Project/Brand name** - What is the logo for?
2. **Style** - See [references/styles.md](./references/styles.md):
   pixel art, minimalist/flat, 3D/isometric, hand-drawn, mascot, monogram/lettermark, abstract/geometric
3. **Aspect ratio** - Default `1:1`. Others: `16:9` (headers), `4:3`, `2:3`, etc.
4. **Colors** - Monochrome, specific brand colors, or let the model decide
5. **References** - Existing logos or styles to point at

**Wait for user confirmation before generating.**

### Step 2: Generate Variations

```bash
python3 <skill_dir>/scripts/generate.py "{style} logo for {brand}, {description}, {colors}" \
  -n 20 --ratio 1:1 -d .skill-archive/logo-creator/<date-name> -p logo-
```

- Runs in batches of 4, three at a time. 20 logos takes about a minute.
- Never overwrites: numbering skips past files that already exist.
- `--resolution 2K` for finals that need more detail (default `1K` is fine for exploring).

**Prompt tips:** style keywords ("pixel art", "flat design"), colors ("black on white"), context ("tech startup"), format ("icon", "emblem", "lettermark"). Ask for a plain white background; it makes background removal cleaner.

### Step 3: Preview

`generate.py` writes `preview.html` in the output folder automatically, listing every PNG and SVG there, with light / dark / transparent backgrounds. Open it:

```bash
open .skill-archive/logo-creator/<date-name>/preview.html
```

To rebuild it by hand after adding files: `python3 <skill_dir>/scripts/preview.py <dir>`.

### Step 4: Iterate

Ask which numbers they like, what they like about them, and what to change. Then generate more of the favorites:

```bash
python3 <skill_dir>/scripts/generate.py "{refined prompt}" \
  -n 10 -d .skill-archive/logo-creator/<date-name> -p logo-05-v
```

That produces `logo-05-v01.png`, `logo-05-v02.png`, … and refreshes the preview. Repeat until they pick a final.

### Step 5: Finalize

```bash
# 5a. Trim whitespace to a tight square
python3 <skill_dir>/scripts/crop_logo.py logo-09.png logo-09-cropped.png

# 5b. Remove background (BiRefNet Heavy, 2048px)
python3 <skill_dir>/scripts/remove_bg.py logo-09-cropped.png logo-09-nobg.png

# 5c. Vectorize (Recraft; input must be under 5 MB, sides 256–4096px)
python3 <skill_dir>/scripts/vectorize.py logo-09-cropped.png logo-09.svg
```

Rebuild the preview afterwards to check the transparent PNG and SVG on dark and checkerboard backgrounds.

### Step 6: Deliver

```
## Final Logo Assets

| File | Description |
|------|-------------|
| logo-09.png | Original |
| logo-09-cropped.png | No margins, 1:1 |
| logo-09-nobg.png | Transparent background |
| logo-09.svg | Vector (scalable) |

Saved to: .skill-archive/logo-creator/<date-name>/
```

Copy the finals to wherever the user wants them.

## Quick Reference

### Prompt Patterns

**Pixel Art:**
```
Pixel art {subject} logo, 8-bit retro style, black pixels on white background, {size}x{size} grid, minimalist icon
```

**Minimalist:**
```
Minimalist {subject} logo, flat design, clean lines, {color} on white, simple geometric shapes
```

**Mascot:**
```
Cute {animal/character} mascot logo, friendly expression, {style} style, {colors}, suitable for brand icon
```

**Lettermark:**
```
Letter "{letter}" logo, modern typography, {style} design, {colors}, clean professional look
```

### Aspect Ratios

`1:1` (default), `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `4:5`, `3:4`, `2:3`, `9:16`, `auto`

## References

- [references/styles.md](./references/styles.md) - Style guide with prompt examples
- [examples/opc-logo-creation.md](./examples/opc-logo-creation.md) - Example conversation (from the original opc-skills version; its images aren't included)
