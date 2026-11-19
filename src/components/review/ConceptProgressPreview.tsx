import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptProgressPreview.css";

/**
 * A bare bar: the track and its fill. A progress element draws one under its
 * label; a table's Progress cell draws one on its own.
 */
export function ProgressBar({
  color,
  height,
  label,
  radius,
  track,
  value,
}: {
  color: string;
  height: number;
  label: string;
  radius: number;
  track: string;
  value: number;
}) {
  return (
    <span
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className="concept-progress__track"
      role="progressbar"
      style={
        {
          "--progress-color": color,
          "--progress-height": `${height}px`,
          "--progress-radius": `${radius}px`,
          "--progress-track": track,
          "--progress-value": `${value}%`,
        } as CSSProperties
      }
    >
      <span className="concept-progress__fill" />
    </span>
  );
}

/**
 * A progress element: its label and percentage over the bar. The element's
 * fill colour is the track, so the box around them stays clear.
 */
export function ConceptProgressPreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const value = element.progress ?? 60;
  return (
    <ProgressIndicator
      bar={{
        color: element.accentColor ?? element.color,
        height: element.barHeight ?? 8,
        label: element.text || "Progress",
        radius: element.radius,
        track: element.background,
        value,
      }}
      label={element.text}
      showValue={element.showValue !== false}
      style={style}
    />
  );
}

export function ProgressIndicator({
  style,
  label,
  showValue,
  bar,
  table = false,
}: {
  style: CSSProperties;
  label: ReactNode;
  showValue: boolean;
  bar: ComponentProps<typeof ProgressBar>;
  table?: boolean;
}) {
  return (
    <div
      className={
        table ? "concept-progress concept-table__progress" : "concept-progress"
      }
      style={{ ...style, background: "transparent", borderRadius: 0 }}
    >
      {label || showValue ? (
        <span className="concept-progress__label">
          <span>{label}</span>
          {showValue ? <small>{Math.round(bar.value)}%</small> : null}
        </span>
      ) : null}
      <ProgressBar {...bar} />
    </div>
  );
}
