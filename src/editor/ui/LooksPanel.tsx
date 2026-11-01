import { useState } from "react";
import {
  LOOK_FAMILIES,
  type Look,
  type LookFamily,
  looksInFamily,
} from "../presets";
import { BRAND_FAMILY, SAVED_FAMILY, SAVED_LOOK_FAMILY } from "../savedLooks";
import { EditorSlider } from "./EditorSlider";
import { SavedLooksTab } from "./SavedLooksTab";

/** The two tabs ahead of the built-in families: your own looks, and brands'. */
const EXTRA_FAMILIES: LookFamily[] = [
  SAVED_LOOK_FAMILY,
  {
    color: "#1f2a37",
    contrastColor: "#ffffff",
    description: "Each brand kit's look, at the kit's strength",
    id: BRAND_FAMILY,
    letter: "B",
    name: "Brands",
  },
];

/**
 * The look strip: a family rail carrying each family's signature color, the
 * eight looks inside the open family, then a strength slider.
 */
export function LooksPanel({
  active,
  strength,
  onChoose,
  onStrength,
  savedLooks = [],
  brandLooks = [],
  canSave = false,
  onSave,
  onDelete,
}: {
  active: Look | null;
  /** Each brand kit's look (see savedLooks.ts). */
  brandLooks?: Look[];
  /** True when the photograph has an edit worth saving. */
  canSave?: boolean;
  onChoose: (look: Look) => void;
  onDelete?: (look: Look) => Promise<void>;
  onSave?: (name: string) => Promise<void>;
  onStrength: (value: number) => void;
  savedLooks?: Look[];
  strength: number;
}) {
  // Opens on the active look's family so returning to the panel lands where the
  // photograph already is.
  const [openFamily, setOpenFamily] = useState<string>(
    active ? active.family : "a"
  );
  const families = onSave
    ? [...EXTRA_FAMILIES, ...LOOK_FAMILIES]
    : LOOK_FAMILIES;
  const family = families.find((f) => f.id === openFamily);
  const inOpenFamily = (id: string): Look[] => {
    if (id === SAVED_FAMILY) {
      return savedLooks;
    }
    if (id === BRAND_FAMILY) {
      return brandLooks;
    }
    return looksInFamily(id);
  };
  if (!family) {
    // LOOK_FAMILIES is a non-empty literal, so this is unreachable — but it is
    // cheaper to return than to assert the compiler into agreeing.
    return null;
  }

  return (
    <div className="space-y-5 py-1">
      {/* Family rail — the signature color is the whole affordance. */}
      <div className="flex gap-px bg-white/6">
        {families.map((f) => {
          const isOpen = f.id === family.id;
          const holdsActive = active?.family === f.id;
          return (
            <button
              aria-pressed={isOpen}
              className={`relative flex flex-1 flex-col items-center gap-1.5 py-2.5 transition-all ${
                isOpen ? "" : "opacity-55 hover:opacity-80"
              }`}
              key={f.id}
              onClick={() => setOpenFamily(f.id)}
              style={{
                backgroundColor: `${f.color}`,
                color: `${f.contrastColor}`,
              }}
              title={`${f.name} — ${f.description}`}
              type="button"
            >
              <span className="font-mono text-sm tracking-wider">
                {f.letter}
              </span>
              {/* Marks the family holding the selected look when its panel is
                  closed, so the current grade stays findable in the rail. */}
              {holdsActive && !isOpen ? (
                <span
                  aria-hidden
                  className="absolute bottom-1 size-1 rounded-full"
                  style={{ backgroundColor: f.contrastColor }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div>
        <p className="pb-2 text-sm text-white/90 uppercase">
          {family.name}
          <span className="ml-2 text-white/90 normal-case tracking-normal">
            {family.description}
          </span>
        </p>

        <div className="grid grid-cols-4 gap-px bg-white/6">
          {inOpenFamily(family.id).map((look) => {
            const isActive = active?.id === look.id;
            return (
              <button
                className={`flex aspect-square flex-col items-center justify-center gap-1 bg-black transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/90 hover:text-white/90"
                }`}
                key={look.id}
                onClick={() => onChoose(look)}
                style={
                  isActive ? { backgroundColor: `${family.color}` } : undefined
                }
                title={look.name}
                type="button"
              >
                <span
                  className="font-mono text-sm tracking-wider"
                  style={{
                    color: isActive ? `${family.contrastColor}` : "#FFFFFF",
                  }}
                >
                  {look.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {family.id === SAVED_FAMILY && onSave ? (
        <SavedLooksTab
          active={active}
          canSave={canSave}
          onDelete={onDelete}
          onSave={onSave}
        />
      ) : null}
      {(family.id === SAVED_FAMILY && savedLooks.length === 0) ||
      (family.id === BRAND_FAMILY && brandLooks.length === 0) ? (
        <p className="text-sm text-white/60">
          {family.id === SAVED_FAMILY
            ? "Nothing saved yet. Grade a photo, then save it here by name."
            : "No brand kit has a look yet. Pick one in Brand kits → Look."}
        </p>
      ) : null}

      {active ? (
        <div className="border-white/6 border-t pt-1">
          <EditorSlider
            label={`${active.code} · ${active.name}`}
            max={100}
            min={0}
            onChange={onStrength}
            value={strength}
          />
        </div>
      ) : null}
    </div>
  );
}
