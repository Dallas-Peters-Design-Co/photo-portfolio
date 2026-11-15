import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { FontshareFont } from "../../../config/fontRef.js";
import { fontRefId } from "../../../config/fontRef.js";
import { brandKitsApi } from "../../services/brandKitService";
import { loadFontsharePreview } from "../../theme/remoteFonts";
import { Input } from "../ui/input";

const CATEGORIES = [
  ["all", "All"],
  ["sans", "Sans"],
  ["serif", "Serif"],
  ["display", "Display"],
  ["handwriting", "Script"],
  ["mono", "Mono"],
] as const;
type Category = (typeof CATEGORIES)[number][0];

const SHOWN = 30;

export function FontshareSearch({
  onAdd,
  taken,
}: {
  onAdd: (font: FontshareFont) => void;
  taken: Set<string>;
}) {
  const { data, error, isLoading } = useSWR(
    "fontshare-fonts",
    brandKitsApi.fontshareFonts,
    { revalidateOnFocus: false }
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((font) => category === "all" || font.category === category)
      .filter((font) => !q || font.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [category, data, query]);

  useEffect(() => {
    for (const font of matches) {
      loadFontsharePreview(font.slug, font.weights[0] ?? 400);
    }
  }, [matches]);

  return (
    <div className="brand-fonts__search stack stack--snug">
      <Input
        aria-label="Search Fontshare fonts"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          data
            ? `Search all ${data.length.toLocaleString()} Fontshare fonts…`
            : "Search Fontshare fonts…"
        }
        value={query}
      />
      <div className="brand-fonts__chips">
        {CATEGORIES.map(([id, label]) => (
          <button
            aria-pressed={category === id}
            className="brand-fonts__chip"
            key={id}
            onClick={() => setCategory(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {isLoading ? <p className="brand-kit__hint">Loading Fontshare…</p> : null}
      {error ? (
        <p className="brand-kit__hint">Couldn't load Fontshare just now.</p>
      ) : null}
      <ul className="brand-fonts__results">
        {matches.map((font) => {
          const ref = fontRefId({
            family: font.family,
            kitId: null,
            slug: font.slug,
            source: "fontshare",
          });
          const added = taken.has(ref);
          return (
            <li key={font.slug}>
              <button
                className="brand-fonts__result"
                disabled={added}
                onClick={() => onAdd(font)}
                type="button"
              >
                <span
                  className="brand-fonts__name"
                  style={{ fontFamily: `"${font.family}", var(--font-sans)` }}
                >
                  {font.family}
                </span>
                <span className="brand-fonts__meta">
                  {added
                    ? "Added"
                    : `+ Add · ${font.weights.length} weight${font.weights.length === 1 ? "" : "s"}${font.italic ? " · italic" : ""}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
