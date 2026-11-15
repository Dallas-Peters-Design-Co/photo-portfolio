import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { TypefaceEntry } from "../../../../config/brandKit.js";
import { familyOf } from "../../../../config/designMd.js";
import type { CatalogFont } from "../../../../config/fontRef.js";
import { brandKitsApi } from "../../../services/brandKitService";
import { loadFontPreview, loadFontRef } from "../../../theme/remoteFonts";
import "./FacePicker.css";

/** How many search results are listed, and so previewed, at once. */
const SHOWN = 24;

/** A Google family as a typeface entry, in the role it was picked for. */
export const googleFace = (
  font: CatalogFont,
  role: "body" | "headline"
): TypefaceEntry => ({
  name: font.family,
  ref: `g:${font.family}`,
  role,
  weights: font.weights,
});

const stackOf = (family: string) => `"${family}", var(--font-sans, system-ui)`;

/**
 * Picks the face one role of the type scale is set in: the kit's own faces
 * first, then any Google Fonts family by name. Each name is drawn in its
 * own face, so the choice is made by eye.
 */
export function FacePicker({
  face: role,
  kitFaces,
  label,
  onChange,
  value,
}: {
  /** Which of the scale's two faces this picks. */
  face: "body" | "headline";
  kitFaces: TypefaceEntry[];
  label: string;
  onChange: (face: TypefaceEntry) => void;
  value: TypefaceEntry | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, error, isLoading } = useSWR(
    open ? "google-fonts" : null,
    brandKitsApi.googleFonts,
    { revalidateOnFocus: false }
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((f) => !q || f.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [data, query]);

  // Each listed name is drawn in its own face: load just those letters.
  useEffect(() => {
    if (!open) {
      return;
    }
    for (const font of matches) {
      loadFontPreview(font.family);
    }
    for (const face of kitFaces) {
      loadFontRef(face.ref);
    }
  }, [kitFaces, matches, open]);

  const current = value ? familyOf(value) : null;
  const choose = (face: TypefaceEntry) => {
    loadFontRef(face.ref);
    onChange(face);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="face-picker">
      <div className="studio__field">
        <span>{label}</span>
        <button
          aria-expanded={open}
          aria-label={`${label} font: ${current ?? "system font"}`}
          className="studio__input face-picker__current"
          onClick={() => setOpen(!open)}
          style={current ? { fontFamily: stackOf(current) } : undefined}
          type="button"
        >
          <span className="face-picker__name">{current ?? "System font"}</span>
          <ChevronDown aria-hidden size={12} />
        </button>
      </div>

      {open ? (
        <div className="face-picker__panel">
          <input
            aria-label={`Search Google Fonts for the ${label.toLowerCase()}`}
            className="studio__input face-picker__search"
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              data
                ? `Search ${data.length.toLocaleString()} Google Fonts…`
                : "Search Google Fonts…"
            }
            type="search"
            value={query}
          />
          <ul className="face-picker__list">
            {kitFaces.length > 0 && !query ? (
              <li className="studio__group-label">In the kit</li>
            ) : null}
            {query
              ? null
              : kitFaces.map((face) => (
                  <li key={`kit-${face.ref ?? face.name}`}>
                    <button
                      aria-pressed={current === familyOf(face)}
                      className="face-picker__option"
                      onClick={() => choose({ ...face, role })}
                      style={{ fontFamily: stackOf(familyOf(face)) }}
                      type="button"
                    >
                      {familyOf(face)}
                    </button>
                  </li>
                ))}
            <li className="studio__group-label">Google Fonts</li>
            {isLoading ? <li className="face-picker__note">Loading…</li> : null}
            {error ? (
              <li className="face-picker__note">
                Couldn't load Google Fonts just now.
              </li>
            ) : null}
            {matches.map((font) => (
              <li key={font.family}>
                <button
                  aria-pressed={current === font.family}
                  className="face-picker__option"
                  onClick={() => choose(googleFace(font, role))}
                  style={{ fontFamily: stackOf(font.family) }}
                  type="button"
                >
                  {font.family}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
