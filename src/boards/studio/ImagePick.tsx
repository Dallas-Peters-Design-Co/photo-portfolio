import { Crosshair, Frame, ImageUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useImageShelf } from "./imageShelf";

/**
 * Choosing a picture for a Studio tool: one just generated, one on the board,
 * or an upload. Whatever is chosen arrives as a local object URL, so a tool
 * can read its pixels without the canvas refusing a picture from another site.
 */

const SHOWN = 12;

/** The frame editor's layers, drawn as a picture on demand. */
export interface FromFrame {
  /** "Selection (3)" or "Whole frame". */
  label: string;
  take: () => Promise<Blob>;
  /** The selection where it sits in the frame (the picture is the frame's size). */
  takeInPlace?: () => Promise<Blob>;
}

const toLocal = async (url: string): Promise<string> => {
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) {
    throw new Error("That picture couldn't be loaded");
  }
  return URL.createObjectURL(await res.blob());
};

export function ImagePick({
  current,
  fromFrame,
  label,
  onPick,
}: {
  fromFrame?: FromFrame;
  /** The picture in use, shown first and marked. */
  current?: string | null;
  label: string;
  /**
   * A local URL for the chosen picture, and the address it came from when it
   * has one that lasts (a board picture; not an upload from this computer).
   */
  onPick: (url: string, source?: string, inPlace?: boolean) => void;
}) {
  const shelf = useImageShelf();
  const [more, setMore] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = more ? shelf : shelf.slice(0, SHOWN);

  /**
   * The selection in the frame, as it is right now: draw it, pick it. Taken
   * again each time it's pressed, so it follows whatever is selected.
   */
  const takeFrame = async (inPlace = false) => {
    const take = inPlace ? fromFrame?.takeInPlace : fromFrame?.take;
    if (!take) {
      return;
    }
    try {
      const blob = await take();
      setChosen(inPlace ? "in-place" : "frame");
      onPick(URL.createObjectURL(blob), undefined, inPlace);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't draw the frame");
    }
  };

  const pick = async (url: string) => {
    try {
      setChosen(url);
      onPick(await toLocal(url), url.startsWith("http") ? url : undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load it");
    }
  };

  return (
    <div className="studio__field studio-pick">
      <span>{label}</span>
      <div className="studio-pick__grid">
        <label className="studio-pick__upload" title="Upload a picture">
          {current && !chosen ? (
            <img alt="" height={48} src={current} width={48} />
          ) : (
            <ImageUp aria-hidden size={16} />
          )}
          <input
            accept="image/*"
            aria-label="Upload a picture"
            className="studio__file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setChosen(null);
                onPick(URL.createObjectURL(file));
              }
            }}
            type="file"
          />
        </label>
        {fromFrame ? (
          <button
            aria-label={`Use the frame: ${fromFrame.label}`}
            aria-pressed={chosen === "frame"}
            className="studio-pick__item studio-pick__frame"
            onClick={() => void takeFrame()}
            title={`${fromFrame.label}: draws it now and uses it. Press again after changing the selection.`}
            type="button"
          >
            <Frame aria-hidden size={16} />
            <small>{fromFrame.label}</small>
          </button>
        ) : null}
        {fromFrame?.takeInPlace ? (
          <button
            aria-label="Use the selection where it sits in the frame"
            aria-pressed={chosen === "in-place"}
            className="studio-pick__item studio-pick__frame"
            onClick={() => void takeFrame(true)}
            title="The selection where it sits in the frame: the picture is the frame's size, and it goes back over the frame in exactly that place."
            type="button"
          >
            <Crosshair aria-hidden size={16} />
            <small>In place</small>
          </button>
        ) : null}
        {shown.map((url) => (
          <button
            aria-label="Use this picture"
            aria-pressed={chosen === url}
            className="studio-pick__item"
            key={url}
            onClick={() => void pick(url)}
            type="button"
          >
            <img alt="" height={48} loading="lazy" src={url} width={48} />
          </button>
        ))}
      </div>
      {shelf.length > SHOWN ? (
        <button
          className="studio-pick__more"
          onClick={() => setMore((v) => !v)}
          type="button"
        >
          {more ? "Fewer" : `All ${shelf.length}`}
        </button>
      ) : null}
      {shelf.length === 0 ? (
        <small className="studio-pick__empty">
          Pictures you generate or place on the board show up here.
        </small>
      ) : null}
    </div>
  );
}
