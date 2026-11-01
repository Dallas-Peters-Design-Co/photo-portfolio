import {
  Copy as CopyIcon,
  Languages,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AD_SIZES, sizeFromTitle } from "../../../config/adLayout";
import { brandKitsApi } from "../../services/brandKitService";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { copyFrameAtSizes } from "../io/adFrames";
import { CATEGORIES, checkFrame } from "./brandCheck";
import { patchItems } from "./creativeModel";
import { exportWidthFor } from "./exportPng";
import {
  brandFor,
  buildLayout,
  type Copy,
  copyOf,
  LAYOUTS,
  type LayoutId,
} from "./layouts";
import { rolesOf } from "./roles";
import "./BrandPanel.css";

/**
 * The creative editor's brand side: pick a layout built from the kit, see
 * how the design scores against the kit and why, and write or translate the
 * copy in the brand's voice.
 */

const WORKING = "…";
const LANGUAGES = ["English", "Español", "Français", "Deutsch", "日本語"];

/** The feed and story sizes a campaign usually needs, one of each. */
const SOCIAL_SET = [
  "ig-square",
  "ig-portrait",
  "ig-story",
  "fb-link",
  "li-post",
  "x-post",
  "pin",
];

interface Variant extends Copy {
  angle: string;
}

export function BrandPanel({
  frame,
  items,
  layers,
  onChange,
  onSelect,
}: {
  frame: BoardItem;
  items: BoardItem[];
  layers: BoardItem[];
  onChange: (next: BoardItem[]) => void;
  onSelect: (id: string) => void;
}) {
  const brand = useActiveBrand();
  const kit = brand?.kit ?? null;
  const doc = kit?.resolvedDoc ?? null;
  const [layout, setLayout] = useState<LayoutId>("split");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [showFindings, setShowFindings] = useState(false);

  const roles = rolesOf(frame, layers, doc);
  const check = checkFrame(
    frame,
    layers,
    doc,
    exportWidthFor(frame) / frame.width
  );
  const size = sizeFromTitle(frame.body);

  const applyLayout = () => {
    const ids = new Set(layers.map((l) => l.id));
    const z = Math.max(0, ...items.map((i) => i.z)) + 1;
    const built = buildLayout(
      layout,
      frame,
      z,
      copyOf(roles),
      brandFor(doc, roles)
    );
    onChange([...items.filter((i) => !ids.has(i.id)), ...built]);
    toast.success("Layout applied. ⌘Z to undo.");
  };

  const everySize = AD_SIZES.filter(
    (s) =>
      SOCIAL_SET.includes(s.id) && !(size && s.w === size.w && s.h === size.h)
  );

  const makeEverySize = () => {
    const out = copyFrameAtSizes(items, frame.id, everySize);
    if (!out) {
      return;
    }
    onChange([...items, ...out.added]);
    toast.success(
      `${out.frameIds.length} sizes added beside this frame. ⌘Z to undo.`
    );
  };

  const applyCopy = (copy: Copy) => {
    const patches = new Map<string, Partial<BoardItem>>();
    if (roles.headline) {
      patches.set(roles.headline.id, { body: copy.headline });
    }
    if (roles.body) {
      patches.set(roles.body.id, { body: copy.body });
    }
    if (roles.cta) {
      patches.set(roles.cta.id, { body: copy.cta });
    }
    if (patches.size === 0) {
      toast.error("Apply a layout first, so the copy has somewhere to go.");
      return;
    }
    onChange(patchItems(items, patches));
  };

  const write = async (language: string, label: string) => {
    if (!kit) {
      return;
    }
    setBusy(label);
    try {
      const current = copyOf(roles);
      const result = await brandKitsApi.writeCopy(kit.id, {
        brief: language ? "" : brief,
        current,
        language,
        size: size ? `${size.w}×${size.h}` : "",
      });
      if (language) {
        const [first] = result;
        if (first) {
          applyCopy(first);
          toast.success(`Copy in ${language}`);
        }
      } else {
        setVariants(result);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't write copy");
    } finally {
      setBusy(null);
    }
  };

  if (!brand) {
    return null;
  }

  return (
    <aside className="brand-panel">
      <label className="brand-panel__row">
        <span className="brand-panel__label">Brand</span>
        <select
          className="creative__input"
          onChange={(e) => brand.setKitId(e.target.value || null)}
          value={kit?.id ?? ""}
        >
          <option value="">Choose a brand…</option>
          {brand.kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>

      <section className="brand-panel__section">
        <h3 className="brand-panel__label">
          <LayoutTemplate size={13} /> Layout
        </h3>
        <div className="brand-panel__row">
          <select
            aria-label="Layout"
            className="creative__input"
            onChange={(e) => setLayout(e.target.value as LayoutId)}
            value={layout}
          >
            {LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            className="creative__button"
            onClick={applyLayout}
            type="button"
          >
            Apply
          </button>
        </div>
        <p className="creative__hint">
          Rebuilds this frame from the brand's colours, fonts, logo and
          pictures, keeping its copy and image.
        </p>
        <button
          className="creative__button"
          onClick={makeEverySize}
          type="button"
        >
          <CopyIcon size={14} /> Make every size
        </button>
        <p className="creative__hint">
          Copies this design to {everySize.length} social sizes (Instagram post,
          portrait and story, Facebook, LinkedIn, X, Pinterest), laid out on the
          board beside it.
        </p>
      </section>

      <section className="brand-panel__section">
        <button
          aria-expanded={showFindings}
          className="brand-panel__score"
          onClick={() => setShowFindings((v) => !v)}
          type="button"
        >
          <span
            className="brand-panel__ring"
            style={{ ["--score" as string]: check.score / 10 }}
          >
            {check.score.toFixed(1)}
          </span>
          <span>
            <span className="brand-panel__label">Brand check</span>
            <span className="brand-panel__summary">
              {check.findings.length === 0
                ? "Nothing flagged"
                : `${check.findings.length} flagged · ${showFindings ? "hide" : "view"} report`}
            </span>
          </span>
        </button>
        <dl className="brand-panel__bars">
          {CATEGORIES.map((c) => (
            <div key={c.id}>
              <dt>{c.label}</dt>
              <dd>
                <span
                  className={
                    check.scores[c.id] < 7
                      ? "brand-panel__bar brand-panel__bar--low"
                      : "brand-panel__bar"
                  }
                  style={{ width: `${check.scores[c.id] * 10}%` }}
                />
              </dd>
              <dd className="brand-panel__num">
                {Math.round(check.scores[c.id])}
              </dd>
            </div>
          ))}
        </dl>
        {showFindings && check.findings.length > 0 ? (
          <ul className="brand-panel__findings">
            {check.findings.map((f, i) => (
              <li
                className={`brand-panel__finding brand-panel__finding--${f.severity}`}
                // biome-ignore lint/suspicious/noArrayIndexKey: findings are recomputed each render and have no identity of their own
                key={i}
              >
                {f.layerId ? (
                  <button
                    onClick={() => onSelect(f.layerId as string)}
                    type="button"
                  >
                    {f.message}
                  </button>
                ) : (
                  <span>{f.message}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {doc ? null : (
          <p className="creative__hint">
            Choose a brand to check against its colours, fonts and logo.
          </p>
        )}
      </section>

      <section className="brand-panel__section">
        <h3 className="brand-panel__label">
          <Sparkles size={13} /> Copy & variants
        </h3>
        <textarea
          aria-label="Brief"
          className="creative__input brand-panel__brief"
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Brief: the benefit to push and the moment to meet the reader in"
          value={brief}
        />
        <button
          className="creative__button"
          disabled={!kit || busy !== null}
          onClick={() => void write("", "variants")}
          type="button"
        >
          {busy === "variants" ? "Writing…" : "Write 3 variants"}
        </button>
        {variants.map((v) => (
          <button
            className="brand-panel__variant"
            key={v.headline}
            onClick={() => applyCopy(v)}
            title="Use this copy"
            type="button"
          >
            <span className="brand-panel__angle">{v.angle}</span>
            <strong>{v.headline}</strong>
            <span>{v.body}</span>
            <em>{v.cta}</em>
          </button>
        ))}
        <h3 className="brand-panel__label">
          <Languages size={13} /> Language
        </h3>
        <div className="brand-panel__chips">
          {LANGUAGES.map((lang) => (
            <button
              className="brand-panel__chip"
              disabled={!kit || busy !== null}
              key={lang}
              onClick={() => void write(lang, lang)}
              type="button"
            >
              {`${lang}${busy === lang ? ` ${WORKING}` : ""}`}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
