import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight } from "lucide-react";
import { MAX_SLOT_DEPTH } from "../../../config/conceptSlots.js";
import { layerSlots } from "../../../config/pageLayerMove.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { SortableList } from "../../components/admin/SortableList";

import { useLayerDrag } from "./PageLayerDrag";

interface LayerListProps {
  depth?: number;
  elements: ReviewConceptElement[];
  onChange: (elements: ReviewConceptElement[]) => void;
  onSelect: (id: string) => void;
  selected: string | null;
}

export function PageLayerList({
  elements,
  depth = 0,
  selected,
  onSelect,
  onChange,
}: LayerListProps) {
  const drag = useLayerDrag();
  const update = (item: ReviewConceptElement) =>
    onChange(elements.map((el) => (el.id === item.id ? item : el)));
  return (
    <SortableList
      itemLabel={(el) =>
        `${el.kind} layer ${el.text.split("\n")[0] || "Untitled"}`
      }
      items={elements}
      nativeDrag={drag.enabled}
      onReorder={(ids) => {
        const byId = new Map(elements.map((el) => [el.id, el]));
        const next = ids.map((id) => byId.get(id));
        if (
          next.length === elements.length &&
          next.every((el) => el !== undefined)
        ) {
          onChange(next);
        }
      }}
    >
      {(el, { compact, handle }) => {
        const label = el.text.split("\n")[0] || "Untitled";
        const slots = layerSlots(el.kind).flatMap((name) => {
          const slot = el.slots?.[name];
          return slot?.elements.length ||
            (drag.dragging && depth < MAX_SLOT_DEPTH)
            ? [{ name, slot: slot ?? { elements: [] } }]
            : [];
        });
        const hasChildren = Boolean(el.group?.elements.length || slots.length);
        const row = (
          <div
            className="page-builder__layer-row"
            {...drag.props(el.id, el.kind === "group")}
          >
            {(drag.enabled || elements.length > 1) && handle}
            {hasChildren && (
              <Collapsible.Trigger
                aria-label={`Children of ${el.kind} layer ${label}`}
                className="page-builder__layer-disclosure"
              >
                <ChevronRight aria-hidden size={14} />
              </Collapsible.Trigger>
            )}
            <button
              aria-pressed={selected === el.id}
              className="page-builder__layer"
              onClick={() => onSelect(el.id)}
              type="button"
            >
              {el.kind}
              <span>{label}</span>
            </button>
          </div>
        );
        if (!hasChildren) {
          return row;
        }
        return (
          <Collapsible.Root defaultOpen>
            {row}
            <Collapsible.Panel keepMounted>
              <div hidden={compact}>
                {slots.map(({ name, slot }) => (
                  <Collapsible.Root
                    className="page-builder__layer-children"
                    defaultOpen
                    key={name}
                  >
                    <Collapsible.Trigger
                      {...drag.target(el.id, name)}
                      aria-label={`${name} slot of ${label}`}
                      className="page-builder__layer-disclosure page-builder__slot-label"
                    >
                      <ChevronRight aria-hidden size={14} />
                      {name}
                    </Collapsible.Trigger>
                    <Collapsible.Panel
                      className="page-builder__layer-children"
                      keepMounted
                    >
                      <PageLayerList
                        depth={depth + 1}
                        elements={slot.elements}
                        onChange={(next) =>
                          update({
                            ...el,
                            slots: {
                              ...el.slots,
                              [name]: { ...slot, elements: next },
                            },
                          })
                        }
                        onSelect={onSelect}
                        selected={selected}
                      />
                    </Collapsible.Panel>
                  </Collapsible.Root>
                ))}
                {el.group?.elements.length ? (
                  <div className="page-builder__layer-children">
                    <PageLayerList
                      depth={depth + 1}
                      elements={el.group.elements}
                      onChange={(next) =>
                        update({
                          ...el,
                          group: { ...el.group, elements: next },
                        })
                      }
                      onSelect={onSelect}
                      selected={selected}
                    />
                  </div>
                ) : null}
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        );
      }}
    </SortableList>
  );
}
