import useSWR from "swr";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConcept } from "../../../config/conceptDefaults.js";
import type { ReviewConcept } from "../../../config/reviewConcept.js";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { ReviewCanvasComponent } from "../review/ReviewCanvasComponent";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptSelect } from "./ConceptControls";
import { useKitStyleSync } from "./kitStyleSync";

export function CanvasComponentPicker({
  brandDoc,
  disabled,
  onAdd,
}: {
  brandDoc?: BrandKitDoc | null;
  disabled: boolean;
  onAdd: (concept: ReviewConcept) => void;
}) {
  const kitId = useKitStyleSync()?.kitId;
  const { data, error } = useSWR(kitId ? ["kit-components", kitId] : null, () =>
    componentsApi.list(kitId as string)
  );
  if (!kitId) {
    return null;
  }
  if (error) {
    return <p role="status">Couldn't load canvas components.</p>;
  }
  if (!data?.length) {
    return null;
  }
  return (
    <ConceptSelect
      label="Insert canvas component"
      onChange={(id) => {
        const component = data.find((item) => item.id === id);
        if (component) {
          onAdd({
            ...createConcept(brandDoc),
            canvasComponent: component,
            title: component.name,
          });
        }
      }}
      options={[
        { label: "Insert canvas component…", value: "none" },
        ...data.map((component) => ({
          disabled,
          label: component.name,
          value: component.id,
        })),
      ]}
      value="none"
    />
  );
}

export function CanvasComponentCard({
  concept,
  onChange,
  onRemove,
}: {
  concept: ReviewConcept;
  onChange: (concept: ReviewConcept) => void;
  onRemove: () => void;
}) {
  if (!concept.canvasComponent) {
    return null;
  }
  return (
    <article className="review-concepts__card">
      <header className="review-concepts__card-head">
        <Input
          aria-label="Concept name"
          onChange={(event) =>
            onChange({ ...concept, title: event.target.value })
          }
          size="sm"
          value={concept.title}
        />
        <Button onClick={onRemove} type="button" variant="ghost">
          Remove
        </Button>
      </header>
      <p>Canvas component · saved with this review</p>
      <ReviewCanvasComponent component={concept.canvasComponent} />
    </article>
  );
}
