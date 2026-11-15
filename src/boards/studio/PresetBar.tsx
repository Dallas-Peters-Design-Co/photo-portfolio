import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "../../components/admin/ConfirmProvider";
import { lookOf, presetsApi, usePresets } from "./presets";
import type { StudioValues } from "./types";

/**
 * Saved settings for the open tool: pick one to load it, save the current
 * settings as a new one, or over the one picked.
 */
export function PresetBar({
  defaults = {},
  looks = [],
  onLoad,
  tool,
  values,
}: {
  /** The tool's defaults, which a look is laid over. */
  defaults?: StudioValues;
  /** The tool's ready-made looks (ImageTool.looks). */
  looks?: { name: string; values: StudioValues }[];
  onLoad: (values: StudioValues) => void;
  tool: string;
  values: StudioValues;
}) {
  const { confirm, prompt } = useConfirm();
  const { drop, keep, presets } = usePresets(tool);
  const now = JSON.stringify(lookOf(values));
  const current = presets.find((p) => JSON.stringify(lookOf(p.values)) === now);
  // The closed trigger shows the label, not the raw id or "look:N".
  const items = [
    ...looks.map((l, i) => ({ label: l.name, value: `look:${i}` })),
    ...presets.map((p) => ({ label: p.name, value: p.id })),
  ];

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
        <Select
          items={items}
          onValueChange={(picked) => {
            if (picked === null) {
              return;
            }
            const look = looks[Number(picked.replace("look:", ""))];
            if (picked.startsWith("look:") && look) {
              // The look exactly: defaults under it, this picture's own
              // settings (its painted tiles) kept.
              const own = Object.fromEntries(
                Object.entries(values).filter(([k]) => !(k in lookOf(values)))
              );
              onLoad({ ...defaults, ...look.values, ...own });
              return;
            }
            const p = presets.find((x) => x.id === picked);
            if (p) {
              // Settings that belong to this picture (its painted tiles) stay.
              onLoad({ ...values, ...lookOf(p.values) });
            }
          }}
          value={current?.id ?? null}
        >
          <SelectTrigger aria-label="Saved settings" size="sm" tone="board">
            <SelectValue
              placeholder={
                presets.length + looks.length > 0 ? "Choose…" : "None saved yet"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {looks.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Looks</SelectLabel>
                {looks.map((l, i) => (
                  <SelectItem key={l.name} value={`look:${i}`}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {presets.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Saved</SelectLabel>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
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
