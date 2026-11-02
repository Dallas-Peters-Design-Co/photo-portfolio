/**
 * Opacity for the frame editor's bars: a slider for feel and a percentage to
 * type an exact value. `value` is 0 to 1; null when the selected layers
 * differ, which shows an empty box until one is set for all of them.
 */
export function OpacityField({
  onChange,
  value,
}: {
  onChange: (next: number) => void;
  value: number | null;
}) {
  const percent = value === null ? "" : Math.round(value * 100);
  return (
    <label className="creative__field">
      <span>Opacity</span>
      <input
        aria-label="Opacity"
        className="creative__range"
        max={100}
        min={0}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        step={1}
        type="range"
        value={percent === "" ? 100 : percent}
      />
      <input
        aria-label="Opacity percent"
        className="creative__input creative__input--num"
        max={100}
        min={0}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) {
            onChange(n / 100);
          }
        }}
        placeholder="Mixed"
        type="number"
        value={percent}
      />
      <span aria-hidden="true">%</span>
    </label>
  );
}
