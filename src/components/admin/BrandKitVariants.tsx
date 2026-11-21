import type { ReactNode } from "react";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import type { groupKitVariants } from "../../../config/kitVariants.js";
import { Button } from "../ui/button";
import { kindLabel } from "./ConceptControls";
import { SortableList } from "./SortableList";

type Kind = ConceptStyle["kind"];

export function BrandKitVariants({
  groups,
  onAdd,
  onReorder,
  children,
}: {
  groups: ReturnType<typeof groupKitVariants>;
  onAdd?: (kind: Kind) => void;
  onReorder: (styles: ConceptStyle[]) => void;
  children: (style: ConceptStyle, handle: ReactNode) => ReactNode;
}) {
  return (
    <SortableList
      itemLabel={(group) => `${kindLabel(group.id)} group`}
      items={groups}
      markDrop
      onReorder={(ids) =>
        onReorder(
          ids.flatMap(
            (id) => groups.find((group) => group.id === id)?.variants ?? []
          )
        )
      }
    >
      {({ id, variants }, { handle }) => (
        <section
          aria-label={`${kindLabel(id)} variants`}
          className="brand-kit-components__variants"
        >
          <header className="brand-kit-components__variants-head">
            {handle}
            <h3>{kindLabel(id)}</h3>
            <span>
              {variants.length} {variants.length === 1 ? "variant" : "variants"}
            </span>
            <Button
              aria-label={`Add ${kindLabel(id)} variant`}
              disabled={!onAdd}
              onClick={() => onAdd?.(id)}
              size="xs"
              type="button"
              variant="outline"
            >
              Add variant
            </Button>
          </header>
          <SortableList
            itemLabel={(style) => `${kindLabel(style.kind)} ${style.name}`}
            items={variants}
            markDrop
            onReorder={(ids) => {
              const ordered = ids.flatMap(
                (key) => variants.find((style) => style.id === key) ?? []
              );
              onReorder(
                groups.flatMap((group) =>
                  group.id === id ? ordered : group.variants
                )
              );
            }}
          >
            {(style, ctx) => children(style, ctx.handle)}
          </SortableList>
        </section>
      )}
    </SortableList>
  );
}
