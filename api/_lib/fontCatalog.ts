import type {
  AdobeFamily,
  CatalogFont,
  FontshareFont,
} from "../../config/fontRef.js";
import { isAdobeKitId, isFontFamilyName } from "../../config/fontRef.js";

/**
 * Where brand fonts are looked up: the Google Fonts catalog, and the families
 * in an Adobe Fonts web project.
 *
 * Both are public data fetched server side, trimmed, and cached: the Google
 * metadata is 2.7 MB of which a picker needs about 5%, and fetching it from
 * the browser is blocked by CORS anyway.
 */

const GOOGLE_METADATA = "https://fonts.google.com/metadata/fonts";
const FONTSHARE_CATALOG = "https://api.fontshare.com/v2/fonts";
const FONTSHARE_PAGE_SIZE = 100;
const FONTSHARE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const XSSI_GUARD = /^\)\]\}'\s*/;

const CATEGORY: Record<string, string> = {
  Display: "display",
  Handwriting: "handwriting",
  Monospace: "mono",
  "Sans Serif": "sans",
  Serif: "serif",
};

let google: { at: number; fonts: CatalogFont[] } | null = null;
let fontshare: { at: number; fonts: FontshareFont[] } | null = null;

interface GoogleFamily {
  axes?: { tag: string }[];
  category?: string;
  family: string;
  fonts?: Record<string, unknown>;
  popularity?: number;
}

export const trimGoogleCatalog = (raw: unknown): CatalogFont[] => {
  const list = ((raw ?? {}) as { familyMetadataList?: GoogleFamily[] })
    .familyMetadataList;
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .filter((f) => typeof f.family === "string")
    .map((f) => {
      const cuts = Object.keys(f.fonts ?? {});
      const weights = [...new Set(cuts.map((cut) => Number.parseInt(cut, 10)))]
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      return {
        category: CATEGORY[f.category ?? ""] ?? "sans",
        family: f.family,
        italic: cuts.some((cut) => cut.endsWith("i")),
        rank: typeof f.popularity === "number" ? f.popularity : 9999,
        variable: (f.axes ?? []).some((axis) => axis.tag === "wght"),
        weights: weights.length > 0 ? weights : [400],
      };
    })
    .sort((a, b) => a.rank - b.rank);
};

export const googleCatalog = async (): Promise<CatalogFont[]> => {
  if (google && Date.now() - google.at < DAY_MS) {
    return google.fonts;
  }
  const res = await fetch(GOOGLE_METADATA);
  if (!res.ok) {
    throw new Error(`Google Fonts metadata ${res.status}`);
  }
  // The endpoint has, at times, prefixed its JSON with an XSSI guard.
  const text = (await res.text()).replace(XSSI_GUARD, "");
  google = { at: Date.now(), fonts: trimGoogleCatalog(JSON.parse(text)) };
  return google.fonts;
};

interface FontshareStyle {
  is_italic?: boolean;
  is_variable?: boolean;
  weight?: { number?: number; weight?: number } | number;
}

interface FontshareFamily {
  category?: string;
  license_type?: string;
  name?: string;
  slug?: string;
  styles?: FontshareStyle[];
}

interface FontsharePage {
  count_total: number;
  fonts: FontshareFamily[];
}

const fontshareCategory = (category: string | undefined): string => {
  const normalized = category?.toLowerCase() ?? "";
  if (normalized.includes("serif")) {
    return "serif";
  }
  if (normalized.includes("hand") || normalized.includes("script")) {
    return "handwriting";
  }
  if (normalized.includes("mono")) {
    return "mono";
  }
  if (normalized.includes("display")) {
    return "display";
  }
  return "sans";
};

export const trimFontshareCatalog = (raw: unknown): FontshareFont[] => {
  const list = (raw as { fonts?: FontshareFamily[] } | null)?.fonts;
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .filter(
      (font): font is FontshareFamily & { name: string; slug: string } =>
        typeof font.slug === "string" &&
        FONTSHARE_SLUG.test(font.slug) &&
        isFontFamilyName(font.name)
    )
    .map((font) => {
      const styles = font.styles ?? [];
      const weights = [
        ...new Set(
          styles
            .map((style) => {
              const { weight } = style;
              if (typeof weight === "number") {
                return weight;
              }
              return weight?.weight ?? weight?.number;
            })
            .filter(
              (weight): weight is number =>
                typeof weight === "number" && weight >= 100 && weight <= 1000
            )
        ),
      ].sort((a, b) => a - b);
      return {
        category: fontshareCategory(font.category),
        family: font.name,
        italic: styles.some((style) => style.is_italic),
        licenseType: font.license_type ?? "",
        rank: 9999,
        slug: font.slug,
        variable: styles.some((style) => style.is_variable),
        weights: weights.length > 0 ? weights : [400],
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family));
};

const fetchFontsharePage = async (offset: number): Promise<FontsharePage> => {
  const res = await fetch(
    `${FONTSHARE_CATALOG}?limit=${FONTSHARE_PAGE_SIZE}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error(`Fontshare catalog ${res.status}`);
  }
  return (await res.json()) as FontsharePage;
};

export const fontshareCatalog = async (): Promise<FontshareFont[]> => {
  if (fontshare && Date.now() - fontshare.at < DAY_MS) {
    return fontshare.fonts;
  }
  const first = await fetchFontsharePage(0);
  const remainingPages = Math.max(
    0,
    Math.ceil(first.count_total / FONTSHARE_PAGE_SIZE) - 1
  );
  const rest = await Promise.all(
    Array.from({ length: remainingPages }, (_, index) =>
      fetchFontsharePage((index + 1) * FONTSHARE_PAGE_SIZE)
    )
  );
  const fonts = trimFontshareCatalog({
    fonts: [first, ...rest].flatMap((page) => page.fonts),
  });
  fontshare = { at: Date.now(), fonts };
  return fontshare.fonts;
};

/** "n4" → 400; Adobe's variation codes are n|i plus a weight digit. */
const variationWeight = (code: string): number | null => {
  const digit = Number.parseInt(code.slice(1), 10);
  return Number.isFinite(digit) ? digit * 100 : null;
};

export const trimAdobeKit = (raw: unknown): AdobeFamily[] => {
  const families = (
    (raw ?? {}) as {
      kit?: {
        families?: {
          css_names?: string[];
          name?: string;
          slug?: string;
          variations?: string[];
        }[];
      };
    }
  ).kit?.families;
  if (!Array.isArray(families)) {
    return [];
  }
  return families
    .map((f) => ({
      family: f.css_names?.[0] ?? f.slug ?? "",
      label: f.name ?? f.slug ?? "",
      weights: [
        ...new Set(
          (f.variations ?? [])
            .map(variationWeight)
            .filter((w): w is number => w !== null)
        ),
      ].sort((a, b) => a - b),
    }))
    .filter((f) => f.family !== "");
};

/**
 * The families in a published Adobe Fonts web project. Null when the id is
 * malformed or Adobe doesn't know it (an unpublished project 404s).
 */
export const adobeKitFamilies = async (
  kitId: unknown
): Promise<AdobeFamily[] | null> => {
  if (!isAdobeKitId(kitId)) {
    return null;
  }
  const res = await fetch(
    `https://typekit.com/api/v1/json/kits/${kitId}/published`
  );
  if (!res.ok) {
    return null;
  }
  return trimAdobeKit(await res.json());
};
