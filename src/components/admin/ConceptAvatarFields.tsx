import { useState } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Input } from "../ui/input";
import { ConceptField, ConceptGroup } from "./ConceptControls";

export function ConceptAvatarFields({
  element,
  onChange,
  showImage = true,
  showInitials = true,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
  showImage?: boolean;
  showInitials?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <ConceptGroup name="Avatar">
      {showImage ? (
        <ConceptField label="Image URL" wide>
          <Input
            aria-label="Avatar image URL"
            onBlur={(event) => {
              onChange({ avatarUrl: event.target.value.trim() || undefined });
              setDraft(null);
            }}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="https://…"
            size="sm"
            type="url"
            value={draft ?? element.avatarUrl ?? ""}
          />
        </ConceptField>
      ) : null}
      {showInitials ? (
        <ConceptField label="Initials" wide>
          <Input
            aria-label="Avatar initials"
            maxLength={8}
            onChange={(event) =>
              onChange({ avatarInitials: event.target.value })
            }
            size="sm"
            value={element.avatarInitials ?? ""}
          />
        </ConceptField>
      ) : null}
    </ConceptGroup>
  );
}
