import { useLayoutEffect, useRef, useState } from "react";
import { newComponentStyleLook } from "../../../config/componentStyleTransfer.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { lookOf } from "../../../config/conceptStyle.js";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptSelect } from "./ConceptControls";
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
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentLink = useRef<typeof onLink | null>(null);
  useLayoutEffect(() => {
    currentLink.current = onLink;
    return () => {
      currentLink.current = null;
    };
  }, [onLink]);

  /** The kit's style made to look like this element; it follows it again. */
  const updateKitStyle = async () => {
    if (!(kit && linked)) {
      return;
    }
    const next = {
      ...linked,
      look: {
        ...lookOf(element),
        ...(linked.look.contents ? { contents: linked.look.contents } : {}),
        ...(linked.look.groupContents
          ? { groupContents: linked.look.groupContents }
          : {}),
        ...(linked.look.tableContents
          ? { tableContents: linked.look.tableContents }
          : {}),
      },
    };
    if (await kit.save(next)) {
      currentLink.current?.(next);
    }
  };
  /** A new style in the kit from this element's look, linked from now on. */
  const saveAsNew = async () => {
    if (!kit || saving) {
      return;
    }
    const trimmed = name?.trim();
    if (!trimmed) {
      return;
    }
    const style: ConceptStyle = {
      id: newItemId(),
      kind: element.kind,
      look: newComponentStyleLook(element),
      name: trimmed.slice(0, 60),
    };
    setSaving(true);
    try {
      if (await kit.save(style)) {
        currentLink.current?.(style);
        setName(null);
      }
    } finally {
      setSaving(false);
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
          value={linked ? linked.id : CUSTOM}
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
      {kit && name !== null ? (
        <>
          <Input
            aria-label="New style name"
            autoFocus
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                void saveAsNew();
              }
              if (event.key === "Escape") {
                event.stopPropagation();
                setName(null);
              }
            }}
            placeholder="e.g. Secondary"
            size="sm"
            value={name}
          />
          <Button
            disabled={saving || !name.trim()}
            onClick={() => void saveAsNew()}
            size="xs"
            type="button"
            variant="ghost"
          >
            Add to kit
          </Button>
          <Button
            disabled={saving}
            onClick={() => setName(null)}
            size="xs"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        </>
      ) : null}
      {kit && name === null ? (
        <Button
          onClick={() => setName(linked ? `${linked.name} variant` : "")}
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
