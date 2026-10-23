import { clipUrlOf } from "../../../config/nodes/clip.js";
import type { BoardItem } from "../../types";
import { useAutoplay } from "../autoplayPref";
import { BundleDropZone } from "./BundleImages";
import "../itemBodies.css";
import "./BundleNode.css";

/**
 * A Clip node: the clip, and under it what it is called.
 *
 * The name sits below the picture rather than over it — a clip is judged by
 * looking at it, and a caption laid across the bottom of the frame is over
 * exactly the part that gets cut to.
 *
 * Played by the same rules as a clip pinned to the board (see ItemMedia):
 * muted, looping, no controls to swallow a drag, and moving only when the
 * viewer has autoplay on. Stopped, `#t=0.1` is what makes the first frame
 * appear at all.
 *
 * One placed from the tool rail arrives empty, and takes its file the way a
 * Bundle takes clips — the button, or a file dropped on it. Dropping another
 * onto a full one replaces it: a Clip holds one.
 */
export function ClipNode({
  item,
  onConfigChange,
  readOnly,
}: {
  item: BoardItem;
  onConfigChange: (config: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const playing = useAutoplay();
  const config = item.config ?? {};
  const url = clipUrlOf(config);
  const name = typeof config.name === "string" ? config.name : null;
  const held = url ? [url] : [];
  // The zone appends; a Clip keeps only the newest. The name belonged to the
  // file being replaced, so it goes with it.
  const keep = (urls: string[]) => {
    const { name: _name, ...rest } = config;
    onConfigChange({ ...rest, clipUrl: urls.at(-1) ?? null });
  };

  return (
    <BundleDropZone
      held={held}
      kind="clip"
      onHeldChange={keep}
      readOnly={readOnly}
    >
      {({ add, uploading }) => (
        <div className="media-body">
          {url ? (
            <video
              autoPlay={playing}
              className="media-body__image"
              loop
              muted
              playsInline
              preload="metadata"
              src={playing ? url : `${url}#t=0.1`}
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="media-body__missing">
              {readOnly ? (
                "No clip"
              ) : (
                <button
                  className="bundle-node__add"
                  onClick={add}
                  onPointerDown={(e) => e.stopPropagation()}
                  type="button"
                >
                  {uploading > 0
                    ? "Uploading clip…"
                    : "Choose a clip — or drop one here"}
                </button>
              )}
            </div>
          )}
          <div className="media-body__caption">
            <p className="media-body__title">Clip</p>
            {name ? <p className="media-body__credit">{name}</p> : null}
          </div>
        </div>
      )}
    </BundleDropZone>
  );
}
