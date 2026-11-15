import { HugeiconsIcon } from "@hugeicons/react";
import type PlayIcon from "@hugeicons-pro/core-stroke-standard/PlayIcon";
import { Button } from "../../ui/button";
import "./boardEditorChrome.css";

/** One icon in the header: its name in the tooltip, and a count if it has one. */
export function HeaderIcon({
  badge = 0,
  disabled,
  icon,
  label,
  live = false,
  onClick,
  pressed,
}: {
  badge?: number;
  disabled?: boolean;
  icon: typeof PlayIcon;
  label: string;
  /** The board is published. */
  live?: boolean;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      size="header"
      title={label}
      tone={live ? "live" : "default"}
      type="button"
      variant="header"
    >
      <HugeiconsIcon aria-hidden icon={icon} size={16} />
      {badge > 0 ? (
        <span className="board-header-icon__badge">{badge}</span>
      ) : null}
    </Button>
  );
}
