import { useState } from "react";
import type { Look } from "../presets";
import { SAVED_FAMILY } from "../savedLooks";

/**
 * Under the Saved tab: name the current grade and save it, or delete the saved
 * look that's selected. Saving keeps the photograph exactly as it is; the new
 * look becomes the selected one, so its strength slider works straight away.
 */
export function SavedLooksTab({
  active,
  canSave,
  onSave,
  onDelete,
}: {
  active: Look | null;
  canSave: boolean;
  onDelete?: (look: Look) => Promise<void>;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSaved = active?.family === SAVED_FAMILY ? active : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed) {
            void run(async () => {
              await onSave(trimmed);
              setName("");
            });
          }
        }}
      >
        <input
          aria-label="Name for this look"
          className="min-w-0 flex-1 border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
          disabled={!canSave || busy}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder={canSave ? "Bird Creek Warm" : "Edit the photo first"}
          value={name}
        />
        <button
          className="border border-white/25 px-3 text-sm text-white disabled:opacity-40"
          disabled={!(canSave && name.trim()) || busy}
          type="submit"
        >
          Save
        </button>
      </form>
      {selectedSaved && onDelete ? (
        <button
          className="text-white/60 text-xs underline hover:text-white"
          disabled={busy}
          onClick={() => void run(() => onDelete(selectedSaved))}
          type="button"
        >
          Delete “{selectedSaved.name}”
        </button>
      ) : null}
      {error ? <p className="text-red-300 text-xs">{error}</p> : null}
    </div>
  );
}
