import {
  type ConceptIconSvg,
  conceptIconName,
} from "../../../config/conceptIcon.js";
import {
  joinCardText,
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { IconPicker } from "../../cms/IconPicker";
import { Input } from "../ui/input";
import { ConceptField } from "./ConceptControls";

export function ReviewConceptContentField({
  element,
  onChange,
  showTitle = true,
  showBody = true,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
  showTitle?: boolean;
  showBody?: boolean;
}) {
  if (element.kind === "text") {
    return (
      <label className="review-concepts__field review-concepts__field--full">
        <span>Text content</span>
        <textarea
          maxLength={500}
          onChange={(event) => onChange({ text: event.target.value })}
          rows={3}
          value={element.text}
        />
      </label>
    );
  }
  if (element.kind === "orderedList") {
    return (
      <label className="review-concepts__field review-concepts__field--full">
        <span>List items (one per line)</span>
        <textarea
          maxLength={500}
          onChange={(event) => onChange({ text: event.target.value })}
          rows={4}
          value={element.text}
        />
      </label>
    );
  }
  if (element.kind === "icon") {
    return (
      <ConceptField label="Icon" wide>
        <IconPicker
          allowNone={false}
          label="Icon"
          library="full"
          onChange={(icon, svg) => {
            if (icon) {
              onChange({
                iconName: icon,
                iconSvg: svg as ConceptIconSvg | undefined,
              });
            }
          }}
          size="sm"
          svg={element.iconSvg}
          value={conceptIconName(element.iconName) ?? "StarIcon"}
        />
      </ConceptField>
    );
  }

  if (element.kind === "card") {
    const { body, title } = splitCardText(element.text);
    return (
      <>
        {showTitle ? (
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
        ) : null}
        {showBody ? (
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
        ) : null}
      </>
    );
  }

  let label = "Content";
  if (element.kind === "input" || element.kind === "textarea") {
    label = "Default value";
  } else if (element.kind === "panel") {
    label = "Header text";
  }
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
