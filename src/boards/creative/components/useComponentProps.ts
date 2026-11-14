import { useCallback } from "react";
import { toast } from "sonner";
import {
  alikeOf,
  type BrandComponent,
  type ComponentProp,
  type PropTarget,
} from "../../components/model";
import { newItemId } from "../../io/newItemId";
import { componentsApi } from "./componentsApi";

/**
 * Properties changed straight from an instance, without opening the
 * component: a new one (taking in the layers like it), or a layer's field
 * joining one that's there.
 */

const shortId = () => newItemId().replaceAll("-", "").slice(0, 12);

export const useComponentProps = (keep: (list: BrandComponent[]) => void) => {
  /** The component saved with new properties. */
  const saveProps = useCallback(
    async (component: BrandComponent, props: ComponentProp[]) => {
      try {
        const { id, kitId: _kit, updatedAt: _at, ...draft } = component;
        keep([await componentsApi.save({ ...draft, id, props })]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save it");
      }
    },
    [keep]
  );

  /**
   * A property added straight from an instance, without opening it. Layers
   * like it (the same colour on the same kind of field) share it.
   */
  const addProp = useCallback(
    (component: BrandComponent, prop: Omit<ComponentProp, "id">) => {
      const more =
        prop.type === "color" ? alikeOf(component, prop.lid, prop.field) : [];
      return saveProps(component, [
        ...component.props,
        { ...prop, id: shortId(), ...(more.length > 0 ? { more } : {}) },
      ]);
    },
    [saveProps]
  );

  /** A layer's field joins a property the component already has. */
  const joinProp = useCallback(
    (component: BrandComponent, propId: string, target: PropTarget) =>
      saveProps(
        component,
        component.props.map((p) =>
          p.id === propId ? { ...p, more: [...(p.more ?? []), target] } : p
        )
      ),
    [saveProps]
  );

  return { addProp, joinProp };
};
