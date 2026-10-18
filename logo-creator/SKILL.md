---
name: logo-creator
description: Create logos, brand marks, wordmarks, lettermarks, icons, favicons, emblems or mascots with AI. Use whenever the user wants a logo or mark designed, explored, iterated, or turned into clean SVG — including "make a logo for…", "explore some marks", "rebrand", "app icon", or "favicon".
---

# Logo Creator

Design logos the way a designer runs a first round: a tight brief, several distinct directions, a hard cull, then iteration on the few worth keeping. All model calls go through fal with one key.

## Two ways to run this

**1. In the app (preferred when the user is in dallaspeters.com admin):** Boards → **New logo board**. It builds the same pipeline on a board: Brief → Iterate (one direction per line) → Generate, plus Palette/Brand nodes and a Picks frame. Point the user there when they want to judge and rearrange visually; the board is the UI.

**2. From the shell (this skill's scripts):** when there is no app session, or the user wants files on disk. Everything below is this path.

## Prerequisites

- `FAL_API_KEY` (or `FAL_KEY`). Read from the environment, or from the nearest `.env.development.local` / `.env.local` / `.env` walking up from the current directory, so inside the dallaspeters.com repo it just works.
- Python 3 standard library for fal calls. Pillow for `crop_logo.py` and `contact_sheet.py`. To view SVG results: `pip install cairosvg`, or `rsvg-convert`, or macOS Quick Look (built in).
- `<skill_dir>` below is this skill's folder (`logo-creator/` in the repo).

## Models — pick deliberately

| `--model` | Model | Use for |
|---|---|---|
| `recraft` (default) | Recraft v4 Pro · Vector | Marks and symbols. Returns real SVG, so no tracing. |
| `ideogram` | Ideogram v3 | Anything with lettering: wordmarks, lettermarks, emblems with the name. Honours exact colours. |
| `recraft-fast` | Recraft v4.1 · Vector | Cheap first-round vector drafts. |
| `nano` | Nano Banana Pro | Last resort. Weak at marks; invents letters. |

Rule of thumb: run `recraft` for symbol directions and `ideogram` for type directions in the same round, rather than forcing one model to do both.

## Output location

```
.skill-archive/logo-creator/<yyyy-mm-dd>-<name>/
```
Gitignored. Copy approved finals wherever the user wants them.

## Workflow

### 1. Brief (one round of questions, then go)

Ask only what changes the output, in one message:
- Name, exactly as it should be spelled.
- What it's for and who it's for, in a sentence.
- Colours: hex values, a brand kit, or "you pick".
- Anything to avoid or include (existing marks, competitors, symbols).

Infer the rest. Don't ask about aspect ratio (logos are judged square first) or style (that's what directions are for). If the user already gave enough, skip the questions.

Write the brief as one line: `Logo for "<Name>", <what it is / who it's for>, <tone>`.

### 2. Generate: several directions in one go

Directions come from the app's own list (`src/boards/logo/logoStyles.ts`), so the skill and the logo board stay in step: `minimal`, `lettermark`, `wordmark`, `abstract`, `emblem`, `mascot`, `hand-drawn`, `pixel`.

```bash
D=.skill-archive/logo-creator/<date>-<name>
python3 <skill_dir>/scripts/generate.py "<brief>" -d $D --model recraft \
  --directions minimal,abstract -n 4 --colors "#1f4d2b,#f5efe0"
python3 <skill_dir>/scripts/generate.py "<brief>" -d $D --model ideogram \
  --directions lettermark,wordmark -n 4 --colors "#1f4d2b,#f5efe0"
```

Files land as `<direction>-NN.svg|png`; nothing is overwritten. Each run rebuilds `preview.html` (for the user) and `contact-sheet.png` (for you).

### 3. Review before showing anything (required)

Read `contact-sheet.png` yourself. Cut anything that:
- misspells or mangles the name, or adds letters/words that weren't asked for;
- is a picture or illustration rather than a mark (scenery, mockups, photos);
- won't survive at 32px (fine detail, thin strokes, more than ~3 colours);
- duplicates another candidate closely;
- uses gradients, shadows or 3D when the brief said flat.

Then show the user **only the survivors** — ideally 4–8 — by filename, each with one line on why it's worth keeping, and open `preview.html` for them (`open $D/preview.html`). Say how many you cut and why in one sentence. Never dump the whole batch unreviewed.

### 4. Iterate on the favourites

Ask which ones and what to push ("bolder", "drop the tree", "tighter kerning"). Fold that into the brief or pick the one direction that worked, and run again with a tag:

```bash
python3 <skill_dir>/scripts/generate.py "<refined brief>" -d $D --model ideogram \
  --directions lettermark -n 6 --tag v2
```

Review again (step 3) before showing. Two or three rounds is normal.

### 5. Finalize

- **Vector models (`recraft*`):** already SVG. Open it and check it has no white background rectangle if the user wants transparency; delete that `<rect>`/`<path>` if present.
- **Raster models (`ideogram`, `nano`):**
  ```bash
  python3 <skill_dir>/scripts/crop_logo.py lettermark-v2-03.png lettermark-v2-03-cropped.png
  python3 <skill_dir>/scripts/remove_bg.py lettermark-v2-03-cropped.png lettermark-v2-03-nobg.png
  python3 <skill_dir>/scripts/vectorize.py lettermark-v2-03-cropped.png lettermark-v2-03.svg
  ```
- Rebuild the sheet (`python3 <skill_dir>/scripts/contact_sheet.py $D`), check the SVG at small size, and confirm the name is spelled right before calling it done.

### 6. Deliver

List the final files (SVG, transparent PNG, cropped PNG), where they are, and copy them where the user asked. If they're working in the app, offer to drop the finals on a board or into a brand kit's logos.

## Prompting notes

- Say what it *is*, not adjectives: "a fox head built from three triangles" beats "clever modern fox logo".
- Name the exact text and nothing else; extra words invite extra lettering.
- One idea per mark. If the brief has two symbols, make them separate directions.
- For lettering, prefer Ideogram and keep the name short in the prompt, in quotes.

## References

- [references/styles.md](./references/styles.md) — longer style notes and prompt patterns.
- [examples/opc-logo-creation.md](./examples/opc-logo-creation.md) — example conversation from the original opc-skills version (images not included).
