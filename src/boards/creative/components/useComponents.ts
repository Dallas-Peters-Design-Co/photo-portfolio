import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "../../../components/admin/ConfirmProvider";
import type { BoardItem } from "../../../types";
import { useActiveBrand } from "../../brand/ActiveBrand";
import {
  type BrandComponent,
  copyLayers,
  copyOf,
  detachCopy,
  draftFrom,
  linkOf,
  placeIn,
  resetCopy,
  syncAll,
} from "./componentModel";
import { componentsApi } from "./componentsApi";

/**
 * The frame editor's brand components: the active brand's list, making one
 * from the selection, dropping a copy in, and keeping every copy on the board
 * in line when a component changes (componentModel.ts).
 */
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
  const { prompt } = useConfirm();
  const kit = useActiveBrand()?.kit ?? null;
  const kitId = kit?.id ?? null;
  const [components, setComponents] = useState<BrandComponent[]>([]);
  const latest = useRef(items);
  latest.current = items;
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    setComponents([]);
    if (!kitId) {
      return;
    }
    let alive = true;
    componentsApi
      .list(kitId)
      .then((list) => alive && setComponents(list))
      .catch((e: Error) => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, [kitId]);

  // Copies on this board brought in line whenever the list (or a component
  // in it) changes. Only copies whose component moved on are touched.
  useEffect(() => {
    if (components.length === 0) {
      return;
    }
    const next = syncAll(latest.current, components);
    if (next) {
      change.current(next);
    }
  }, [components]);

  const make = useCallback(
    async (chosen: BoardItem[]) => {
      if (!(frame && kitId) || chosen.length === 0) {
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
        const draft = draftFrom(chosen, frame, name);
        const saved = await componentsApi.save({ ...draft, kitId });
        // The chosen layers become its first copy, where they were.
        const ids = new Set(chosen.map((l) => l.id));
        const z0 = Math.min(...chosen.map((l) => l.z));
        const at = {
          x: frame.x + (draft.placement.x ?? 0),
          y: frame.y + (draft.placement.y ?? 0),
        };
        const copy = copyOf(saved, at, []).map((l, k) => ({ ...l, z: z0 + k }));
        onChange([...latest.current.filter((i) => !ids.has(i.id)), ...copy]);
        setComponents((was) => [...was, saved]);
        select(copy.map((l) => l.id));
        toast.success(`${name} saved to ${kit?.name ?? "the brand"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save it");
      }
    },
    [frame, kit?.name, kitId, onChange, prompt, select]
  );

  const insert = useCallback(
    (component: BrandComponent) => {
      if (!frame) {
        return;
      }
      const copy = copyOf(component, placeIn(component, frame), latest.current);
      onChange([...latest.current, ...copy]);
      select(copy.map((l) => l.id));
    },
    [frame, onChange, select]
  );

  /** The component made to match this copy; every other copy follows. */
  const update = useCallback(
    async (layer: BoardItem) => {
      const link = linkOf(layer);
      const component = components.find((c) => c.id === link?.c);
      if (!(frame && link && component)) {
        return;
      }
      try {
        const layers = copyLayers(latest.current, layer);
        const saved = await componentsApi.save({
          ...draftFrom(layers, frame, component.name),
          id: component.id,
        });
        setComponents((was) => was.map((c) => (c.id === saved.id ? saved : c)));
        toast.success(`${component.name} updated everywhere`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update it");
      }
    },
    [components, frame]
  );

  const reset = useCallback(
    (layer: BoardItem) => {
      const link = linkOf(layer);
      const component = components.find((c) => c.id === link?.c);
      if (link && component) {
        onChange(resetCopy(latest.current, component, link.i));
      }
    },
    [components, onChange]
  );

  const detach = useCallback(
    (layer: BoardItem) => {
      const link = linkOf(layer);
      if (link) {
        onChange(detachCopy(latest.current, link.i));
      }
    },
    [onChange]
  );

  const remove = useCallback(async (component: BrandComponent) => {
    try {
      await componentsApi.remove(component.id);
      setComponents((was) => was.filter((c) => c.id !== component.id));
      toast.success(
        `${component.name} deleted. Copies already placed stay as they are.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete it");
    }
  }, []);

  const componentOf = (layer: BoardItem | null) => {
    const link = layer ? linkOf(layer) : null;
    return link ? (components.find((c) => c.id === link.c) ?? null) : null;
  };

  return {
    componentOf,
    components,
    detach,
    insert,
    kitName: kit?.name ?? null,
    make,
    remove,
    reset,
    selectCopy: (layer: BoardItem) =>
      select(copyLayers(latest.current, layer).map((l) => l.id)),
    update,
  };
};
