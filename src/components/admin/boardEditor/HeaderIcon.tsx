import { HugeiconsIcon } from "@hugeicons/react";
import type PlayIcon from "@hugeicons-pro/core-stroke-standard/PlayIcon";
import { Button } from "../../ui/button";
import "./boardEditorChrome.css";

/** One icon in the header: its name in the tooltip, and a count if it has one. */
export function HeaderIcon({
  badge = 0,
  className = "",
  disabled,
  icon,
  label,
  onClick,
  pressed,
}: {
  badge?: number;
  className?: string;
  disabled?: boolean;
  icon: typeof PlayIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={pressed}
      className={`board-header-icon ${className}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon aria-hidden icon={icon} size={16} />
      {badge > 0 ? (
        <span className="board-header-icon__badge">{badge}</span>
      ) : null}
    </Button>
  );
}
