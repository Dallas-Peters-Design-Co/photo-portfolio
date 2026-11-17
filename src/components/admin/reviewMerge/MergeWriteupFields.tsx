import type { BrandMerge, MergeOption } from "../../../../config/brandMerge.js";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

/**
 * The agent's writeup, editable: the title, the headline, the overview, each
 * option's text and lists, and the recommendation. The comparison table is
 * shown as written; write again to change it.
 */

type Update = (update: (merge: BrandMerge) => BrandMerge) => void;

const lines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function Area({
  label,
  onChange,
  rows = 3,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
}) {
  return (
    <label className="review-merge__field">
      <span className="review-merge__label">{label}</span>
      <textarea
        className="admin-control review-merge__area"
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

function OptionFields({
  index,
  option,
  update,
}: {
  index: number;
  option: MergeOption;
  update: Update;
}) {
  const set = (patch: Partial<MergeOption>) =>
    update((m) => ({
      ...m,
      options: m.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  return (
    <fieldset className="review-merge__option">
      <legend className="review-merge__label">
        {String(index + 1).padStart(2, "0")} · {option.name}
      </legend>
      <Area
        label="In short"
        onChange={(summary) => set({ summary })}
        rows={2}
        value={option.summary}
      />
      <Area
        label="How it works"
        onChange={(how) => set({ how })}
        rows={4}
        value={option.how}
      />
      <div className="review-merge__lists">
        <Area
          label="Keeps (one per line)"
          onChange={(v) => set({ keeps: lines(v) })}
          value={option.keeps.join("\n")}
        />
        <Area
          label="Changes (one per line)"
          onChange={(v) => set({ changes: lines(v) })}
          value={option.changes.join("\n")}
        />
        <Area
          label="Risks (one per line)"
          onChange={(v) => set({ risks: lines(v) })}
          value={option.risks.join("\n")}
        />
      </div>
      <Area
        label="When it's the right choice"
        onChange={(when) => set({ when })}
        rows={2}
        value={option.when}
      />
    </fieldset>
  );
}

export function MergeWriteupFields({
  merge,
  update,
}: {
  merge: BrandMerge;
  update: Update;
}) {
  return (
    <div className="review-merge__writeup">
      <div className="review-merge__field">
        <Label htmlFor="merge-title">Title</Label>
        <Input
          id="merge-title"
          onChange={(e) => update((m) => ({ ...m, title: e.target.value }))}
          size="lg"
          value={merge.title}
        />
      </div>
      <div className="review-merge__field">
        <Label htmlFor="merge-outcome">Headline</Label>
        <Input
          id="merge-outcome"
          onChange={(e) => update((m) => ({ ...m, outcome: e.target.value }))}
          value={merge.outcome}
        />
      </div>
      <Area
        label="Overview"
        onChange={(overview) => update((m) => ({ ...m, overview }))}
        rows={6}
        value={merge.overview}
      />
      {merge.options.map((option, i) => (
        <OptionFields
          index={i}
          key={option.name}
          option={option}
          update={update}
        />
      ))}
      {merge.recommendation ? (
        <Area
          label={`Recommendation: ${merge.recommendation.option}`}
          onChange={(why) =>
            update((m) => ({
              ...m,
              recommendation: m.recommendation
                ? { ...m.recommendation, why }
                : null,
            }))
          }
          rows={4}
          value={merge.recommendation.why}
        />
      ) : null}
    </div>
  );
}
