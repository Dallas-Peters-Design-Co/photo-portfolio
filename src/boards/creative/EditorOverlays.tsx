import { CommandPalette } from "../shortcuts/CommandPalette";
import type { Command } from "../shortcuts/keys";
import { ShortcutSheet } from "../shortcuts/ShortcutSheet";
import type { StudioEditing } from "../studio/ImageToolView";
import { type StudioFrame, StudioPanel } from "../studio/StudioPanel";
import type { StudioRecipe } from "../studio/types";

/**
 * What the frame editor opens over itself: the Studio (working for this
 * frame), the command palette (⌘K) and the shortcut sheet (?).
 */
export function EditorOverlays({
  commands,
  onCloseOverlay,
  onCloseStudio,
  overlay,
  studio,
}: {
  commands: Command[];
  onCloseOverlay: () => void;
  onCloseStudio: () => void;
  overlay: "palette" | "shortcuts" | null;
  studio: {
    /** A placed Studio picture being changed, or a shape being filled. */
    editing?: StudioEditing & { layerId: string };
    frame: StudioFrame;
    onAdd: (file: File, recipe?: StudioRecipe) => void;
    tool: string;
  } | null;
}) {
  return (
    <>
      {studio ? (
        <StudioPanel
          editing={studio.editing}
          frame={studio.frame}
          initialTool={studio.tool}
          // A fresh panel per picture opened, so its settings load.
          key={studio.editing ? `edit:${studio.editing.layerId}` : "studio"}
          onAdd={studio.onAdd}
          onClose={onCloseStudio}
        />
      ) : null}
      {overlay === "palette" ? (
        <CommandPalette
          commands={commands}
          onClose={onCloseOverlay}
          placeholder="Search editor commands"
        />
      ) : null}
      {overlay === "shortcuts" ? (
        <ShortcutSheet
          commands={commands}
          onClose={onCloseOverlay}
          title="Frame editor shortcuts"
        />
      ) : null}
    </>
  );
}
