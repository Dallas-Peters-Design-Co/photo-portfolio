import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Copy,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BoardItem } from "../../types";
import { opacityOf, withOpacity } from "./layerOpacity";
import { OpacityField } from "./OpacityField";
import { type AlignTo, alignLayers, distributeLayers } from "./selection";

/**
 * The context bar with several layers selected: line them up with each other,
 * space them evenly, fade them, copy or delete them all, or let go of the selection.
 */

const ALIGNS: { icon: ReactNode; label: string; to: AlignTo }[] = [
  {
    icon: <AlignStartVertical size={15} />,
    label: "Align left edges",
    to: "left",
  },
  {
    icon: <AlignCenterVertical size={15} />,
    label: "Align centres",
    to: "center",
  },
  {
    icon: <AlignEndVertical size={15} />,
    label: "Align right edges",
    to: "right",
  },
  { icon: <AlignStartHorizontal size={15} />, label: "Align tops", to: "top" },
  {
    icon: <AlignCenterHorizontal size={15} />,
    label: "Align middles",
    to: "middle",
  },
  {
    icon: <AlignEndHorizontal size={15} />,
    label: "Align bottoms",
    to: "bottom",
  },
];

function Icon({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="creative__icon"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function MultiBar({
  layers,
  onClear,
  onDelete,
  onDuplicate,
  onPatch,
}: {
  layers: BoardItem[];
  onClear: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPatch: (patches: Map<string, Partial<BoardItem>>) => void;
}) {
  const few = layers.length < 3;
  const values = new Set(layers.map(opacityOf));
  const [only] = values;
  return (
    <div className="creative__bar">
      <strong className="creative__count">{layers.length} layers</strong>
      <span className="creative__divider" />
      <div className="creative__group">
        {ALIGNS.map((a) => (
          <Icon
            key={a.to}
            label={a.label}
            onClick={() => onPatch(alignLayers(layers, a.to))}
          >
            {a.icon}
          </Icon>
        ))}
      </div>
      <span className="creative__divider" />
      <div className="creative__group">
        <Icon
          disabled={few}
          label={
            few ? "Select three or more to space evenly" : "Space evenly across"
          }
          onClick={() => onPatch(distributeLayers(layers, "x"))}
        >
          <AlignHorizontalSpaceAround size={15} />
        </Icon>
        <Icon
          disabled={few}
          label={
            few ? "Select three or more to space evenly" : "Space evenly down"
          }
          onClick={() => onPatch(distributeLayers(layers, "y"))}
        >
          <AlignVerticalSpaceAround size={15} />
        </Icon>
      </div>
      <span className="creative__divider" />
      <OpacityField
        onChange={(v) =>
          onPatch(new Map(layers.map((l) => [l.id, withOpacity(l, v)])))
        }
        value={values.size === 1 && only !== undefined ? only : null}
      />
      <span className="creative__divider" />
      <div className="creative__group">
        <Icon label="Duplicate all (⌘D)" onClick={onDuplicate}>
          <Copy size={15} />
        </Icon>
        <Icon label="Delete all" onClick={onDelete}>
          <Trash2 size={15} />
        </Icon>
        <Icon label="Deselect (Esc)" onClick={onClear}>
          <X size={15} />
        </Icon>
      </div>
    </div>
  );
}
