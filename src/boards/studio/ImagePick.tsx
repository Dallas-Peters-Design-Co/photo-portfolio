import { ImageUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useImageShelf } from "./imageShelf";

/**
 * Choosing a picture for a Studio tool: one just generated, one on the board,
 * or an upload. Whatever is chosen arrives as a local object URL, so a tool
 * can read its pixels without the canvas refusing a picture from another site.
 */

const SHOWN = 12;

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
  label,
  onPick,
}: {
  /** The picture in use, shown first and marked. */
  current?: string | null;
  label: string;
  /**
   * A local URL for the chosen picture, and the address it came from when it
   * has one that lasts (a board picture; not an upload from this computer).
   */
  onPick: (url: string, source?: string) => void;
}) {
  const shelf = useImageShelf();
  const [more, setMore] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = more ? shelf : shelf.slice(0, SHOWN);

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
