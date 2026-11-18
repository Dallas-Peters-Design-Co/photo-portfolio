import { memo, useMemo } from "react";
import type { BoardItem } from "../../types";
import { LayerBody } from "../creative/ArtboardLayers";
import { opacityCss } from "../creative/layerOpacity";
import { rotateCss, rotationOf } from "../creative/rotate";
import { type BrandComponent, expandInstance, instanceOf } from "./model";
import { useComponentDefs } from "./store";
import "../creative/CreativeEditor.css";
import "../itemBodies.css";
import "./InstanceView.css";

/**
 * A placed component, drawn from its definition: its layers, with the
 * instance's property values, scaled into the instance's box. Nothing inside
 * is interactive; the instance is moved, sized and set as one item.
 *
 * `textRef` registers each inner text layer under its inner id, so exports
 * (which measure text from the page) can find it.
 */
export const InstanceView = memo(function InstanceBody({
  item,
  textRef,
}: {
  item: BoardItem;
  textRef?: (id: string, el: HTMLElement | null) => void;
}) {
  const lookup = useComponentDefs();
  const instance = instanceOf(item);
  const component = instance ? lookup(instance.component) : null;
  if (!component) {
    return <div className="instance instance--missing">Component</div>;
  }
  return <InstanceLayers component={component} item={item} textRef={textRef} />;
});

/**
 * An instance drawn from a definition handed in, not looked up: the brand
 * kit's list draws a component as it is being changed, before it is saved
 * (and so before the page's store knows the change).
 */
export function InstanceLayers({
  component,
  item,
  textRef,
}: {
  component: BrandComponent;
  item: BoardItem;
  textRef?: (id: string, el: HTMLElement | null) => void;
}) {
  // Worked out once per change, not per render: every inner text layer
  // re-measures itself whenever its style object is new, and a board of
  // thirty instances re-rendering while zooming made that a lot of layout.
  const layers = useMemo(
    () => expandInstance(item, component),
    [component, item]
  );
  return (
    <div className="instance">
      {layers.map((layer) => (
        <div
          className="instance__layer"
          key={layer.id}
          style={{
            height: layer.height,
            left: layer.x - item.x,
            opacity: opacityCss(layer),
            top: layer.y - item.y,
            transform: rotateCss(rotationOf(layer)),
            width: layer.width,
          }}
        >
          <LayerBody
            editing={false}
            item={layer}
            onDone={noop}
            onTextChange={noop}
            textRef={(el) => textRef?.(layer.id, el)}
          />
        </div>
      ))}
    </div>
  );
}

const noop = () => undefined;
