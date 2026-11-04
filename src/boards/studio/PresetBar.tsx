import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../../components/admin/ConfirmProvider";
import { lookOf, presetsApi, usePresets } from "./presets";
import type { StudioValues } from "./types";

/**
 * Saved settings for the open tool: pick one to load it, save the current
 * settings as a new one, or over the one picked.
 */
export function PresetBar({
  onLoad,
  tool,
  values,
}: {
  onLoad: (values: StudioValues) => void;
  tool: string;
  values: StudioValues;
}) {
  const { confirm, prompt } = useConfirm();
  const { drop, keep, presets } = usePresets(tool);
  const now = JSON.stringify(lookOf(values));
  const current = presets.find((p) => JSON.stringify(lookOf(p.values)) === now);

  const saveAs = async () => {
    const name = (
      await prompt({
        confirmLabel: "Save",
        defaultValue: current?.name ?? "",
        placeholder: "2027 · yellow flow",
        title: "Save these settings",
      })
    )?.trim();
    if (!name) {
      return;
    }
    const same = presets.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    try {
      keep(await presetsApi.save({ id: same?.id, name, tool, values }));
      toast.success(`Saved “${name}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save it");
    }
  };

  const remove = async () => {
    if (
      !(
        current &&
        (await confirm({
          confirmLabel: "Delete",
          title: `Delete “${current.name}”?`,
        }))
      )
    ) {
      return;
    }
    try {
      await presetsApi.remove(current.id);
      drop(current.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete it");
    }
  };

  return (
    <div className="studio__field studio-presets">
      <span>Saved settings</span>
      <div className="studio-presets__row">
        <select
          aria-label="Saved settings"
          className="studio__input"
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) {
              // Settings that belong to this picture (its painted tiles) stay.
              onLoad({ ...values, ...lookOf(p.values) });
            }
          }}
          value={current?.id ?? ""}
        >
          <option value="">
            {presets.length > 0 ? "Choose…" : "None saved yet"}
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="studio__button"
          onClick={() => void saveAs()}
          title="Save the settings as they are now, by name"
          type="button"
        >
          <Save size={14} /> Save
        </button>
        {current ? (
          <button
            aria-label={`Delete ${current.name}`}
            className="studio__icon"
            onClick={() => void remove()}
            title="Delete this preset"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
