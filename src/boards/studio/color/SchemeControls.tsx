import {
  HUE_MODES,
  MODELS,
  type SchemeOptions,
  VISIONS,
  type Vision,
} from "./scheme";

type Settings = Omit<SchemeOptions, "anchor" | "locked">;

/** A row of choices where one is on. */
function Segments<T extends string>({
  label,
  onPick,
  options,
  value,
}: {
  label: string;
  onPick: (id: T) => void;
  options: readonly { id: T; label: string }[];
  value: T;
}) {
  return (
    <div aria-label={label} className="studio-segments" role="radiogroup">
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: a segmented control; radio inputs can't be styled as one bar here
        <button
          aria-checked={o.id === value}
          className="studio-segments__option"
          key={o.id}
          onClick={() => onPick(o.id)}
          role="radio"
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = "",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="studio__field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <output>
        {value}
        {suffix}
      </output>
    </label>
  );
}

/** The Palette Builder's settings: model, count, neutrals, hues, vision. */
export function SchemeControls({
  onChange,
  onVision,
  settings,
  vision,
}: {
  onChange: (next: Partial<Settings>) => void;
  onVision: (vision: Vision) => void;
  settings: Settings;
  vision: Vision;
}) {
  const model = MODELS.find((m) => m.id === settings.model);
  const hues = HUE_MODES.find((h) => h.id === settings.hues);
  // A ramp is one hue (or two) from end to end: nothing to make neutral.
  const isRamp =
    settings.model === "sequential" || settings.model === "diverging";
  return (
    <div className="studio__controls">
      <Segments
        label="Model"
        onPick={(id) => onChange({ model: id })}
        options={MODELS}
        value={settings.model}
      />
      <p className="studio__blurb">{model?.blurb}</p>
      <Slider
        label="Colour count"
        max={9}
        min={2}
        onChange={(count) => onChange({ count })}
        value={settings.count}
      />
      {isRamp ? null : (
        <Slider
          label="Neutrals"
          max={3}
          min={0}
          onChange={(neutrals) => onChange({ neutrals })}
          value={Math.min(settings.neutrals, settings.count - 1)}
        />
      )}
      <Segments
        label="Hues"
        onPick={(id) => onChange({ hues: id })}
        options={HUE_MODES}
        value={settings.hues}
      />
      <p className="studio__blurb">{hues?.blurb}</p>
      <Slider
        label="Hue spread"
        max={360}
        min={0}
        onChange={(spread) => onChange({ spread })}
        step={5}
        suffix="°"
        value={settings.spread}
      />
      <label className="studio__check">
        <input
          checked={settings.matchChroma}
          onChange={(e) => onChange({ matchChroma: e.target.checked })}
          type="checkbox"
        />
        Match lowest chroma: every unlocked colour as quiet as the quietest
      </label>
      <label className="studio__field">
        <span>Colour vision</span>
        <select
          className="studio__input"
          onChange={(e) => onVision(e.target.value as Vision)}
          value={vision}
        >
          {VISIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
