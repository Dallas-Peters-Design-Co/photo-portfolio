import { Copy, Palette, Trash2, Type } from "lucide-react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { InstanceLayers } from "../../boards/components/InstanceView";
import {
  withoutProp,
  withProp,
  withPropDefault,
} from "../../boards/components/kitEdits";
import { componentLogoUrl, relinked } from "../../boards/components/logoSync";
import {
  type BrandComponent,
  type ComponentProp,
  newInstance,
  propValue,
  targetsOf,
} from "../../boards/components/model";
import { rememberComponents } from "../../boards/components/store";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { useConfirm } from "./ConfirmProvider";
import { ConceptColorField } from "./ReviewConceptBrand";
import { SortableList } from "./SortableList";
import "./ReviewConceptsEditor.css";
import "./BrandKitCanvasComponents.css";

/**
 * The kit's canvas components: the ones made on a board (select layers, Make
 * component), listed here with their properties. A name, a property's name
 * and its starting value are changed here; the layers themselves are changed
 * on a board (Edit component). A change is saved a moment after it is made,
 * and every copy on every board follows.
 */

/** How long after the last change a component saves itself. */
const SAVE_MS = 700;
const PREVIEW = { height: 140, width: 280 };

type SetDoc = Dispatch<SetStateAction<BrandKitDoc>>;

/** The component drawn small, as it is now (saved or not). */
function Preview({ component }: { component: BrandComponent }) {
  const item = useMemo(
    () => ({ ...newInstance(component, { x: 0, y: 0 }, []), id: component.id }),
    [component]
  );
  const scale = Math.min(
    1,
    PREVIEW.width / component.width,
    PREVIEW.height / component.height
  );
  return (
    <div
      className="kit-canvas-components__preview"
      style={{
        height: component.height * scale,
        width: component.width * scale,
      }}
    >
      <div
        className="kit-canvas-components__scaled"
        style={{
          height: component.height,
          transform: `scale(${scale})`,
          width: component.width,
        }}
      >
        <InstanceLayers component={component} item={item} />
      </div>
    </div>
  );
}

function PropRow({
  brandDoc,
  component,
  onChange,
  prop,
}: {
  brandDoc: BrandKitDoc;
  component: BrandComponent;
  onChange: (next: BrandComponent) => void;
  prop: ComponentProp;
}) {
  const overrideId = useId();
  const value = propValue(component, prop, {});
  const sets = targetsOf(prop).length;
  return (
    <li className="kit-canvas-components__prop">
      <span className="kit-canvas-components__prop-kind">
        {prop.type === "text" ? (
          <Type aria-hidden size={13} />
        ) : (
          <Palette aria-hidden size={13} />
        )}
        {prop.type === "text" ? "Text" : "Colour"}
        {sets > 1 ? ` · sets ${sets} layers` : ""}
      </span>
      <Input
        aria-label={`${prop.name} property name`}
        onChange={(e) =>
          onChange(withProp(component, prop.id, { name: e.target.value }))
        }
        placeholder="Property name"
        size="sm"
        value={prop.name}
      />
      {prop.type === "text" ? (
        <textarea
          aria-label={`${prop.name} starting text`}
          className="admin-control kit-canvas-components__text"
          onChange={(e) =>
            onChange(withPropDefault(component, prop.id, e.target.value))
          }
          rows={Math.min(4, Math.max(1, value.split("\n").length))}
          value={value}
        />
      ) : (
        <ConceptColorField
          ariaLabel={`${prop.name} starting colour`}
          brandDoc={brandDoc}
          label="Starts as"
          onChange={(next) =>
            onChange(withPropDefault(component, prop.id, next))
          }
          value={value || "#000000"}
        />
      )}
      <label className="kit-canvas-components__override" htmlFor={overrideId}>
        <Checkbox
          aria-label={`Allow ${prop.name} to be changed on copies`}
          checked={prop.overridable !== false}
          id={overrideId}
          onChange={(event) =>
            onChange(
              withProp(component, prop.id, {
                overridable: event.currentTarget.checked,
              })
            )
          }
        />
        Allow overrides
      </label>
      <Button
        aria-label={`Remove the ${prop.name} property`}
        onClick={() => onChange(withoutProp(component, prop.id))}
        size="icon-sm"
        title="Remove the property: copies can no longer change it"
        type="button"
        variant="ghost"
      >
        <Trash2 size={13} />
      </Button>
    </li>
  );
}

/** One component: its preview, its name, its properties. Saves itself. */
function ComponentCard({
  brandDoc,
  compact,
  handle,
  onDeleted,
  onSaved,
  saved,
}: {
  brandDoc: BrandKitDoc;
  compact: boolean;
  handle: ReactNode;
  onDeleted: () => void;
  onSaved: (component: BrandComponent) => void;
  saved: BrandComponent;
}) {
  const { confirm } = useConfirm();
  const [draft, setDraft] = useState(saved);
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "failed">(
    "idle"
  );
  const [isDuplicating, setIsDuplicating] = useState(false);
  // The newest draft, for the save that fires after the pause.
  const latest = useRef(draft);
  latest.current = draft;
  // Through a ref: the caller's handler is new on every render, and as a
  // dependency it would restart the pause each time the kit page redraws.
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  const change = (next: BrandComponent) => {
    setDraft(next);
    setState("dirty");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: each change to the draft restarts the pause
  useEffect(() => {
    if (state !== "dirty") {
      return;
    }
    const timer = setTimeout(async () => {
      const sending = latest.current;
      if (!sending.name.trim()) {
        // A component needs a name; wait for one rather than refuse loudly.
        return;
      }
      setState("saving");
      try {
        const { id, kitId: _kit, updatedAt: _at, ...rest } = sending;
        const next = await componentsApi.save({ ...rest, id });
        savedRef.current(next);
        // Typing went on while it saved: keep the newer words, save again.
        setState(latest.current === sending ? "idle" : "dirty");
      } catch (e) {
        setState("failed");
        toast.error(e instanceof Error ? e.message : "Couldn't save it");
      }
    }, SAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, state]);

  const remove = async () => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description:
        "Copies of it on boards will show an empty box. A logo drawn from it keeps its last picture.",
      destructive: true,
      title: `Delete ${saved.name}?`,
    });
    if (!ok) {
      return;
    }
    try {
      await componentsApi.remove(saved.id);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete it");
    }
  };

  const duplicate = async () => {
    setIsDuplicating(true);
    try {
      const { id: _id, kitId: _kitId, updatedAt: _updatedAt, ...copy } = draft;
      const next = await componentsApi.save({
        ...copy,
        kitId: saved.kitId,
        name: `${draft.name.slice(0, 54)} copy`,
      });
      savedRef.current(next);
      toast.success(`Duplicated ${draft.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't duplicate it");
    } finally {
      setIsDuplicating(false);
    }
  };

  const STATUS = {
    dirty: "Saving…",
    failed: "Not saved",
    idle: "",
    saving: "Saving…",
  } as const;

  return (
    <article className="kit-canvas-components__item">
      <Preview component={draft} />
      <div className="kit-canvas-components__body">
        <div className="kit-canvas-components__head">
          <Input
            aria-label="Component name"
            onChange={(e) => change({ ...draft, name: e.target.value })}
            placeholder="Component name"
            size="sm"
            value={draft.name}
          />
          <span className="kit-canvas-components__meta">
            {Math.round(draft.width)} × {Math.round(draft.height)} ·{" "}
            {draft.layers.length}{" "}
            {draft.layers.length === 1 ? "layer" : "layers"}
          </span>
          <span aria-live="polite" className="kit-canvas-components__meta">
            {STATUS[state]}
          </span>
        </div>
        {!compact &&
          (draft.props.length > 0 ? (
            <ul className="kit-canvas-components__props">
              {draft.props.map((prop) => (
                <PropRow
                  brandDoc={brandDoc}
                  component={draft}
                  key={prop.id}
                  onChange={change}
                  prop={prop}
                />
              ))}
            </ul>
          ) : (
            <p className="brand-kit__hint">
              No properties yet. On a board, select a copy and choose Add
              property to let each copy change a text or a colour.
            </p>
          ))}
      </div>
      <footer className="kit-canvas-components__footer">
        {handle}
        <Button
          aria-label={`Duplicate ${saved.name}`}
          disabled={isDuplicating}
          onClick={() => void duplicate()}
          size="icon-sm"
          title="Duplicate the component"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden size={13} />
        </Button>
        <Button
          aria-label={`Delete ${saved.name}`}
          onClick={() => void remove()}
          size="icon-sm"
          title="Delete the component"
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      </footer>
    </article>
  );
}

export function BrandKitCanvasComponents({
  doc,
  effective,
  kitId,
  setDoc,
}: {
  doc: BrandKitDoc;
  /** The kit as it resolves: its palette, for the colour choices. */
  effective: BrandKitDoc;
  kitId: string;
  setDoc: SetDoc;
}) {
  const {
    data: components = [],
    isLoading,
    mutate,
  } = useSWR(["kit-components", kitId], () => componentsApi.list(kitId));

  // A logo that follows a component is drawn again from its new look, into
  // the kit as it is being edited (not saved behind the editor's back).
  const follows = (id: string) => doc.logos.some((l) => l.componentId === id);
  const ordered = [...components].sort((a, b) => {
    const aIndex = doc.canvasComponentOrder.indexOf(a.id);
    const bIndex = doc.canvasComponentOrder.indexOf(b.id);
    if (aIndex < 0 && bIndex < 0) {
      return 0;
    }
    if (aIndex < 0) {
      return 1;
    }
    if (bIndex < 0) {
      return -1;
    }
    return aIndex - bIndex;
  });
  const saved = async (component: BrandComponent) => {
    rememberComponents([component]);
    await mutate(
      (list = []) =>
        list.some((c) => c.id === component.id)
          ? list.map((c) => (c.id === component.id ? component : c))
          : [...list, component],
      { revalidate: false }
    );
    if (!follows(component.id)) {
      return;
    }
    try {
      const url = await componentLogoUrl(component);
      setDoc((d) => ({ ...d, logos: relinked(d.logos, component.id, url) }));
    } catch {
      toast.error(
        `${component.name} is saved, but its logo couldn't be drawn again.`
      );
    }
  };

  if (isLoading) {
    return <p className="brand-kit__hint">Loading…</p>;
  }
  if (components.length === 0) {
    return (
      <p className="brand-kit__hint">
        No canvas components yet. On a board, open a frame, select some layers
        and choose Make component: it is saved to the brand and listed here.
      </p>
    );
  }
  return (
    <div className="stack stack--snug">
      <p className="brand-kit__hint">
        Made on boards, kept in this brand. Change a name, a property or what it
        starts as here; every copy follows. To change its layers, select a copy
        on a board and choose Edit component.
      </p>
      <SortableList
        itemLabel={(component) => component.name}
        items={ordered}
        layout="grid"
        onReorder={(ids) =>
          setDoc((current) => ({ ...current, canvasComponentOrder: ids }))
        }
      >
        {(component, { compact, handle }) => (
          <ComponentCard
            brandDoc={effective}
            compact={compact}
            handle={handle}
            key={component.id}
            onDeleted={() => {
              setDoc((current) => ({
                ...current,
                canvasComponentOrder: current.canvasComponentOrder.filter(
                  (id) => id !== component.id
                ),
              }));
              void mutate(
                (list = []) => list.filter((c) => c.id !== component.id),
                { revalidate: false }
              );
            }}
            onSaved={(next) => void saved(next)}
            saved={component}
          />
        )}
      </SortableList>
    </div>
  );
}
