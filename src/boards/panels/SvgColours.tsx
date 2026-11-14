import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColorWell } from "../ColorWell";
import { recolourSvg, type SvgColour, svgColoursOf } from "../io/svgColors";
import { saveSvgEdit } from "../io/svgEditEvents";
import "./SvgColours.css";

/**
 * The colours of an SVG on the board, each one changeable: every place a
 * colour is used changes together, and Apply saves the recoloured file back
 * onto the item (as a new version, on a node that keeps versions).
 */
export function SvgColours({
  itemId,
  onClose,
  onTint,
  tint,
  url,
}: {
  itemId: string;
  onClose: () => void;
  /** Sets the picture's tint, or takes it off (null). */
  onTint?: (tint: string | null) => void;
  /**
   * The one colour the picture is drawn in instead of its own (set in the
   * frame editor). While it's on, the SVG's own colours don't show.
   */
  tint?: string | null;
  url: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [colours, setColours] = useState<SvgColour[]>([]);
  // Old colour → new, for the ones changed so far.
  const [changes, setChanges] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(url, { mode: "cors" })
      .then((res) =>
        res.ok
          ? res.text()
          : Promise.reject(new Error("The SVG couldn't be read"))
      )
      .then((text) => {
        if (alive) {
          setSvg(text);
          setColours(svgColoursOf(text));
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);

  const apply = async () => {
    if (!svg || changes.size === 0) {
      return;
    }
    setBusy(true);
    try {
      await saveSvgEdit(itemId, recolourSvg(svg, changes));
      toast.success("Colours changed");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save it");
    } finally {
      setBusy(false);
    }
  };

  // Tinted: the picture is one colour over its shape, so that colour is the
  // one to change, and its own colours wait underneath.
  if (tint && onTint) {
    return (
      <div className="svg-colours">
        <div className="svg-colours__row">
          <ColorWell label="Tint" noVars onChange={onTint} value={tint} />
          <span className="svg-colours__hex">{tint.toUpperCase()}</span>
          <span className="svg-colours__count">whole picture</span>
        </div>
        <p className="svg-colours__hint">
          This picture is drawn in one colour (a tint). Take the tint off to see
          and change the SVG's own colours.
        </p>
        <div className="svg-colours__actions">
          <Button onClick={onClose} size="xs" variant="ghost">
            Done
          </Button>
          <Button onClick={() => onTint(null)} size="xs">
            Use its own colours
          </Button>
        </div>
      </div>
    );
  }
  if (failed) {
    return <p className="svg-colours__note">The SVG couldn't be read.</p>;
  }
  if (svg === null) {
    return <p className="svg-colours__note">Reading the colours…</p>;
  }
  if (colours.length === 0) {
    return (
      <p className="svg-colours__note">
        No colours set in this SVG: it's drawn in the default black.
      </p>
    );
  }
  return (
    <div className="svg-colours">
      <ul className="svg-colours__list">
        {colours.map((c, i) => (
          <li className="svg-colours__row" key={c.hex}>
            <ColorWell
              label={`Colour ${i + 1}`}
              noVars
              onChange={(next) =>
                setChanges((was) => {
                  const out = new Map(was);
                  if (next.toLowerCase() === c.hex) {
                    out.delete(c.hex);
                  } else {
                    out.set(c.hex, next.toLowerCase());
                  }
                  return out;
                })
              }
              value={changes.get(c.hex) ?? c.hex}
            />
            <span className="svg-colours__hex">
              {(changes.get(c.hex) ?? c.hex).toUpperCase()}
            </span>
            <span className="svg-colours__count">
              {c.count === 1 ? "1 place" : `${c.count} places`}
            </span>
          </li>
        ))}
      </ul>
      <div className="svg-colours__actions">
        <Button onClick={onClose} size="xs" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={busy || changes.size === 0}
          onClick={() => void apply()}
          size="xs"
        >
          {busy ? "Saving…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
