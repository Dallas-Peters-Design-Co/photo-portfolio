import { CommandPalette } from "../shortcuts/CommandPalette";
import type { Command } from "../shortcuts/keys";
import { ShortcutSheet } from "../shortcuts/ShortcutSheet";
import { type StudioFrame, StudioPanel } from "../studio/StudioPanel";

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
    frame: StudioFrame;
    onAdd: (file: File) => void;
    tool: string;
  } | null;
}) {
  return (
    <>
      {studio ? (
        <StudioPanel
          frame={studio.frame}
          initialTool={studio.tool}
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
