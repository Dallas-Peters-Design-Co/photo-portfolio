import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sizeFromTitle } from "../../../config/adLayout";
import { LOOKS } from "../../editor/presets";
import { brandKitsApi } from "../../services/brandKitService";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { newItemId } from "../io/newItemId";
import { newImage } from "./creativeModel";

/**
 * Makes a picture for the frame from the brand: the request in your words,
 * everything the kit knows (voice, palette, grade, notes, on- and off-brand
 * pictures) folded in by the server, at the frame's shape. Each result can
 * go in as the background or as a picture on top, and stays listed so it can
 * be placed again.
 */

type Place = "background" | "picture";

const aspectOf = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => resolve(1);
    img.src = url;
  });

/** A picture covering the frame, slotted just above a background shape. */
export const asBackground = (
  frame: BoardItem,
  layers: BoardItem[],
  background: BoardItem | null,
  url: string
): { item: BoardItem; lift: Map<string, number> } => {
  const lowest = Math.min(frame.z, ...layers.map((l) => l.z));
  const z = background ? background.z + 1 : lowest - 1;
  // Everything at or above that z steps up one, so the picture sits under
  // the type and shapes but over the background colour.
  const lift = new Map(
    background
      ? layers
          .filter((l) => l.id !== background.id && l.z >= z)
          .map((l) => [l.id, l.z + 1])
      : []
  );
  return {
    item: {
      ...newImage(frame, layers, url),
      height: frame.height,
      id: newItemId(),
      width: frame.width,
      x: frame.x,
      y: frame.y,
      z,
    },
    lift,
  };
};

export function GenerateImage({
  background,
  frame,
  items,
  layers,
  onChange,
}: {
  background: BoardItem | null;
  frame: BoardItem;
  items: BoardItem[];
  layers: BoardItem[];
  onChange: (next: BoardItem[], selectId: string) => void;
}) {
  const kit = useActiveBrand()?.kit ?? null;
  const doc = kit?.resolvedDoc ?? null;
  const [ask, setAsk] = useState("");
  const [place, setPlace] = useState<Place>(
    background ? "background" : "picture"
  );
  const [matchPhotos, setMatchPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string[]>([]);
  const onBrand = doc?.onBrand.length ?? 0;

  const put = async (url: string) => {
    if (place === "background") {
      const { item, lift } = asBackground(frame, layers, background, url);
      onChange(
        [
          ...items.map((i) =>
            lift.has(i.id) ? { ...i, z: lift.get(i.id) ?? i.z } : i
          ),
          item,
        ],
        item.id
      );
      return;
    }
    const item = newImage(frame, items, url, await aspectOf(url));
    onChange([...items, item], item.id);
  };

  const generate = async () => {
    if (!kit) {
      return;
    }
    setBusy(true);
    try {
      const size = sizeFromTitle(frame.body) ?? {
        h: frame.height,
        w: frame.width,
      };
      const look = doc?.look ? LOOKS.find((l) => l.id === doc.look?.id) : null;
      const { url } = await brandKitsApi.generateImage(kit.id, {
        ask: ask.trim(),
        height: size.h,
        look: look?.name ?? "",
        matchPhotos: matchPhotos && onBrand > 0,
        width: size.w,
      });
      setMade((was) => [url, ...was].slice(0, 8));
      await put(url);
      toast.success("Picture added. ⌘Z to undo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't make the picture");
    } finally {
      setBusy(false);
    }
  };

  if (!kit) {
    return (
      <p className="creative__hint">
        Choose a brand in the panel on the right, and pictures are made from
        everything it knows.
      </p>
    );
  }

  return (
    <div className="creative-generate">
      <textarea
        aria-label="What the picture shows"
        className="creative__input creative-generate__ask"
        onChange={(e) => setAsk(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            void generate();
          }
        }}
        placeholder="What should it show? e.g. a roofer on a ridge at golden hour"
        value={ask}
      />
      <div className="creative-generate__segments">
        {(["background", "picture"] as const).map((p) => (
          <button
            aria-pressed={place === p}
            key={p}
            onClick={() => setPlace(p)}
            type="button"
          >
            {p === "background" ? "Background" : "Picture"}
          </button>
        ))}
      </div>
      {onBrand > 0 ? (
        <label className="creative-generate__check">
          <input
            checked={matchPhotos}
            onChange={(e) => setMatchPhotos(e.target.checked)}
            type="checkbox"
          />
          Match the brand's {onBrand} photo{onBrand === 1 ? "" : "s"}
        </label>
      ) : null}
      <button
        className="creative__button creative__button--primary"
        disabled={busy}
        onClick={() => void generate()}
        type="button"
      >
        <Sparkles size={14} />
        {busy ? "Making it…" : "Generate"}
      </button>
      <p className="creative__hint">
        {busy
          ? "Up to a minute."
          : `Made from ${kit.name}'s palette, voice, notes and photos.`}
      </p>
      {made.length > 0 ? (
        <div className="creative-generate__made">
          {made.map((url) => (
            <button
              aria-label="Place this picture again"
              key={url}
              onClick={() => void put(url)}
              type="button"
            >
              <img alt="" height={64} loading="lazy" src={url} width={64} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
