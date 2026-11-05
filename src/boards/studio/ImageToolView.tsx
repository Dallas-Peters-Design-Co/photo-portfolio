import {
  Check,
  Copy,
  Download,
  ImageIcon,
  Plus,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { paletteFor } from "./chosenColors";
import { PresetBar } from "./PresetBar";
import { saveBlob, svgToPngBlob } from "./render";
import { newSeed } from "./rng";
import { StudioControls } from "./StudioControls";
import type { StudioFrame } from "./StudioPanel";
import { StudioPreview } from "./StudioPreview";
import { recipeFor, sizeIndexFor, sizesWith } from "./studioRecipe";
import { usePaintTiles } from "./TilePaint";
import { defaultsOf } from "./tools";
import type { ImageTool, StudioRecipe, StudioValues } from "./types";

/**
 * One image generator: live preview, size, its settings, and the ways out
 * (the board, PNG, SVG, CSS). Settings are kept per tool by the panel, so
 * switching tools and back keeps what was set.
 */

export const SIZES = [
  { h: 1080, label: "Square 1080", w: 1080 },
  { h: 1350, label: "Portrait 1080×1350", w: 1080 },
  { h: 1920, label: "Story 1080×1920", w: 1080 },
  { h: 1080, label: "Wide 1920×1080", w: 1920 },
  { h: 500, label: "Banner 1500×500", w: 1500 },
  { h: 2048, label: "Large square 2048", w: 2048 },
] as const;

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That picture couldn't be read"));
    img.src = url;
  });

export function ImageToolView({
  editing,
  frame,
  onAdd,
  onResize,
  onResizeReset,
  onValues,
  palette,
  tool,
  values: stored,
}: {
  /** A placed picture being changed: its settings, and where the result goes. */
  editing?: {
    onReplace: (file: File, recipe: StudioRecipe) => void;
    recipe: StudioRecipe;
  };
  /** Working for a frame in the editor: its size first, and a background button. */
  frame?: StudioFrame;
  onAdd: (file: File, recipe: StudioRecipe) => void;
  onResize?: (e: React.PointerEvent<HTMLElement>) => void;
  onResizeReset?: () => void;
  onValues: (values: StudioValues) => void;
  palette: string[];
  tool: ImageTool;
  values: StudioValues | undefined;
}) {
  const values = stored ?? defaultsOf(tool.params);
  const offered = frame?.size
    ? [
        {
          h: frame.size.h,
          label: `This frame ${frame.size.w}×${frame.size.h}`,
          w: frame.size.w,
        },
        ...SIZES,
      ]
    : SIZES;
  const sizes = sizesWith(offered, editing?.recipe);
  const [sizeIndex, setSizeIndex] = useState(() =>
    sizeIndexFor(sizes, editing?.recipe)
  );
  const size = sizes[sizeIndex] ?? SIZES[0];
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Where the picture came from, so the placed layer can be edited later.
  const [source, setSource] = useState<string | null>(
    editing?.recipe.image ?? null
  );
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // Picked as the selection in place: it goes back over the frame exactly.
  const [inPlace, setInPlace] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editing: the picture it was made from, fetched to a local copy so its
  // pixels can be read (ImagePick does the same).
  const startImage = editing?.recipe.image;
  useEffect(() => {
    if (!startImage) {
      return;
    }
    let alive = true;
    fetch(startImage, { mode: "cors" })
      .then((res) => res.blob())
      .then((blob) => alive && setImageUrl(URL.createObjectURL(blob)))
      .catch(() => toast.error("The picture it was made from couldn't load"));
    return () => {
      alive = false;
    };
  }, [startImage]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    let alive = true;
    loadImage(imageUrl)
      .then((img) => alive && setImage(img))
      .catch((e: Error) => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, [imageUrl]);

  const set = (key: string, value: boolean | number | string) =>
    onValues({ ...values, [key]: value });
  const paint = usePaintTiles({
    keyName: image
      ? (tool.params.find((p) => p.type === "tiles")?.key ?? null)
      : null,
    onChange: set,
    size,
    values,
  });

  // A tool with its own colour pickers draws with those, not the brand's set.
  const paletteKey = paletteFor(tool.params, values, palette).join();
  const ctx = useMemo(
    () => ({
      height: size.h,
      image,
      palette: paletteKey.split(","),
      width: size.w,
    }),
    [size, image, paletteKey]
  );
  // Built when it's wanted (the board, a download), not on every change:
  // the preview draws itself (StudioPreview).
  const svgNow = () => tool.render(values, ctx);
  const sources = useMemo(
    () => tool.sources?.(values, ctx) ?? [],
    [tool, values, ctx]
  );
  const css = tool.css?.(values, ctx) ?? null;
  const fileName = `${tool.id}-${size.w}x${size.h}`;

  const shuffle = () => {
    if (tool.params.some((p) => p.type === "seed")) {
      set("seed", newSeed());
    }
  };

  const where = frame ? "frame" : "board";
  const add = async (asBackground = false) => {
    try {
      const svg = svgNow();
      const file = tool.vector
        ? new File([svg], `${fileName}.svg`, { type: "image/svg+xml" })
        : new File(
            [await svgToPngBlob(svg, size.w, size.h)],
            `${fileName}.png`,
            {
              type: "image/png",
            }
          );
      const recipe = await recipeFor(tool.id, values, size, {
        // Only when the picture is in use (Systems Flow can work from text).
        local: tool.params.some(
          (p) => p.type === "image" && (!p.when || p.when(values))
        )
          ? imageUrl
          : null,
        source,
      });
      if (editing && !asBackground) {
        editing.onReplace(file, recipe);
        toast.success(`${tool.name} updated`);
        return;
      }
      if (asBackground && frame) {
        frame.onBackground(file, recipe);
        toast.success(`${tool.name} set as the frame's background`);
        return;
      }
      // Made at the frame's size (or from the selection in place): it goes
      // over the whole frame, exactly, rather than fitted inside it.
      const frameSized = frame?.size?.w === size.w && frame?.size?.h === size.h;
      if ((inPlace || frameSized) && frame?.onOver) {
        frame.onOver(file, recipe);
        toast.success(`${tool.name} placed over the whole frame`);
        return;
      }
      onAdd(file, recipe);
      toast.success(`${tool.name} added to the ${where}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    }
  };

  return (
    <>
      <div {...paint.previewProps}>
        <StudioPreview ctx={ctx} tool={tool} values={values} />
        {paint.overlay}
        {onResize ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: a pointer drag handle; the preview works at its default size
          <span
            aria-hidden
            className="studio__corner studio__corner--preview"
            onDoubleClick={onResizeReset}
            onPointerDown={onResize}
            title="Drag to resize the preview and panel · double-click to reset"
          />
        ) : null}
      </div>
      {paint.bar}
      <p className="studio__blurb">{tool.blurb}</p>
      <label className="studio__field">
        <span>Size</span>
        <select
          className="studio__input"
          onChange={(e) => setSizeIndex(Number(e.target.value))}
          value={sizeIndex}
        >
          {sizes.map((s, i) => (
            <option key={s.label} value={i}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <PresetBar
        defaults={defaultsOf(tool.params)}
        looks={tool.looks}
        onLoad={onValues}
        tool={tool.id}
        values={values}
      />
      <StudioControls
        fromFrame={
          frame?.snapshot
            ? {
                label: frame.selectionCount
                  ? `Selection (${frame.selectionCount})`
                  : "Whole frame",
                take: frame.snapshot,
                takeInPlace: frame.snapshotInPlace,
              }
            : undefined
        }
        image={imageUrl}
        onChange={set}
        onImage={(url, from, taken) => {
          setImageUrl(url);
          setSource(from ?? null);
          setInPlace(Boolean(taken));
          // In place: made at the frame's own size, so it lines up exactly.
          if (taken && frame?.size) {
            const at = sizes.findIndex(
              (o) => o.w === frame.size?.w && o.h === frame.size?.h
            );
            setSizeIndex(Math.max(0, at));
          }
        }}
        palette={palette}
        params={tool.params}
        sources={sources}
        values={values}
      />
      <div className="studio__actions">
        <button
          className="studio__button studio__button--primary"
          onClick={() => void add()}
          type="button"
        >
          {editing ? (
            <>
              <RefreshCw size={14} /> Update the layer
            </>
          ) : (
            <>
              <Plus size={14} /> Add to {where}
            </>
          )}
        </button>
        {frame ? (
          <button
            className="studio__button"
            onClick={() => void add(true)}
            title="Fills the frame, behind every layer"
            type="button"
          >
            <ImageIcon size={14} /> Set as background
          </button>
        ) : null}
        {tool.params.some((p) => p.type === "seed") ? (
          <button className="studio__button" onClick={shuffle} type="button">
            <Shuffle size={14} /> Shuffle
          </button>
        ) : null}
        <button
          className="studio__button"
          onClick={() =>
            void svgToPngBlob(svgNow(), size.w, size.h).then((b) =>
              saveBlob(b, `${fileName}.png`)
            )
          }
          type="button"
        >
          <Download size={14} /> PNG
        </button>
        <button
          className="studio__button"
          onClick={() =>
            saveBlob(
              new Blob([svgNow()], { type: "image/svg+xml" }),
              `${fileName}.svg`
            )
          }
          type="button"
        >
          <Download size={14} /> SVG
        </button>
        {css ? (
          <button
            className="studio__button"
            onClick={() => {
              void navigator.clipboard?.writeText(css);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            type="button"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} CSS
          </button>
        ) : null}
      </div>
    </>
  );
}
