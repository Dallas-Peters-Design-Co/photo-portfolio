# Cover pipeline

How a book cover goes from parts to a print file and a mockup, entirely on a
board. Built for the Unruly Chain series; nothing in it is specific to that
imprint except the defaults.

```
parts/  ──cover:seed──▶  Frame ──▶ Composite ──▶ Cover ──▶ Print wrap ──▶ Mockup
                                              └──▶ Trace (SVG)
                                                   │                        ▲
                                                   └────────────────────────┘
```

Every node right of the frame is rendered in the browser and stored by the
run, the way Composite always was — see `src/boards/canvas/finishers.ts` for
the table of them and `api/boards/[id]/run/capabilities.ts` for the server
side. Press Run once and the chain renders left to right in one pass.

## 1. Parts onto a board

```
pnpm cover:seed "<parts folder>" --variant poster --book "<book.json>"
```

`parts/` is a folder of full-frame PNGs with alpha plus an `index.json` that
names each part's role and where its pixels are. `book.json` is the book's
file from `_pipeline/schema/books/` in the project folder — title, subtitle,
author, print block — read as is. The script crops each one to
its box, uploads it, and makes a new board with a frame holding the parts in
stacking order, wired into the four nodes with the book's title, subtitle,
author, page count, paper and trim already filled in.

Type parts (`title-lockup`, `author-text`, `author-plate`) are left off the
frame on purpose: the Cover node sets those words itself. `--all-parts` puts
them on for a board that wants the PSD's exact lockup; clear the Cover's
title/author fields then.

Writes to whatever `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` in `.env` point
at. Every run makes a new board.

## 2. Composite

Renders the frame's contents where they sit. Set background to transparent for
a cover whose ground is one of the parts.

## 3. Cover

Takes the composite on `art`, applies the finishing stack (palette clamp,
halftone, grain, vignette) in one shader pass, and draws the type with real
font metrics from the Adobe Fonts kit. Poster puts the title on a band;
Horizon sets it over the art.

A Note wired into `words` supplies title / subtitle / author — three lines, or
JSON — and the node's own fields win over it.

## 4. Print wrap

Takes the Cover's output on `front`. Builds the KDP wrap at 300 dpi: back,
spine, front, 0.125" bleed, spine width from page count × paper thickness,
spine text only from 79 pages, a white barcode zone, and optional guides for
proofing. The maths is `src/boards/canvas/wrapLayout.ts` and is tested against
KDP's numbers for Centrifuge (312 pp cream 6×9 → 0.78" spine, 13.03 × 9.25").

`back` takes optional artwork for the back panel; `words` takes back-cover copy
from a Note (blank-line-separated paragraphs; a first short line without a
full stop is set as a hook). The `copy` field on the node wins over the wire.

**Download print PDF** is on the node's menu once it has rendered. It builds a
one-page PDF at the sheet's size with the TrimBox set, losslessly, in the
browser. That is the file KDP takes. Turn guides off first.

## 5. Mockup

Takes the Cover on `cover` — and the Print wrap on `wrap`, for templates
that show the back of the book — and draws them into one of the bought
Photoshop mockups from `src/templates`: the photograph, its shading and its
warp, not a model of a book. Pick the template on the node; the spine colour
is a setting where a template shows one, and the trim tells it where the
wrap's back panel is.

The templates are baked once with `scripts/bake-mockup.py` (needs
`pip install psd-tools numpy pillow scipy`) into `public/mockups/<id>/` —
`a.jpg`, `b.jpg`, `uv.png`, `template.json` — and listed in
`src/boards/canvas/mockupTemplate.ts` and `config/nodes/mockup.ts`. Re-bake
after editing a PSD; nothing else changes.

- Finished covers made elsewhere work too: drop the PNGs on the board, wire
  them (or a frame of them) into the Mockup's Cover port, pick a template,
  run. Many covers in are many mockups out, one per cover in wire order, the
  way Cover fans out. One wrap serves all of them. On a template that shows
  several books (three in a row, stacked, open and closed) each mockup leads
  with its own cover and the rest of the batch fills the other books.

## 6. Trace (optional)

Any picture on the board — a cover, a variation from Generate, a single part —
into a layered SVG, traced in the browser. The Vectorize tool sends the picture
to Recraft, which reduces it to a handful of flat fills with no colour control;
Trace has a **Colours** count (2–256), a **Detail** dial and a **Blur** for
taming halftone grain, and writes one `<path>` per colour so the file opens in
Affinity or Illustrator with real layers.

- 32 colours, balanced, no blur is the poster look and ~1.5 MB for the art.
- Raise colours to 64–96 to keep the spiral's gradients as visible bands;
  files grow to several MB. Blur 1–2 removes grain and shrinks them again.
- Trace at (px) caps the traced size; coordinates are scaled back so the SVG
  is the picture's own size.
- Many pictures wired in trace to many SVGs, like the Cover fan-out.

## Iterating

- Move a part on the frame, change a colour, retype the title: the run
  re-renders only what changed downstream. Renders are cleared on any edit —
  `placement.dropComposites` — so nothing stale is ever run.
- For variations of the art, put a Generate node (with the trained style) in
  front of the frame, or a Batch in front of the Cover, and the Cover fans out.
- Train a style from a frame of references with the frame menu's **Train**. A
  toast stays up while it runs and the model appears in Models when it lands.

## What is not on the board

- Fonts come from the Typekit kit in `index.html`. A face that is not in the
  kit renders in the fallback and says so in the console.
- The PSD itself. Parts are exported from it once (`parts/README.md` in the
  project folder says how) and the board is where they are iterated.
