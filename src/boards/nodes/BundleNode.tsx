import { BUNDLE } from "../../../config/nodes/bundle.js";
import type { BoardItem } from "../../types";
import { NodeHeader } from "./NodeHeader";
import { SettingField } from "./SettingField";
import "./BundleNode.css";
import "./OpNodeView.css";

/**
 * A Bundle node: what it is carrying, kind by kind.
 *
 * Its own body rather than OpNodeView's, because there is nothing to run and
 * nothing it made — its whole value is what passes through it. So the node
 * lists that, in the order its output ports sit down the right-hand edge:
 * pictures, then words, then clips. A bundle that quietly lost its references
 * would otherwise look exactly like one that was full.
 */
export function BundleNode({
  clips,
  images,
  item,
  onConfigChange,
  readOnly,
  text,
}: {
  clips: readonly string[];
  images: string[];
  item: BoardItem;
  onConfigChange: (config: Record<string, unknown>) => void;
  readOnly: boolean;
  /** Every line on the Text port — wired first, typed after — joined. */
  text?: string | null;
}) {
  const config = item.config ?? {};
  const lines = text ? text.split("\n").filter((line) => line.trim()) : [];
  const [typed] = BUNDLE.settings;
  const empty = images.length + lines.length + clips.length === 0;

  return (
    <div className="op-node-view">
      <NodeHeader
        config={config}
        isSource
        state="idle"
        typeLabel={BUNDLE.label}
      />
      <div className="op-node-view__body">
        {typed ? (
          <SettingField
            onChange={(value) => onConfigChange({ ...config, text: value })}
            readOnly={readOnly}
            setting={typed}
            value={typeof config.text === "string" ? config.text : undefined}
          />
        ) : null}

        {empty ? (
          <p className="bundle-node__empty">
            Wire in pictures, text and clips. Each kind goes out of its own port
            on the right.
          </p>
        ) : null}

        {images.length > 0 ? (
          <section className="bundle-node__group">
            <h3 className="bundle-node__label">
              Images <span className="bundle-node__count">{images.length}</span>
            </h3>
            <div className="bundle-node__sheet">
              {images.map((url, index) => (
                <img
                  alt=""
                  className="bundle-node__thumb"
                  decoding="async"
                  height={56}
                  // biome-ignore lint/suspicious/noArrayIndexKey: the same picture may arrive twice; its place is its identity
                  key={`${url}-${index}`}
                  loading="lazy"
                  src={url}
                  width={56}
                />
              ))}
            </div>
          </section>
        ) : null}

        {lines.length > 0 ? (
          <section className="bundle-node__group">
            <h3 className="bundle-node__label">
              Text <span className="bundle-node__count">{lines.length}</span>
            </h3>
            <ol className="bundle-node__lines">
              {lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines repeat; their order is the identity
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {clips.length > 0 ? (
          <section className="bundle-node__group">
            <h3 className="bundle-node__label">
              Clips <span className="bundle-node__count">{clips.length}</span>
            </h3>
            <div className="bundle-node__sheet">
              {clips.map((url, index) => (
                <video
                  className="bundle-node__thumb"
                  // biome-ignore lint/suspicious/noArrayIndexKey: the same clip may arrive twice; its place is its identity
                  key={`${url}-${index}`}
                  muted
                  playsInline
                  preload="metadata"
                  src={url}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
