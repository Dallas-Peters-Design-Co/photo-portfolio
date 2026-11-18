import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { lookOf } from "../../../config/conceptStyle.js";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { ConceptSelect } from "./ConceptControls";
import { useConfirm } from "./ConfirmProvider";
import { useKitStyleSync } from "./kitStyleSync";

const CUSTOM = "custom";

/**
 * Which kit style the element follows, and how many settings it has set
 * itself; Reset hands those back to the style.
 */
export function StyleLink({
  element,
  onLink,
  styles,
}: {
  element: ReviewConceptElement;
  onLink: (style: ConceptStyle | null) => void;
  styles: ConceptStyle[];
}) {
  const linked = styles.find((style) => style.id === element.styleId) ?? null;
  const own = element.overrides?.length ?? 0;
  const kit = useKitStyleSync();
  const { prompt } = useConfirm();

  /** The kit's style made to look like this element; it follows it again. */
  const updateKitStyle = async () => {
    if (!(kit && linked)) {
      return;
    }
    const next = {
      ...linked,
      look: {
        ...lookOf(element),
        ...(linked.look.tableContents
          ? { tableContents: linked.look.tableContents }
          : {}),
      },
    };
    if (await kit.save(next)) {
      onLink(next);
    }
  };
  /** A new style in the kit from this element's look, linked from now on. */
  const saveAsNew = async () => {
    if (!kit) {
      return;
    }
    const name = await prompt({
      confirmLabel: "Add to kit",
      defaultValue: linked ? `${linked.name} variant` : "",
      description: `A new ${element.kind} style in ${kit.kitName}, looking like this one. This element follows it from now on.`,
      placeholder: "e.g. Secondary",
      title: "Name the new style",
    });
    const trimmed = name?.trim();
    if (!trimmed) {
      return;
    }
    const style: ConceptStyle = {
      id: newItemId(),
      kind: element.kind,
      look: lookOf(element),
      name: trimmed.slice(0, 60),
    };
    if (await kit.save(style)) {
      onLink(style);
    }
  };

  return (
    <div className="review-concepts__style-link">
      <span className="review-concepts__style-label">Kit style</span>
      <div className="review-concepts__style-pick">
        <ConceptSelect
          label={`${element.kind} style`}
          onChange={(id) =>
            onLink(styles.find((style) => style.id === id) ?? null)
          }
          options={[
            { label: "Custom", value: CUSTOM },
            ...styles.map((style) => ({ label: style.name, value: style.id })),
          ]}
          value={linked?.id ?? CUSTOM}
        />
      </div>
      {linked && own > 0 ? (
        <>
          <span className="review-concepts__style-changes">
            {own} {own === 1 ? "change" : "changes"} of its own
          </span>
          <Button
            onClick={() => onLink(linked)}
            size="xs"
            title="Hand these settings back to the kit style"
            type="button"
            variant="ghost"
          >
            Reset
          </Button>
        </>
      ) : null}
      {kit && linked && own > 0 ? (
        <Button
          onClick={() => void updateKitStyle()}
          size="xs"
          title={`Make ${linked.name} in ${kit.kitName} look like this. Every review using it follows.`}
          type="button"
          variant="ghost"
        >
          Update kit style
        </Button>
      ) : null}
      {kit && (!linked || own > 0) ? (
        <Button
          onClick={() => void saveAsNew()}
          size="xs"
          title={`Save this look to ${kit.kitName} as a new style`}
          type="button"
          variant="ghost"
        >
          {linked ? "Save as new style" : "Save as kit style"}
        </Button>
      ) : null}
    </div>
  );
}
