import {
  type BrandComponent,
  type ComponentProp,
  targetsOf,
  withField,
} from "./model";

/**
 * Changes to a canvas component made from the brand kit's page, without
 * opening it on a board: a property's name, its starting value, or the
 * property itself. Each returns a new component; saving it redraws every
 * copy that hasn't set that property for itself.
 */

/** The component with a property's starting value changed on every layer it sets. */
export const withPropDefault = (
  component: BrandComponent,
  propId: string,
  value: string
): BrandComponent => {
  const prop = component.props.find((p) => p.id === propId);
  if (!prop) {
    return component;
  }
  const targets = targetsOf(prop);
  return {
    ...component,
    layers: component.layers.map((layer) =>
      targets
        .filter((t) => t.lid === layer.lid)
        .reduce((l, t) => withField(l, t.field, value), layer)
    ),
  };
};

/** The component with one property changed (its name, say). */
export const withProp = (
  component: BrandComponent,
  propId: string,
  patch: Partial<Pick<ComponentProp, "name" | "overridable">>
): BrandComponent => ({
  ...component,
  props: component.props.map((p) => (p.id === propId ? { ...p, ...patch } : p)),
});

/**
 * The component without a property. Its layers keep the value they have, and
 * a copy that had set it goes back to that value, since nothing sets it now.
 */
export const withoutProp = (
  component: BrandComponent,
  propId: string
): BrandComponent => ({
  ...component,
  props: component.props.filter((p) => p.id !== propId),
});
