import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { TypefaceEntry } from "../../../../config/brandKit.js";
import { familyOf } from "../../../../config/designMd.js";
import {
  type CatalogFont,
  type FontshareFont,
  fontRefId,
} from "../../../../config/fontRef.js";
import { brandKitsApi } from "../../../services/brandKitService";
import {
  loadFontPreview,
  loadFontRef,
  loadFontsharePreview,
} from "../../../theme/remoteFonts";
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

const fontshareFace = (
  font: FontshareFont,
  role: "body" | "headline"
): TypefaceEntry => ({
  name: font.family,
  ref: fontRefId({
    family: font.family,
    kitId: null,
    slug: font.slug,
    source: "fontshare",
  }),
  role,
  weights: font.weights,
});

const stackOf = (family: string) => `"${family}", var(--font-sans, system-ui)`;

function CatalogResults({
  current,
  error,
  faces,
  isLoading,
  label,
  onChoose,
}: {
  current: string | null;
  error: unknown;
  faces: TypefaceEntry[];
  isLoading: boolean;
  label: string;
  onChoose: (face: TypefaceEntry) => void;
}) {
  return (
    <>
      <li className="studio__group-label">{label}</li>
      {isLoading ? <li className="face-picker__note">Loading…</li> : null}
      {error ? (
        <li className="face-picker__note">Couldn't load {label} just now.</li>
      ) : null}
      {faces.map((face) => (
        <li key={face.ref}>
          <button
            aria-pressed={current === familyOf(face)}
            className="face-picker__option"
            onClick={() => onChoose(face)}
            style={{ fontFamily: stackOf(familyOf(face)) }}
            type="button"
          >
            {familyOf(face)}
          </button>
        </li>
      ))}
    </>
  );
}

/**
 * Picks the face one role of the type scale is set in: the kit's own faces
 * first, then any Google Fonts or Fontshare family by name. Each name is drawn
 * in its own face, so the choice is made by eye.
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
  const {
    data: fontshareData,
    error: fontshareError,
    isLoading: fontshareIsLoading,
  } = useSWR(open ? "fontshare-fonts" : null, brandKitsApi.fontshareFonts, {
    revalidateOnFocus: false,
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((f) => !q || f.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [data, query]);
  const fontshareMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (fontshareData ?? [])
      .filter((font) => !q || font.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [fontshareData, query]);

  // Each listed name is drawn in its own face: load just those letters.
  useEffect(() => {
    if (!open) {
      return;
    }
    for (const font of matches) {
      loadFontPreview(font.family);
    }
    for (const font of fontshareMatches) {
      loadFontsharePreview(font.slug, font.weights[0] ?? 400);
    }
    for (const face of kitFaces) {
      loadFontRef(face.ref);
    }
  }, [fontshareMatches, kitFaces, matches, open]);

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
            aria-label={`Search Google Fonts and Fontshare for the ${label.toLowerCase()}`}
            className="studio__input face-picker__search"
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              data
                ? `Search ${data.length.toLocaleString()} Google Fonts and Fontshare…`
                : "Search Google Fonts and Fontshare…"
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
            <CatalogResults
              current={current}
              error={error}
              faces={matches.map((font) => googleFace(font, role))}
              isLoading={isLoading}
              label="Google Fonts"
              onChoose={choose}
            />
            <CatalogResults
              current={current}
              error={fontshareError}
              faces={fontshareMatches.map((font) => fontshareFace(font, role))}
              isLoading={fontshareIsLoading}
              label="Fontshare"
              onChoose={choose}
            />
          </ul>
        </div>
      ) : null}
    </div>
  );
}
