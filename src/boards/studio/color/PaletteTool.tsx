import {
  Copy,
  Lock,
  LockOpen,
  Plus,
  Save,
  Shuffle,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { isTyping } from "../../hooks/isTyping";
import { ImagePick } from "../ImagePick";
import { svgToPngBlob } from "../render";
import {
  generatePalette,
  HARMONIES,
  type Harmony,
  inkOn,
  paletteFromImage,
} from "./harmony";
import { swatchesSvg } from "./swatches";
import { useKitPalette } from "./useKitPalette";

/**
 * Palette Generator, after Coolors: press Space for a new palette, lock the
 * colours worth keeping, pick a harmony, or pull one from a photo. Save it as
 * the brand's palette, or put it on the board.
 */

const MIN = 2;
const MAX = 8;
const START = 5;

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That picture couldn't be read"));
    img.src = url;
  });

export function PaletteTool({
  onAdd,
  rand = Math.random,
}: {
  onAdd: (file: File) => void;
  /** Injectable for tests. */
  rand?: () => number;
}) {
  const { entries, kit, save, saving } = useKitPalette();
  const [harmony, setHarmony] = useState<Harmony>("random");
  const [colors, setColors] = useState<string[]>(() =>
    entries.length > 0
      ? entries.slice(0, MAX).map((e) => e.value)
      : generatePalette(new Array(START).fill(null), "random", rand)
  );
  const [locked, setLocked] = useState<boolean[]>(() =>
    new Array(MAX).fill(false)
  );
  const [history, setHistory] = useState<string[][]>([]);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  const replace = (next: string[]) => {
    setHistory((was) => [...was.slice(-30), colors]);
    setColors(next);
  };

  const generate = () =>
    replace(
      generatePalette(
        colors.map((c, i) => (locked[i] ? c : null)),
        harmony,
        rand
      )
    );

  const back = () => {
    const prev = history.at(-1);
    if (prev) {
      setColors(prev);
      setHistory((was) => was.slice(0, -1));
    }
  };

  // Space is the board's pan key; while focus is in this tool it means
  // "another palette" instead. Caught on the way down, before the board's.
  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        root.current?.contains(document.activeElement) &&
        !isTyping(e.target)
      ) {
        e.preventDefault();
        e.stopPropagation();
        generateRef.current();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  const fromPhoto = async (url: string) => {
    try {
      const img = await loadImage(url);
      const found = paletteFromImage(img, colors.length);
      if (found.length > 0) {
        replace(found);
        setLocked(new Array(MAX).fill(false));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read it");
    }
  };

  const add = async () => {
    const { h, svg, w } = swatchesSvg([{ colors }]);
    const png = await svgToPngBlob(svg, w, h);
    onAdd(new File([png], "palette.png", { type: "image/png" }));
    toast.success("Palette added to the board");
  };

  const lock = (i: number) =>
    setLocked((was) => was.map((l, k) => (k === i ? !l : l)));

  const remove = (i: number) => {
    replace(colors.filter((_, k) => k !== i));
    setLocked((was) => [...was.filter((_, k) => k !== i), false]);
  };

  return (
    <div className="studio-palette-tool" ref={root}>
      <div className="studio-palette">
        {colors.map((c, i) => (
          <div
            className="studio-palette__swatch"
            // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
            key={i}
            style={{ background: c, color: inkOn(c) }}
          >
            <button
              aria-label={locked[i] ? `Unlock ${c}` : `Lock ${c}`}
              aria-pressed={locked[i]}
              className="studio-palette__tool"
              onClick={() => lock(i)}
              type="button"
            >
              {locked[i] ? <Lock size={15} /> : <LockOpen size={15} />}
            </button>
            {colors.length > MIN ? (
              <button
                aria-label={`Remove ${c}`}
                className="studio-palette__tool"
                onClick={() => remove(i)}
                type="button"
              >
                <X size={15} />
              </button>
            ) : null}
            <input
              aria-label={`Colour ${i + 1}`}
              className="studio-palette__well"
              onChange={(e) =>
                setColors((was) =>
                  was.map((v, k) => (k === i ? e.target.value : v))
                )
              }
              type="color"
              value={c}
            />
            <button
              className="studio-palette__hex"
              onClick={() => {
                void navigator.clipboard?.writeText(c);
                toast.success(`${c} copied`);
              }}
              type="button"
            >
              {c.slice(1).toUpperCase()}
            </button>
          </div>
        ))}
        {colors.length < MAX ? (
          <button
            aria-label="Add a colour"
            className="studio-palette__more"
            onClick={() =>
              replace(generatePalette([...colors, null], harmony, rand))
            }
            type="button"
          >
            <Plus size={16} />
          </button>
        ) : null}
      </div>
      <p className="studio__blurb">
        Press Space for a new palette. Locked colours stay put, and the harmony
        turns around the first of them.
      </p>
      <div className="studio__controls">
        <label className="studio__field">
          <span>Harmony</span>
          <select
            className="studio__input"
            onChange={(e) => setHarmony(e.target.value as Harmony)}
            value={harmony}
          >
            {HARMONIES.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
        <ImagePick
          label="From a picture"
          onPick={(url) => void fromPhoto(url)}
        />
      </div>
      <div className="studio__actions">
        <button
          className="studio__button studio__button--primary"
          onClick={generate}
          ref={first}
          type="button"
        >
          <Shuffle size={14} /> Generate
        </button>
        <button
          className="studio__button"
          disabled={history.length === 0}
          onClick={back}
          type="button"
        >
          <Undo2 size={14} /> Back
        </button>
        {kit ? (
          <button
            className="studio__button"
            disabled={saving}
            onClick={() => void save(colors)}
            title="Saves a new version of the kit; the old palette stays in its history"
            type="button"
          >
            <Save size={14} /> Save to {kit.name}
          </button>
        ) : null}
        {entries.length > 0 ? (
          <button
            className="studio__button"
            onClick={() => replace(entries.slice(0, MAX).map((e) => e.value))}
            type="button"
          >
            Brand palette
          </button>
        ) : null}
        <button
          className="studio__button"
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to board
        </button>
        <button
          className="studio__button"
          onClick={() => {
            void navigator.clipboard?.writeText(colors.join(", "));
            toast.success("Hex values copied");
          }}
          type="button"
        >
          <Copy size={14} /> Hex
        </button>
      </div>
    </div>
  );
}
