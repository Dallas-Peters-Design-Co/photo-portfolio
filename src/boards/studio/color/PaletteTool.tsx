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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorWell } from "../../ColorWell";
import { isTyping } from "../../hooks/isTyping";
import type { StudioComposition } from "../composition";
import { ImagePick } from "../ImagePick";
import {
  generatePalette,
  HARMONIES,
  type Harmony,
  inkOn,
  paletteFromUrl,
} from "./harmony";
import { paletteComposition } from "./paletteComposition";
import { colorSwatchSvg } from "./swatches";
import { useKitPalette } from "./useKitPalette";

/**
 * Palette Generator, after Coolors: press Space for a new palette, lock the
 * colours worth keeping, pick a harmony, or pull one from a photo. Save it as
 * the brand's palette, or put it on the board.
 */

const MIN = 2;
const MAX = 8;
const START = 5;
const PALETTE_ROLES = [
  "background",
  "ink",
  "surface",
  "accent",
  "button",
  "text",
  "border",
  "muted",
] as const;

export function PaletteTool({
  onAddMany,
  onAdd,
  onAddComposition,
  rand = Math.random,
  selectedImage,
}: {
  onAddMany?: (files: File[]) => void;
  onAdd: (file: File) => void;
  /** Places the palette as vector swatches in a frame (paletteComposition). */
  onAddComposition?: (composition: StudioComposition) => void;
  /** Injectable for tests. */
  rand?: () => number;
  /** The picture selected on the board, offered first. */
  selectedImage?: string | null;
}) {
  const { entries, kit, kits, saveTo, saving } = useKitPalette();
  const [harmony, setHarmony] = useState<Harmony>("random");
  const [colors, setColors] = useState<string[]>(() =>
    entries.length > 0
      ? entries.slice(0, MAX).map((e) => e.value)
      : generatePalette(new Array(START).fill(null), "random", rand)
  );
  const [roles, setRoles] = useState<string[]>(() =>
    entries.slice(0, MAX).map((entry) => entry.role)
  );
  const [targetKitId, setTargetKitId] = useState(kit?.id ?? "");
  const targetKit = kits.find((candidate) => candidate.id === targetKitId);
  const targetEntries = targetKit?.resolvedDoc.palette ?? entries;
  const [locked, setLocked] = useState<boolean[]>(() =>
    new Array(MAX).fill(false)
  );
  const [history, setHistory] = useState<string[][]>([]);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!kits.some((candidate) => candidate.id === targetKitId)) {
      setTargetKitId(kit?.id ?? kits[0]?.id ?? "");
    }
  }, [kit?.id, kits, targetKitId]);

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
        !isTyping(e.target) &&
        // The Harmony menu's trigger is a button now, not a <select>; Space
        // on it opens the menu, as it did before.
        !(
          e.target instanceof HTMLElement &&
          e.target.closest("[data-slot='select-trigger']")
        )
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
      const found = await paletteFromUrl(url, colors.length);
      if (found.length > 0) {
        replace(found);
        setLocked(new Array(MAX).fill(false));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read it");
    }
  };

  const add = () => {
    if (onAddComposition) {
      onAddComposition(paletteComposition(colors, roles));
      toast.success(
        `${colors.length} colour swatch${colors.length === 1 ? "" : "es"} added to the board`
      );
      return;
    }
    const files = colors.map(
      (color, index) =>
        new File(
          [colorSwatchSvg(color)],
          `palette-${index + 1}-${color.slice(1)}.svg`,
          {
            type: "image/svg+xml",
          }
        )
    );
    if (onAddMany) {
      onAddMany(files);
    } else {
      for (const file of files) {
        onAdd(file);
      }
    }
    toast.success(
      `${files.length} color SVG${files.length === 1 ? "" : "s"} added to the board`
    );
  };

  const lock = (i: number) =>
    setLocked((was) => was.map((l, k) => (k === i ? !l : l)));

  const remove = (i: number) => {
    replace(colors.filter((_, k) => k !== i));
    setLocked((was) => [...was.filter((_, k) => k !== i), false]);
    setRoles((was) => was.filter((_, k) => k !== i));
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
            <ColorWell
              alpha={false}
              label={`Colour ${i + 1}`}
              onChange={(hex) =>
                setColors((was) => was.map((v, k) => (k === i ? hex : v)))
              }
              value={c}
            />
            <select
              aria-label={`Role for colour ${i + 1}`}
              className="studio-palette__role"
              onChange={(event) =>
                setRoles((was) =>
                  Array.from({ length: colors.length }, (_, index) =>
                    index === i ? event.target.value : (was[index] ?? "")
                  )
                )
              }
              value={roles[i] ?? ""}
            >
              <option value="">Unassigned</option>
              {[
                ...new Set([...PALETTE_ROLES, ...(roles[i] ? [roles[i]] : [])]),
              ].map((role) => (
                <option key={role} value={role}>
                  {role[0]?.toUpperCase()}
                  {role.slice(1)}
                </option>
              ))}
            </select>
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
        {kits.length > 0 ? (
          <div className="studio__field">
            <span>Brand kit</span>
            <Select
              onValueChange={(next) => {
                if (next !== null) {
                  setTargetKitId(next);
                }
              }}
              value={targetKitId}
            >
              <SelectTrigger aria-label="Brand kit" size="sm" tone="board">
                <SelectValue placeholder="Choose a brand kit" />
              </SelectTrigger>
              <SelectContent>
                {kits.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="studio__field">
          <span>Harmony</span>
          <Select
            items={HARMONIES}
            onValueChange={(next) => {
              if (next !== null) {
                setHarmony(next as Harmony);
              }
            }}
            value={harmony}
          >
            <SelectTrigger aria-label="Harmony" size="sm" tone="board">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HARMONIES.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ImagePick
          label="From a picture"
          onPick={(url) => void fromPhoto(url)}
          selectedImage={selectedImage}
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
        {targetKit ? (
          <button
            className="studio__button"
            disabled={saving}
            onClick={() => void saveTo(targetKit.id, colors, roles)}
            title="Saves a new version of the kit; the old palette stays in its history"
            type="button"
          >
            <Save size={14} /> Save to {targetKit.name}
          </button>
        ) : null}
        {targetEntries.length > 0 ? (
          <button
            className="studio__button"
            onClick={() => {
              const palette = targetEntries.slice(0, MAX);
              replace(palette.map((entry) => entry.value));
              setRoles(palette.map((entry) => entry.role));
            }}
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
