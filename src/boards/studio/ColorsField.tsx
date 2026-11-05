import { Plus, X } from "lucide-react";
import { ColorWell } from "../ColorWell";

/** A row of colour wells, one per colour the tool draws with. */
export function ColorsField({
  label,
  max,
  onChange,
  palette,
  value,
}: {
  label: string;
  max: number;
  /** The colours, comma-joined. */
  onChange: (next: string) => void;
  palette: string[];
  value: string[];
}) {
  const save = (next: string[]) => onChange(next.join(","));
  return (
    <div className="studio__field studio-colors">
      <span>{label}</span>
      <div className="studio-colors__row">
        {value.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a colour's place is its identity; two can be the same colour
          <span className="studio-colors__well" key={i}>
            <ColorWell
              label={`${label} ${i + 1}`}
              onChange={(next) =>
                save(value.map((was, j) => (j === i ? next : was)))
              }
              value={c}
            />
            {value.length > 2 ? (
              <button
                aria-label={`Remove colour ${i + 1}`}
                className="studio-colors__remove"
                onClick={() => save(value.filter((_, j) => j !== i))}
                type="button"
              >
                <X size={10} />
              </button>
            ) : null}
          </span>
        ))}
        {value.length < max ? (
          <button
            aria-label="Add a colour"
            className="studio__icon"
            onClick={() =>
              save([
                ...value,
                palette[value.length % palette.length] ?? "#000000",
              ])
            }
            title="Add a colour"
            type="button"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
