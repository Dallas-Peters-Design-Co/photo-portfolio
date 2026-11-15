import {
  REVIEW_CONCEPT_ICONS,
  type ReviewConceptElement,
  type ReviewConceptIcon,
} from "../../../config/reviewConcept.js";

const iconLabel = (name: ReviewConceptIcon): string =>
  name
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

export function ReviewConceptContentField({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  if (element.kind === "icon") {
    return (
      <label className="review-concepts__field review-concepts__field--wide">
        <span>Icon</span>
        <select
          onChange={(event) =>
            onChange({ iconName: event.target.value as ReviewConceptIcon })
          }
          value={element.iconName ?? "star"}
        >
          {REVIEW_CONCEPT_ICONS.map((icon) => (
            <option key={icon} value={icon}>
              {iconLabel(icon)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="review-concepts__field review-concepts__field--wide">
      <span>
        {element.kind === "input" || element.kind === "textarea"
          ? "Default value"
          : "Content"}
      </span>
      <input
        onChange={(event) => onChange({ text: event.target.value })}
        value={element.text}
      />
    </label>
  );
}
