import { HugeiconsIcon } from "@hugeicons/react";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-standard/PlusSignIcon";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  type BrandKitDoc,
  MAX_TYPEFACES,
  type TypefaceEntry,
} from "../../../config/brandKit.js";
import {
  type AdobeFamily,
  type CatalogFont,
  fontRefId,
  isAdobeKitId,
  parseFontRef,
} from "../../../config/fontRef.js";
import { brandKitsApi } from "../../services/brandKitService";
import {
  loadAdobeKit,
  loadFontPreview,
  loadFontRef,
} from "../../theme/remoteFonts";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import "./BrandFontsEditor.css";

/**
 * A kit's typefaces, picked from fonts that actually load: any Google Fonts
 * family, or a family in the brand's Adobe Fonts web project. Each one is
 * stored with a font ref, which is what lets board text be set in it.
 */

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

const sourceLabel = (ref: string | null): string => {
  const parsed = parseFontRef(ref);
  if (!parsed) {
    return "Typed name — can't be used on boards";
  }
  return parsed.source === "google" ? "Google Fonts" : "Adobe Fonts";
};

function GoogleSearch({
  onAdd,
  taken,
}: {
  onAdd: (font: CatalogFont) => void;
  taken: Set<string>;
}) {
  const { data, error, isLoading } = useSWR(
    "google-fonts",
    brandKitsApi.googleFonts,
    { revalidateOnFocus: false }
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((f) => category === "all" || f.category === category)
      .filter((f) => !q || f.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [category, data, query]);

  useEffect(() => {
    for (const font of matches) {
      loadFontPreview(font.family);
    }
  }, [matches]);

  return (
    <div className="brand-fonts__search stack stack--snug">
      <Input
        aria-label="Search Google Fonts"
        className="admin-control"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          data
            ? `Search ${data.length.toLocaleString()} Google Fonts…`
            : "Search Google Fonts…"
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
      {isLoading ? (
        <p className="brand-kit__hint">Loading Google Fonts…</p>
      ) : null}
      {error ? (
        <p className="brand-kit__hint">Couldn't load Google Fonts just now.</p>
      ) : null}
      <ul className="brand-fonts__results">
        {matches.map((font) => {
          const added = taken.has(`g:${font.family}`);
          return (
            <li key={font.family}>
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

function AdobeProject({
  doc,
  onAdd,
  onChange,
  taken,
}: {
  doc: BrandKitDoc;
  onAdd: (family: AdobeFamily, kitId: string) => void;
  onChange: (next: BrandKitDoc) => void;
  taken: Set<string>;
}) {
  const [draft, setDraft] = useState(doc.adobeKitId ?? "");
  const kitId = doc.adobeKitId;
  const { data, error } = useSWR(
    kitId ? ["adobe-kit", kitId] : null,
    () => brandKitsApi.adobeFamilies(kitId as string),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (kitId) {
      loadAdobeKit(kitId);
    }
  }, [kitId]);

  const connect = () => {
    const id = draft.trim().toLowerCase();
    if (id && !isAdobeKitId(id)) {
      toast.error("That doesn't look like an Adobe Fonts web project id");
      return;
    }
    onChange({ ...doc, adobeKitId: id || null });
  };

  return (
    <div className="stack stack--snug">
      <div className="row row--snug">
        <Input
          aria-label="Adobe Fonts web project id"
          className="admin-control"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              connect();
            }
          }}
          placeholder="Adobe Fonts web project id, e.g. abc1def"
          value={draft}
        />
        <Button onClick={connect} type="button" variant="outline">
          {kitId && draft.trim() === kitId ? "Connected" : "Connect"}
        </Button>
      </div>
      <p className="brand-kit__hint">
        In Adobe Fonts, open Manage fonts → Web projects and copy the project
        id. Add this site's domain to the project so its fonts load here.
      </p>
      {error ? (
        <p className="brand-kit__hint">
          {error instanceof Error
            ? error.message
            : "Couldn't load that project."}
        </p>
      ) : null}
      {data && kitId ? (
        <ul className="brand-fonts__results">
          {data.map((family) => {
            const ref = fontRefId({
              family: family.family,
              kitId,
              source: "adobe",
            });
            return (
              <li key={family.family}>
                <button
                  className="brand-fonts__result"
                  disabled={taken.has(ref)}
                  onClick={() => onAdd(family, kitId)}
                  type="button"
                >
                  <span
                    className="brand-fonts__name"
                    style={{
                      fontFamily: `"${family.family}", var(--font-sans)`,
                    }}
                  >
                    {family.label}
                  </span>
                  <span className="brand-fonts__meta">
                    {taken.has(ref)
                      ? "Added"
                      : `+ Add · ${family.weights.length} weight${family.weights.length === 1 ? "" : "s"}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function TypefaceRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: TypefaceEntry;
  onChange: (next: TypefaceEntry) => void;
  onRemove: () => void;
}) {
  const ref = parseFontRef(entry.ref);
  useEffect(() => {
    loadFontRef(entry.ref);
  }, [entry.ref]);
  return (
    <div className="brand-kit__row">
      <span
        className="brand-kit__specimen"
        style={{
          fontFamily: `"${ref?.family ?? entry.name}", var(--font-sans)`,
        }}
      >
        Aa
      </span>
      <div className="brand-fonts__face">
        <span
          className="brand-fonts__face-name"
          style={{
            fontFamily: `"${ref?.family ?? entry.name}", var(--font-sans)`,
          }}
        >
          {entry.name}
        </span>
        <span className="brand-fonts__meta">{sourceLabel(entry.ref)}</span>
      </div>
      <Input
        aria-label="What it is for"
        className="admin-control"
        onChange={(e) => onChange({ ...entry, role: e.target.value })}
        placeholder="headline, body, accent…"
        value={entry.role}
      />
      <Button
        aria-label={`Remove ${entry.name || "typeface"}`}
        onClick={onRemove}
        size="icon"
        tone="danger"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon icon={Delete02Icon} size={14} />
      </Button>
    </div>
  );
}

export function TypefaceEditor({
  doc,
  onChange,
}: {
  doc: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const [adding, setAdding] = useState<"adobe" | "google" | null>(null);
  const taken = new Set(
    doc.typefaces.map((f) => f.ref).filter((r): r is string => Boolean(r))
  );
  const full = doc.typefaces.length >= MAX_TYPEFACES;

  const add = (entry: TypefaceEntry) => {
    if (full) {
      toast.error(`${MAX_TYPEFACES} typefaces is the most a kit can hold`);
      return;
    }
    onChange({
      ...doc,
      typefaces: [
        ...doc.typefaces,
        {
          ...entry,
          role: doc.typefaces.length === 0 ? "headline" : entry.role,
        },
      ],
    });
    toast.success(`${entry.name} added`);
  };

  return (
    <div className="stack stack--tight">
      {doc.typefaces.map((entry, index) => (
        <TypefaceRow
          entry={entry}
          // biome-ignore lint/suspicious/noArrayIndexKey: a typeface's identity here is the row it occupies
          key={`face-${index}`}
          onChange={(next) =>
            onChange({
              ...doc,
              typefaces: doc.typefaces.map((f, i) => (i === index ? next : f)),
            })
          }
          onRemove={() =>
            onChange({
              ...doc,
              typefaces: doc.typefaces.filter((_, i) => i !== index),
            })
          }
        />
      ))}
      {doc.typefaces.length === 0 ? (
        <p className="brand-kit__hint">
          No typefaces yet. Open Google Fonts or Adobe Fonts below and click a
          font to add it. The brand's fonts then show up first in the font menu
          on any board using this brand.
        </p>
      ) : null}
      <div className="row row--snug">
        <Button
          aria-pressed={adding === "google"}
          disabled={full}
          onClick={() => setAdding(adding === "google" ? null : "google")}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
          Google Fonts
        </Button>
        <Button
          aria-pressed={adding === "adobe"}
          disabled={full}
          onClick={() => setAdding(adding === "adobe" ? null : "adobe")}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
          Adobe Fonts
        </Button>
      </div>
      {adding === "google" ? (
        <GoogleSearch
          onAdd={(font) =>
            add({
              name: font.family,
              ref: fontRefId({
                family: font.family,
                kitId: null,
                source: "google",
              }),
              role: "",
              weights: font.weights,
            })
          }
          taken={taken}
        />
      ) : null}
      {adding === "adobe" ? (
        <AdobeProject
          doc={doc}
          onAdd={(family, kitId) =>
            add({
              name: family.label,
              ref: fontRefId({ family: family.family, kitId, source: "adobe" }),
              role: "",
              weights: family.weights,
            })
          }
          onChange={onChange}
          taken={taken}
        />
      ) : null}
    </div>
  );
}
