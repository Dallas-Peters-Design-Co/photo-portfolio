import {
  joinCardText,
  REVIEW_CONCEPT_ICONS,
  type ReviewConceptElement,
  type ReviewConceptIcon,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { Input } from "../ui/input";
import { ConceptField, ConceptSelect } from "./ConceptSelect";

const ICON_OPTIONS = REVIEW_CONCEPT_ICONS.map((icon) => ({
  label: icon
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" "),
  value: icon,
}));

const NO_ICON = { label: "No icon", value: "none" };

export function ReviewConceptContentField({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  if (element.kind === "icon") {
    return (
      <ConceptField label="Icon" wide>
        <ConceptSelect
          label="Icon"
          onChange={(icon) => onChange({ iconName: icon as ReviewConceptIcon })}
          options={ICON_OPTIONS}
          value={element.iconName ?? "star"}
        />
      </ConceptField>
    );
  }

  if (element.kind === "card") {
    const { body, title } = splitCardText(element.text);
    return (
      <>
        <ConceptField label="Card title" wide>
          <Input
            aria-label="Card title"
            onChange={(event) =>
              onChange({ text: joinCardText(event.target.value, body) })
            }
            size="sm"
            value={title}
          />
        </ConceptField>
        <ConceptField label="Card icon" wide>
          <ConceptSelect
            label="Card icon"
            onChange={(icon) =>
              onChange({
                iconName:
                  icon === NO_ICON.value
                    ? undefined
                    : (icon as ReviewConceptIcon),
              })
            }
            options={[NO_ICON, ...ICON_OPTIONS]}
            value={element.iconName ?? NO_ICON.value}
          />
        </ConceptField>
        <label className="review-concepts__field review-concepts__field--full">
          <span>Card body</span>
          <textarea
            onChange={(event) =>
              onChange({ text: joinCardText(title, event.target.value) })
            }
            rows={3}
            value={body}
          />
        </label>
      </>
    );
  }

  const label =
    element.kind === "input" || element.kind === "textarea"
      ? "Default value"
      : "Content";
  return (
    <ConceptField label={label} wide>
      <Input
        aria-label={label}
        onChange={(event) => onChange({ text: event.target.value })}
        size="sm"
        value={element.text}
      />
    </ConceptField>
  );
}
