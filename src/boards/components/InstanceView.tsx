import type { BoardItem } from "../../types";
import { LayerBody } from "../creative/ArtboardLayers";
import { opacityCss } from "../creative/layerOpacity";
import { rotateCss, rotationOf } from "../creative/rotate";
import { expandInstance, instanceOf } from "./model";
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
export function InstanceView({
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
  return (
    <div className="instance">
      {expandInstance(item, component).map((layer) => (
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
