import { useMemo } from "react";
import useSWR from "swr";
import { fontRefId, parseFontRef } from "../../../config/fontRef";
import { FONT_CHOICES, findFont } from "../../../config/theme";
import { brandKitsApi } from "../../services/brandKitService";
import { useActiveBrand } from "../brand/ActiveBrand";

export interface BoardFontOption {
  label: string;
  source: "Board" | "Brand" | "Installed" | "Google Fonts" | "Fontshare";
  value: string | null;
  weight?: number;
}

export const boardFontLabel = (value: string | null): string =>
  parseFontRef(value)?.family ??
  findFont(value ?? "")?.label ??
  "Board default";

/** Shared catalog metadata is fetched on opening, never per text item. */
export const useBoardFontCatalog = (open: boolean) => {
  const brand = useActiveBrand();
  const google = useSWR(
    open ? "google-fonts" : null,
    brandKitsApi.googleFonts,
    {
      revalidateOnFocus: false,
    }
  );
  const fontshare = useSWR(
    open ? "fontshare-fonts" : null,
    brandKitsApi.fontshareFonts,
    {
      revalidateOnFocus: false,
    }
  );
  // A kit can arrive before its resolved doc does (the API sends null).
  const faces = brand?.kit?.resolvedDoc?.typefaces;
  const options = useMemo<BoardFontOption[]>(
    () => [
      { label: "Board default", source: "Board", value: null },
      ...(faces ?? [])
        .filter(
          (face, index, all) =>
            face.ref &&
            all.findIndex((other) => other.ref === face.ref) === index
        )
        .map((face) => ({
          label: face.name,
          source: "Brand" as const,
          value: face.ref ?? null,
        })),
      ...FONT_CHOICES.map((font) => ({
        label: font.label,
        source: "Installed" as const,
        value: font.id,
      })),
      ...(google.data ?? []).map((font) => ({
        label: font.family,
        source: "Google Fonts" as const,
        value: `g:${font.family}`,
      })),
      ...(fontshare.data ?? []).map((font) => ({
        label: font.family,
        source: "Fontshare" as const,
        value: fontRefId({
          family: font.family,
          kitId: null,
          slug: font.slug,
          source: "fontshare",
        }),
        weight: font.weights.includes(400) ? 400 : font.weights[0],
      })),
    ],
    [faces, fontshare.data, google.data]
  );
  return { fontshare, google, options };
};
