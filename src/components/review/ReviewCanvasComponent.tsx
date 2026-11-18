import { useEffect, useMemo, useRef, useState } from "react";
import { InstanceLayers } from "../../boards/components/InstanceView";
import {
  type BrandComponent,
  newInstance,
} from "../../boards/components/model";
import "./ReviewCanvasComponent.css";

/** A review carries the component's layers, so visitors need no kit access. */
export function ReviewCanvasComponent({
  component,
}: {
  component: BrandComponent;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(component.width);
  const item = useMemo(
    () => newInstance(component, { x: 0, y: 0 }, []),
    [component]
  );
  useEffect(() => {
    const node = container.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, width / component.width);
  return (
    <div className="review-canvas-component" ref={container}>
      <div
        style={{
          height: component.height * scale,
          width: component.width * scale,
        }}
      >
        <div
          className="review-canvas-component__layers"
          style={{
            height: component.height,
            transform: `scale(${scale})`,
            width: component.width,
          }}
        >
          <InstanceLayers component={component} item={item} />
        </div>
      </div>
    </div>
  );
}
