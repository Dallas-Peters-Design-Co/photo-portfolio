import { Check, Copy, Download, ImageIcon, Plus, Shuffle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { paletteFor } from "./chosenColors";
import { saveBlob, svgToPngBlob } from "./render";
import { newSeed } from "./rng";
import { StudioControls } from "./StudioControls";
import type { StudioFrame } from "./StudioPanel";
import { defaultsOf } from "./tools";
import type { ImageTool, StudioValues } from "./types";

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
  frame,
  onAdd,
  onValues,
  palette,
  tool,
  values: stored,
}: {
  /** Working for a frame in the editor: its size first, and a background button. */
  frame?: StudioFrame;
  onAdd: (file: File) => void;
  onValues: (values: StudioValues) => void;
  palette: string[];
  tool: ImageTool;
  values: StudioValues | undefined;
}) {
  const values = stored ?? defaultsOf(tool.params);
  const sizes = frame?.size
    ? [
        {
          h: frame.size.h,
          label: `This frame ${frame.size.w}×${frame.size.h}`,
          w: frame.size.w,
        },
        ...SIZES,
      ]
    : SIZES;
  const [sizeIndex, setSizeIndex] = useState(0);
  const size = sizes[sizeIndex] ?? SIZES[0];
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);

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
  const svg = useMemo(() => tool.render(values, ctx), [tool, values, ctx]);
  const preview = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg]
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
      const png = await svgToPngBlob(svg, size.w, size.h);
      const file = new File([png], `${fileName}.png`, { type: "image/png" });
      if (asBackground && frame) {
        frame.onBackground(file);
        toast.success(`${tool.name} set as the frame's background`);
        return;
      }
      onAdd(file);
      toast.success(`${tool.name} added to the ${where}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    }
  };

  return (
    <>
      <div className="studio__preview">
        <img
          alt={`${tool.name} preview`}
          height={size.h}
          src={preview}
          width={size.w}
        />
      </div>
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
      <StudioControls
        image={imageUrl}
        onChange={set}
        onImage={setImageUrl}
        palette={palette}
        params={tool.params}
        values={values}
      />
      <div className="studio__actions">
        <button
          className="studio__button studio__button--primary"
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to {where}
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
            void svgToPngBlob(svg, size.w, size.h).then((b) =>
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
              new Blob([svg], { type: "image/svg+xml" }),
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
