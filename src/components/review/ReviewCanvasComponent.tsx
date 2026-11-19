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
  size,
}: {
  component: BrandComponent;
  size?: { width: number; height: number };
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
  const scale = width / component.width;
  const height = size
    ? (size.height * width) / size.width
    : component.height * scale;
  return (
    <div
      className="review-canvas-component"
      ref={container}
      style={{ width: `min(100%, ${size?.width ?? component.width}px)` }}
    >
      <div
        style={{
          height,
          width: component.width * scale,
        }}
      >
        <div
          className="review-canvas-component__layers"
          style={{
            height: component.height,
            transform: `scale(${scale}, ${height / component.height})`,
            width: component.width,
          }}
        >
          <InstanceLayers component={component} item={item} />
        </div>
      </div>
    </div>
  );
}
