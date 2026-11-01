import {
  Circle,
  Hexagon,
  type LucideIcon,
  Minus,
  MoveUpRight,
  Square,
  SquareRoundCorner,
  Squircle,
  Star,
  Triangle,
} from "lucide-react";
import type { ShapeTool } from "./creativeModel";
import "./ShapePicker.css";

/** Every shape the frame editor can add, as one grid of buttons. */

const SHAPES: { icon: LucideIcon; label: string; tool: ShapeTool }[] = [
  { icon: Square, label: "Rectangle", tool: "rect" },
  { icon: SquareRoundCorner, label: "Rounded rectangle", tool: "rounded" },
  { icon: Squircle, label: "Squircle", tool: "squircle" },
  { icon: Circle, label: "Ellipse", tool: "ellipse" },
  { icon: Triangle, label: "Triangle", tool: "triangle" },
  { icon: Hexagon, label: "Polygon", tool: "polygon" },
  { icon: Star, label: "Star", tool: "star" },
  { icon: Minus, label: "Line", tool: "line" },
  { icon: MoveUpRight, label: "Arrow", tool: "arrow" },
];

export function ShapePicker({ onPick }: { onPick: (tool: ShapeTool) => void }) {
  return (
    <div className="shape-picker">
      <span className="shape-picker__label">Shapes</span>
      <div className="shape-picker__grid">
        {SHAPES.map(({ icon: Icon, label, tool }) => (
          <button
            aria-label={`Add a ${label.toLowerCase()}`}
            className="shape-picker__button"
            key={tool}
            onClick={() => onPick(tool)}
            title={label}
            type="button"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
