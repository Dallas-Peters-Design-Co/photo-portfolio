import { Plus, Trash2, Wand2 } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import type { SiteScan } from "../../../config/siteScan.js";
import {
  CASES,
  fromScan,
  MAX_STYLES,
  modularScale,
  RATIOS,
  spacingSteps,
  styleCss,
  styleName,
  type TextCase,
  type TypeScale,
  type TypeStyle,
} from "../../../config/typeScale.js";
import { loadFontRef } from "../../theme/remoteFonts";
import { type Faces, familyFor } from "./faces";
import "./TypeScaleEditor.css";

/**
 * The brand's type and spacing scale, edited: build one from a body size and
 * a ratio (or read the website's), then tune each style's face, size, weight,
 * line height, tracking and case against a live specimen in the brand fonts.
 *
 * Controlled, so the kit page and the board Studio can each decide where a
 * change goes (the kit draft, or the Studio's own copy until it is saved).
 */

const CASE_LABELS: Record<TextCase, string> = {
  capitalize: "Title",
  lowercase: "lower",
  none: "As typed",
  uppercase: "UPPER",
};

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const SAMPLES: Record<string, string> = {
  body: "Body copy sets the pace for everything else on the page, so it should read without effort at length.",
  label: "Section label",
  lead: "A lead paragraph eases the reader in.",
  small: "Small print, captions and footnotes.",
};

const specimenStyle = (s: TypeStyle, faces: Faces): CSSProperties => ({
  ...styleCss(s),
  fontFamily: familyFor(faces, s.face),
});

function NumberField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (n: number) => void;
  step: number;
  value: number;
}) {
  return (
    <input
      aria-label={label}
      className="type-scale__num"
      max={max}
      min={min}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) {
          onChange(n);
        }
      }}
      step={step}
      type="number"
      value={value}
    />
  );
}

function StyleRow({
  faces,
  onChange,
  onRemove,
  style: s,
}: {
  faces: Faces;
  onChange: (next: TypeStyle) => void;
  onRemove: () => void;
  style: TypeStyle;
}) {
  const set = <K extends keyof TypeStyle>(key: K, v: TypeStyle[K]) =>
    onChange({ ...s, [key]: v });
  return (
    <div className="type-scale__style">
      <div className="type-scale__specs">
        <input
          aria-label="Style name"
          className="type-scale__name"
          onChange={(e) => set("name", styleName(e.target.value) || s.name)}
          value={s.name}
        />
        <select
          aria-label={`${s.name} face`}
          onChange={(e) => set("face", e.target.value as TypeStyle["face"])}
          value={s.face}
        >
          <option value="headline">Headline</option>
          <option value="body">Body</option>
        </select>
        <NumberField
          label={`${s.name} size in pixels`}
          max={400}
          min={6}
          onChange={(n) => set("size", n)}
          step={1}
          value={s.size}
        />
        <select
          aria-label={`${s.name} weight`}
          onChange={(e) => set("weight", Number(e.target.value))}
          value={s.weight}
        >
          {[...new Set([...WEIGHTS, s.weight])].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <NumberField
          label={`${s.name} line height`}
          max={3}
          min={0.7}
          onChange={(n) => set("lineHeight", n)}
          step={0.05}
          value={s.lineHeight}
        />
        <NumberField
          label={`${s.name} tracking in em`}
          max={0.5}
          min={-0.2}
          onChange={(n) => set("tracking", n)}
          step={0.005}
          value={s.tracking}
        />
        <select
          aria-label={`${s.name} case`}
          onChange={(e) => set("case", e.target.value as TextCase)}
          value={s.case}
        >
          {CASES.map((c) => (
            <option key={c} value={c}>
              {CASE_LABELS[c]}
            </option>
          ))}
        </select>
        <button
          aria-label={`Remove ${s.name}`}
          className="type-scale__icon"
          onClick={onRemove}
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="type-scale__specimen" style={specimenStyle(s, faces)}>
        {SAMPLES[s.name] ?? "The quick brown fox jumps over the lazy dog"}
      </p>
    </div>
  );
}

export function TypeScaleEditor({
  faces,
  onChange,
  scan,
  value,
}: {
  faces: Faces;
  onChange: (next: TypeScale | null) => void;
  /** The website's scan, to start from the sizes it already uses. */
  scan?: SiteScan;
  value: TypeScale | null;
}) {
  const scale = value ?? { spacing: [], styles: [] };
  const [base, setBase] = useState(16);
  const [ratio, setRatio] = useState(1.25);
  const [headWeight, setHeadWeight] = useState(
    faces.headline?.weights.length ? Math.max(...faces.headline.weights) : 700
  );
  const [unit, setUnit] = useState(8);

  useEffect(() => {
    loadFontRef(faces.headline?.ref);
    loadFontRef(faces.body?.ref);
  }, [faces.headline?.ref, faces.body?.ref]);

  const put = (next: TypeScale) =>
    onChange(next.styles.length > 0 || next.spacing.length > 0 ? next : null);
  const setStyles = (styles: TypeStyle[]) => put({ ...scale, styles });

  const addStyle = () => {
    let n = scale.styles.length + 1;
    while (scale.styles.some((s) => s.name === `style-${n}`)) {
      n += 1;
    }
    setStyles([
      ...scale.styles,
      {
        case: "none",
        face: "body",
        lineHeight: 1.5,
        name: `style-${n}`,
        size: base,
        tracking: 0,
        weight: 400,
      },
    ]);
  };

  return (
    <div className="type-scale">
      <div className="type-scale__generate">
        <div className="type-scale__field">
          <span>Body size</span>
          <NumberField
            label="Body size in pixels"
            max={32}
            min={10}
            onChange={setBase}
            step={1}
            value={base}
          />
        </div>
        <label>
          <span>Ratio</span>
          <select
            onChange={(e) => setRatio(Number(e.target.value))}
            value={ratio}
          >
            {RATIOS.map((r) => (
              <option key={r.label} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Heading weight</span>
          <select
            onChange={(e) => setHeadWeight(Number(e.target.value))}
            value={headWeight}
          >
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <button
          className="type-scale__button"
          onClick={() => setStyles(modularScale({ base, headWeight, ratio }))}
          type="button"
        >
          <Wand2 size={14} /> Generate
        </button>
        {scan && scan.typography.length > 0 ? (
          <button
            className="type-scale__button"
            onClick={() => {
              const found = fromScan(scan);
              put({
                spacing:
                  found.spacing.length > 0 ? found.spacing : scale.spacing,
                styles: found.styles,
              });
            }}
            title={`Use the sizes ${scan.url} uses`}
            type="button"
          >
            From website
          </button>
        ) : null}
      </div>

      {scale.styles.length === 0 ? (
        <p className="type-scale__empty">
          No type scale yet. Generate one from a body size and ratio
          {scan ? ", or start from the website's" : ""}.
        </p>
      ) : (
        <div className="type-scale__styles">
          <div
            aria-hidden
            className="type-scale__specs type-scale__specs--head"
          >
            <span>Style</span>
            <span>Face</span>
            <span>Size</span>
            <span>Weight</span>
            <span>Leading</span>
            <span>Tracking</span>
            <span>Case</span>
          </div>
          {scale.styles.map((s, i) => (
            <StyleRow
              faces={faces}
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its position; keying on the name would drop focus while it is typed
              key={i}
              onChange={(next) =>
                setStyles(scale.styles.map((x, k) => (k === i ? next : x)))
              }
              onRemove={() => setStyles(scale.styles.filter((_, k) => k !== i))}
              style={s}
            />
          ))}
        </div>
      )}
      {scale.styles.length < MAX_STYLES ? (
        <button className="type-scale__button" onClick={addStyle} type="button">
          <Plus size={14} /> Add a style
        </button>
      ) : null}

      <div className="type-scale__generate">
        <div className="type-scale__field">
          <span>Spacing unit</span>
          <NumberField
            label="Spacing unit in pixels"
            max={16}
            min={2}
            onChange={setUnit}
            step={1}
            value={unit}
          />
        </div>
        <button
          className="type-scale__button"
          onClick={() => put({ ...scale, spacing: spacingSteps(unit) })}
          type="button"
        >
          <Wand2 size={14} /> Spacing steps
        </button>
        <SpacingInput
          onChange={(spacing) => put({ ...scale, spacing })}
          value={scale.spacing}
        />
      </div>
      {scale.spacing.length > 0 ? (
        <div aria-hidden className="type-scale__spacing">
          {scale.spacing.map((v) => (
            <span key={v}>
              <i style={{ height: Math.min(v, 96), width: Math.min(v, 96) }} />
              {v}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const COMMAS = /[\s,]+/;

/** Spacing as a typed list, applied when the field is left. */
function SpacingInput({
  onChange,
  value,
}: {
  onChange: (next: number[]) => void;
  value: number[];
}) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <input
      aria-label="Spacing steps in pixels"
      className="type-scale__list"
      onBlur={() =>
        onChange(
          [
            ...new Set(
              text
                .split(COMMAS)
                .map(Number)
                .filter((n) => Number.isFinite(n) && n > 0)
            ),
          ].sort((a, b) => a - b)
        )
      }
      onChange={(e) => setText(e.target.value)}
      placeholder="4, 8, 12, 16, 24, 32"
      value={text}
    />
  );
}
