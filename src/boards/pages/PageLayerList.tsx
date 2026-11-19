import { SLOT_NAMES } from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { SortableList } from "../../components/admin/SortableList";

interface LayerListProps {
  elements: ReviewConceptElement[];
  onChange: (elements: ReviewConceptElement[]) => void;
  onSelect: (id: string) => void;
  selected: string | null;
}

export function PageLayerList({
  elements,
  selected,
  onSelect,
  onChange,
}: LayerListProps) {
  const update = (item: ReviewConceptElement) =>
    onChange(elements.map((el) => (el.id === item.id ? item : el)));
  return (
    <SortableList
      itemLabel={(el) =>
        `${el.kind} layer ${el.text.split("\n")[0] || "Untitled"}`
      }
      items={elements}
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
      {(el, { compact, handle }) => (
        <>
          <div className="page-builder__layer-row">
            {elements.length > 1 ? handle : null}
            <button
              aria-pressed={selected === el.id}
              className="page-builder__layer"
              onClick={() => onSelect(el.id)}
              type="button"
            >
              {el.kind}
              <span>{el.text.split("\n")[0] || "Untitled"}</span>
            </button>
          </div>
          {!compact &&
            SLOT_NAMES.map((name) => {
              const slot = el.slots?.[name];
              if (!slot?.elements.length) {
                return null;
              }
              return (
                <div className="page-builder__layer-children" key={name}>
                  <span className="page-builder__slot-label">{name}</span>
                  <PageLayerList
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
                </div>
              );
            })}
          {!compact && el.group?.elements.length ? (
            <div className="page-builder__layer-children">
              <PageLayerList
                elements={el.group.elements}
                onChange={(next) =>
                  update({ ...el, group: { ...el.group, elements: next } })
                }
                onSelect={onSelect}
                selected={selected}
              />
            </div>
          ) : null}
        </>
      )}
    </SortableList>
  );
}
