import {
  Check,
  Copy,
  Download,
  GripVertical,
  Plus,
  Shuffle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveBrand } from "../brand/ActiveBrand";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { saveBlob, svgToPngBlob } from "./render";
import { newSeed } from "./rng";
import { StudioControls } from "./StudioControls";
import { DEFAULT_PALETTE, defaultsOf, IMAGE_TOOLS } from "./tools";
import type { ImageTool, StudioValues } from "./types";
import "./Studio.css";

/**
 * The Studio: generators for backgrounds, patterns, shapes and gradients,
 * in the brand's colours. Each is previewed live and lands on the board as a
 * PNG at the size chosen, or downloads as PNG or SVG.
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

export function StudioPanel({
  initialTool,
  onAdd,
  onClose,
}: {
  initialTool: string;
  /** Places the file on the board. */
  onAdd: (file: File) => void;
  onClose: () => void;
}) {
  const brand = useActiveBrand();
  const kitPalette = brand?.kit?.resolvedDoc.palette.map((p) => p.value) ?? [];
  const palette = kitPalette.length > 0 ? kitPalette : DEFAULT_PALETTE;
  const drag = useDraggablePanel("board-studio:position");
  const [toolId, setToolId] = useState(initialTool);
  const tool: ImageTool =
    IMAGE_TOOLS.find((t) => t.id === toolId) ?? (IMAGE_TOOLS[0] as ImageTool);
  const [byTool, setByTool] = useState<Record<string, StudioValues>>({});
  const values = byTool[tool.id] ?? defaultsOf(tool.params);
  const [sizeIndex, setSizeIndex] = useState(0);
  const size = SIZES[sizeIndex] ?? SIZES[0];
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setToolId(initialTool), [initialTool]);
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
    setByTool((was) => ({ ...was, [tool.id]: { ...values, [key]: value } }));

  const paletteKey = palette.join();
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

  const add = async () => {
    try {
      const png = await svgToPngBlob(svg, size.w, size.h);
      onAdd(new File([png], `${fileName}.png`, { type: "image/png" }));
      toast.success(`${tool.name} added to the board`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    }
  };

  return (
    <aside
      aria-label="Studio"
      className={drag.dragging ? "studio studio--dragging" : "studio"}
      style={drag.style}
    >
      <header className="studio__head" {...drag.handleProps}>
        <GripVertical aria-hidden className="studio__grip" size={14} />
        <strong>Studio</strong>
        <span className="studio__brand">
          {brand?.kit ? `in ${brand.kit.name}` : "no brand chosen"}
        </span>
        <button
          aria-label="Close the Studio"
          className="studio__icon"
          onClick={onClose}
          type="button"
        >
          <X size={15} />
        </button>
      </header>
      <div className="studio__body">
        <nav className="studio__tools">
          {IMAGE_TOOLS.map((t) => (
            <button
              aria-pressed={t.id === tool.id}
              key={t.id}
              onClick={() => setToolId(t.id)}
              title={t.blurb}
              type="button"
            >
              {t.name}
            </button>
          ))}
        </nav>
        <section className="studio__main">
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
              {SIZES.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <StudioControls
            image={imageUrl}
            onChange={set}
            onImage={(file) => setImageUrl(URL.createObjectURL(file))}
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
              <Plus size={14} /> Add to board
            </button>
            {tool.params.some((p) => p.type === "seed") ? (
              <button
                className="studio__button"
                onClick={shuffle}
                type="button"
              >
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
        </section>
      </div>
    </aside>
  );
}
