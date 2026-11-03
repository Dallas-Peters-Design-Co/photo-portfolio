import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "../../../components/admin/ConfirmProvider";
import type { BoardItem } from "../../../types";
import { useActiveBrand } from "../../brand/ActiveBrand";
import {
  type BrandComponent,
  type ComponentProp,
  draftFrom,
  expandInstance,
  instanceOf,
  newInstance,
  type PropField,
  placeIn,
  resolvedLayers,
  startingProps,
} from "../../components/model";
import { rememberComponents, useComponentDefs } from "../../components/store";
import { newItemId } from "../../io/newItemId";
import { componentsApi } from "./componentsApi";

/**
 * The frame editor's brand components (components/model.ts).
 *
 * A component is placed as one item, an instance, drawn from the component.
 * An instance sets the properties the component exposes; nothing else inside
 * it can be changed from the instance. To change the component itself, Edit
 * component opens its layers in place: change anything, expose layers' text
 * or colours as properties, and Done saves it (every instance redraws) and
 * closes it back into the instance.
 *
 * While editing, the open layers carry a link (config.component: c, i, l) so
 * an edit survives a reload and can be finished or cancelled after it.
 */

interface Link {
  c: string;
  i: string;
  l: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

/** The editing link on an open component layer, if it has one. */
export const editLinkOf = (item: BoardItem): Link | null => {
  const o = (item.config as { component?: unknown } | null)?.component as
    | Partial<Link>
    | undefined;
  return item.kind !== "component" &&
    o &&
    typeof o.c === "string" &&
    typeof o.i === "string" &&
    UUID.test(o.i) &&
    typeof o.l === "string"
    ? { c: o.c, i: o.i, l: o.l }
    : null;
};

const shortId = () => newItemId().replaceAll("-", "").slice(0, 12);

const withLink = (item: BoardItem, link: Link): BoardItem => ({
  ...item,
  config: { ...(item.config ?? {}), component: { ...link, base: {} } },
});

interface Editing {
  component: BrandComponent;
  /** The instance being edited through, put back when editing ends. */
  instance: BoardItem;
  props: ComponentProp[];
}

export const useComponents = ({
  frame,
  items,
  onChange,
  select,
}: {
  frame: BoardItem | undefined;
  items: BoardItem[];
  onChange: (next: BoardItem[]) => void;
  select: (ids: string[]) => void;
}) => {
  const { confirm, prompt } = useConfirm();
  const kit = useActiveBrand()?.kit ?? null;
  const kitId = kit?.id ?? null;
  const lookup = useComponentDefs();
  const [components, setComponents] = useState<BrandComponent[]>([]);
  const [stash, setStash] = useState<Editing | null>(null);
  const latest = useRef(items);
  latest.current = items;

  const keep = useCallback((list: BrandComponent[]) => {
    rememberComponents(list);
    setComponents((was) => {
      const byId = new Map(was.map((c) => [c.id, c]));
      for (const c of list) {
        byId.set(c.id, c);
      }
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  useEffect(() => {
    setComponents([]);
    if (!kitId) {
      return;
    }
    let alive = true;
    componentsApi
      .list(kitId)
      .then((list) => alive && keep(list))
      .catch((e: Error) => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, [keep, kitId]);

  // An edit open on this board: the one started here, or one left open by a
  // reload (its instance is put back as it was placed, at the layers' corner).
  const openLayers = items.filter((i) => editLinkOf(i));
  const openLink = openLayers[0] ? editLinkOf(openLayers[0]) : null;
  const openComponent = openLink ? lookup(openLink.c) : null;
  const editing: Editing | null =
    stash ??
    (openLink && openComponent
      ? {
          component: openComponent,
          instance: {
            ...newInstance(openComponent, { x: 0, y: 0 }, []),
            id: openLink.i,
          },
          props: openComponent.props,
        }
      : null);

  const make = useCallback(
    async (chosen: BoardItem[]) => {
      if (!(frame && kitId) || chosen.length === 0) {
        return;
      }
      if (chosen.some((l) => l.kind === "component")) {
        toast.error("A component can't hold another component yet.");
        return;
      }
      const name = (
        await prompt({
          confirmLabel: "Make component",
          defaultValue: "",
          placeholder: "Vision tag",
          title: `New ${kit?.name ?? "brand"} component`,
        })
      )?.trim();
      if (!name) {
        return;
      }
      try {
        const plain = draftFrom(chosen, frame, name);
        const draft = { ...plain, props: startingProps(plain) };
        const saved = await componentsApi.save({ ...draft, kitId });
        keep([saved]);
        // The chosen layers become one instance, where they were.
        const ids = new Set(chosen.map((l) => l.id));
        const instance = {
          ...newInstance(
            saved,
            {
              x: frame.x + (draft.placement.x ?? 0),
              y: frame.y + (draft.placement.y ?? 0),
            },
            []
          ),
          z: Math.min(...chosen.map((l) => l.z)),
        };
        onChange([...latest.current.filter((i) => !ids.has(i.id)), instance]);
        select([instance.id]);
        toast.success(
          `${name} saved to ${kit?.name ?? "the brand"}. Edit component to choose what each copy can change.`
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save it");
      }
    },
    [frame, keep, kit?.name, kitId, onChange, prompt, select]
  );

  const insert = useCallback(
    (component: BrandComponent) => {
      if (!frame) {
        return;
      }
      const item = newInstance(
        component,
        placeIn(component, frame),
        latest.current
      );
      onChange([...latest.current, item]);
      select([item.id]);
    },
    [frame, onChange, select]
  );

  const patchInstance = useCallback(
    (item: BoardItem, props: Record<string, string>) =>
      onChange(
        latest.current.map((i) =>
          i.id === item.id
            ? { ...i, config: { ...(i.config ?? {}), props } }
            : i
        )
      ),
    [onChange]
  );

  const setProp = useCallback(
    (item: BoardItem, id: string, value: string) =>
      patchInstance(item, { ...(instanceOf(item)?.props ?? {}), [id]: value }),
    [patchInstance]
  );

  const resetProps = useCallback(
    (item: BoardItem) => patchInstance(item, {}),
    [patchInstance]
  );

  /** The instance made into ordinary layers, no longer linked. */
  const detach = useCallback(
    (item: BoardItem) => {
      const instance = instanceOf(item);
      const component = instance ? lookup(instance.component) : null;
      if (!component) {
        return;
      }
      const layers = expandInstance(item, component).map((l, k) => ({
        ...l,
        id: newItemId(),
        z: item.z + k * 0.001,
      }));
      onChange([...latest.current.filter((i) => i.id !== item.id), ...layers]);
      select(layers.map((l) => l.id));
    },
    [lookup, onChange, select]
  );

  /** Opens the component's layers in place of this instance. */
  const startEdit = useCallback(
    (item: BoardItem) => {
      const instance = instanceOf(item);
      const component = instance ? lookup(instance.component) : null;
      if (!component || editing) {
        return;
      }
      const layers = resolvedLayers(component, {}).map((layer, k) =>
        withLink(
          {
            body: layer.body,
            config: layer.config,
            creditName: null,
            creditUrl: null,
            fontSize: layer.fontSize,
            height: layer.height,
            id: newItemId(),
            imageUrl: layer.imageUrl,
            kind: layer.kind,
            nodeType: null,
            photoId: null,
            result: null,
            rotation: layer.rotation ?? 0,
            runError: null,
            runState: null,
            textStyle: layer.textStyle ?? null,
            thumbUrl: layer.thumbUrl,
            width: layer.width,
            x: item.x + layer.x,
            y: item.y + layer.y,
            z: item.z + k * 0.001,
          },
          { c: component.id, i: item.id, l: layer.lid }
        )
      );
      setStash({ component, instance: item, props: component.props });
      onChange([...latest.current.filter((i) => i.id !== item.id), ...layers]);
      select([]);
    },
    [editing, lookup, onChange, select]
  );

  const setProps = (props: ComponentProp[]) =>
    editing && setStash({ ...editing, props });

  const expose = (
    layer: BoardItem,
    field: PropField,
    label: string,
    type: ComponentProp["type"]
  ) => {
    const link = editLinkOf(layer);
    if (!(editing && link)) {
      return;
    }
    setProps([
      ...editing.props,
      { field, id: shortId(), lid: link.l, name: label, type },
    ]);
  };

  /** A layer of the frame taken into the component being edited. */
  const addToComponent = (layer: BoardItem) => {
    if (!editing) {
      return;
    }
    onChange(
      latest.current.map((i) =>
        i.id === layer.id
          ? withLink(i, {
              c: editing.component.id,
              i: editing.instance.id,
              l: shortId(),
            })
          : i
      )
    );
  };

  const finishEdit = useCallback(
    async (save: boolean) => {
      if (!(editing && frame)) {
        return;
      }
      const open = latest.current.filter(
        (i) => editLinkOf(i)?.i === editing.instance.id
      );
      const rest = latest.current.filter(
        (i) => editLinkOf(i)?.i !== editing.instance.id
      );
      let { component } = editing;
      if (save && open.length > 0) {
        try {
          const lids = new Set(open.map((l) => editLinkOf(l)?.l));
          component = await componentsApi.save({
            ...draftFrom(
              open,
              frame,
              component.name,
              editing.props.filter((p) => lids.has(p.lid)),
              (l) => editLinkOf(l)?.l ?? null
            ),
            id: component.id,
          });
          keep([component]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't save it");
          return;
        }
      }
      const corner =
        open.length > 0
          ? {
              x: Math.min(...open.map((l) => l.x)),
              y: Math.min(...open.map((l) => l.y)),
            }
          : { x: editing.instance.x, y: editing.instance.y };
      const back: BoardItem = save
        ? {
            ...editing.instance,
            height: component.height,
            width: component.width,
            x: corner.x,
            y: corner.y,
            z: Math.min(...open.map((l) => l.z), editing.instance.z),
          }
        : editing.instance;
      setStash(null);
      onChange([...rest, back]);
      select([back.id]);
      if (save) {
        toast.success(`${component.name} saved. Every copy has the change.`);
      }
    },
    [editing, frame, keep, onChange, select]
  );

  const remove = useCallback(
    async (component: BrandComponent) => {
      const ok = await confirm({
        confirmLabel: "Delete",
        description:
          "Copies already placed will show as an empty box. Detach them first to keep them as layers.",
        title: `Delete ${component.name}?`,
      });
      if (!ok) {
        return;
      }
      try {
        await componentsApi.remove(component.id);
        setComponents((was) => was.filter((c) => c.id !== component.id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete it");
      }
    },
    [confirm]
  );

  /** A property added straight from an instance, without opening it. */
  const addProp = useCallback(
    async (component: BrandComponent, prop: Omit<ComponentProp, "id">) => {
      try {
        const { id, kitId: _kit, updatedAt: _at, ...draft } = component;
        const saved = await componentsApi.save({
          ...draft,
          id,
          props: [...component.props, { ...prop, id: shortId() }],
        });
        keep([saved]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add it");
      }
    },
    [keep]
  );

  return {
    addProp,
    addToComponent,
    components,
    detach,
    editing,
    expose,
    finishEdit,
    insert,
    kitName: kit?.name ?? null,
    lookup,
    make,
    remove,
    resetProps,
    setProp,
    setProps,
    startEdit,
  };
};
