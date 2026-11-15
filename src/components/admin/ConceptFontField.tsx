import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  fontRefId,
  fontRefStack,
  parseFontRef,
} from "../../../config/fontRef.js";
import { FONT_CHOICES, type FontId, findFont } from "../../../config/theme.js";
import { brandKitsApi } from "../../services/brandKitService";
import { loadFont } from "../../theme/fonts";
import {
  loadFontPreview,
  loadFontRef,
  loadFontsharePreview,
} from "../../theme/remoteFonts";
import { Input } from "../ui/input";
import {
  type ConceptOptionGroup,
  ConceptSelect,
  optionsOf,
} from "./ConceptSelect";
import { conceptFontPatch, conceptFontSelection } from "./ReviewConceptBrand";

const GOOGLE_RESULTS = 40;

const catalogGroup = (
  label: string,
  fonts: { family: string; ref: string }[],
  isLoading: boolean,
  error: unknown
): ConceptOptionGroup => {
  let status: string | null = null;
  if (isLoading) {
    status = "Loading fonts…";
  } else if (error) {
    status = `${label} could not load`;
  } else if (fonts.length === 0) {
    status = "No matching fonts";
  }
  return {
    label,
    options: [
      ...(status
        ? [{ disabled: true, label: status, value: `status|${label}` }]
        : []),
      ...fonts.map((font) => ({
        label: font.family,
        value: `brand|${font.ref}`,
      })),
    ],
  };
};

export function ConceptFontField({
  brandDoc,
  family,
  fontId,
  fontRef,
  label = "Typeface",
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  family: string;
  fontId?: string;
  fontRef?: string;
  label?: string;
  onChange: (patch: ReturnType<typeof conceptFontPatch>) => void;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length >= 2;
  const {
    data: googleFonts,
    error,
    isLoading,
  } = useSWR(searching ? "google-fonts" : null, brandKitsApi.googleFonts, {
    revalidateOnFocus: false,
  });
  const {
    data: fontshareFonts,
    error: fontshareError,
    isLoading: fontshareIsLoading,
  } = useSWR(
    searching ? "fontshare-fonts" : null,
    brandKitsApi.fontshareFonts,
    { revalidateOnFocus: false }
  );
  const adobeKitId = brandDoc?.adobeKitId;
  const { data: adobeFonts } = useSWR(
    adobeKitId ? `adobe-fonts:${adobeKitId}` : null,
    () => brandKitsApi.adobeFamilies(adobeKitId as string),
    { revalidateOnFocus: false }
  );
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return (googleFonts ?? [])
      .filter((font) => font.family.toLowerCase().includes(needle))
      .slice(0, GOOGLE_RESULTS);
  }, [googleFonts, query]);
  const fontshareMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return (fontshareFonts ?? [])
      .filter((font) => font.family.toLowerCase().includes(needle))
      .slice(0, GOOGLE_RESULTS);
  }, [fontshareFonts, query]);
  const selection = conceptFontSelection(family, fontRef, fontId);
  const currentRef = parseFontRef(fontRef);

  useEffect(() => {
    if (fontRef) {
      loadFontRef(fontRef);
    }
    if (fontId) {
      void loadFont(fontId as FontId);
    }
  }, [fontId, fontRef]);

  useEffect(() => {
    for (const font of matches) {
      loadFontPreview(font.family);
    }
  }, [matches]);

  useEffect(() => {
    for (const font of fontshareMatches) {
      loadFontsharePreview(font.slug, font.weights[0] ?? 400);
    }
  }, [fontshareMatches]);

  const choose = (value: string) => {
    const patch = conceptFontPatch(value);
    if (patch.fontRef) {
      loadFontRef(patch.fontRef);
    }
    if (patch.fontId) {
      void loadFont(patch.fontId as FontId);
    }
    onChange(patch);
  };

  const appFonts = useMemo(
    () => [...FONT_CHOICES].sort((a, b) => a.label.localeCompare(b.label)),
    []
  );
  const kitFaces = useMemo(() => {
    const faces = (brandDoc?.typefaces ?? []).filter((face) => face.ref);
    for (const font of adobeFonts ?? []) {
      if (!adobeKitId) {
        continue;
      }
      const ref = fontRefId({
        family: font.family,
        kitId: adobeKitId,
        source: "adobe",
      });
      if (!faces.some((face) => face.ref === ref)) {
        faces.push({
          name: font.label,
          ref,
          role: "Adobe Fonts",
          weights: font.weights,
        });
      }
    }
    return faces;
  }, [adobeFonts, adobeKitId, brandDoc?.typefaces]);
  let selectedIsListed = true;
  if (family === "brand") {
    selectedIsListed = kitFaces.some((face) => face.ref === fontRef);
  } else if (family === "app") {
    selectedIsListed = appFonts.some((font) => font.id === fontId);
  }

  const groups: ConceptOptionGroup[] = [
    ...(!selectedIsListed && currentRef
      ? [
          {
            options: [
              {
                label: `${currentRef.family} · saved selection`,
                value: `brand|${fontRef}`,
              },
            ],
          },
        ]
      : []),
    {
      label: "System",
      options: optionsOf([
        ["sans", "Sans serif"],
        ["serif", "Serif"],
        ["mono", "Monospace"],
      ]),
    },
    ...(kitFaces.length > 0
      ? [
          {
            label: "Brand kit",
            options: kitFaces.map((face) => ({
              label: face.role ? `${face.name} · ${face.role}` : face.name,
              value: `brand|${face.ref}`,
            })),
          },
        ]
      : []),
    {
      label: "Fonts in this app",
      options: appFonts.map((font) => ({
        label: font.label,
        value: `app|${font.id}`,
      })),
    },
    ...(searching
      ? [
          catalogGroup(
            "Google Fonts",
            matches.map((font) => ({
              family: font.family,
              ref: `g:${font.family}`,
            })),
            isLoading,
            error
          ),
          catalogGroup(
            "Fontshare",
            fontshareMatches.map((font) => ({
              family: font.family,
              ref: fontRefId({
                family: font.family,
                kitId: null,
                slug: font.slug,
                source: "fontshare",
              }),
            })),
            fontshareIsLoading,
            fontshareError
          ),
        ]
      : []),
  ];

  return (
    <div className="review-concepts__field">
      <span>{label}</span>
      <Input
        aria-label={`Search Google Fonts and Fontshare for ${label.toLowerCase()}`}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search fonts…"
        size="sm"
        type="search"
        value={query}
      />
      <ConceptSelect
        groups={groups}
        label={label}
        onChange={choose}
        value={selection}
      />
    </div>
  );
}

export const conceptFontCss = (
  family: string,
  fontRef?: string,
  fontId?: string
): string => {
  if (family === "app" && fontId) {
    return findFont(fontId)?.stack ?? "var(--font-sans, Arial, sans-serif)";
  }
  if (family === "brand" && fontRef) {
    const ref = parseFontRef(fontRef);
    return ref ? fontRefStack(ref) : "var(--font-sans, Arial, sans-serif)";
  }
  if (family === "serif") {
    return "Georgia, serif";
  }
  if (family === "mono") {
    return "ui-monospace, SFMono-Regular, Menlo, monospace";
  }
  return "var(--font-sans, Arial, sans-serif)";
};
