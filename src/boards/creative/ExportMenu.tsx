import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BoardItem } from "../../types";
import { AD_WEIGHT_LIMIT, exportHtml5 } from "./exportHtml5";
import { downloadBlob, exportWidthFor, renderCreative } from "./exportPng";

/**
 * The editor's export: a PNG at the ad's real size, or an HTML5 display ad
 * zipped for an ad server, with the landing page its clickTag opens.
 */

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function ExportMenu({
  frame,
  layers,
  name,
  textElementFor,
}: {
  frame: BoardItem;
  layers: BoardItem[];
  name: string;
  textElementFor: (id: string) => HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"html" | "png" | null>(null);
  const [clickUrl, setClickUrl] = useState("https://");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  const run = async (kind: "html" | "png") => {
    setBusy(kind);
    try {
      if (kind === "png") {
        const blob = await renderCreative(
          frame,
          layers,
          exportWidthFor(frame),
          textElementFor
        );
        downloadBlob(blob, name);
        toast.success("PNG exported");
      } else {
        const { blob, linked } = await exportHtml5(
          frame,
          layers,
          exportWidthFor(frame),
          textElementFor,
          clickUrl.trim() === "https://" ? "" : clickUrl.trim()
        );
        downloadBlob(blob, name, "zip");
        const notes = [
          blob.size > AD_WEIGHT_LIMIT
            ? `${kb(blob.size)}, over the usual ${kb(AD_WEIGHT_LIMIT)} limit. Use smaller pictures.`
            : kb(blob.size),
          linked > 0
            ? `${linked} picture${linked === 1 ? "" : "s"} couldn't be copied in and stay linked.`
            : "",
        ].filter(Boolean);
        toast.success("HTML5 ad exported", { description: notes.join(" ") });
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="creative-export" ref={root}>
      <button
        aria-expanded={open}
        className="creative__button"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Download size={15} />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="creative-export__menu">
          <button
            className="creative-export__item"
            disabled={busy !== null}
            onClick={() => void run("png")}
            type="button"
          >
            <strong>PNG</strong>
            <span>The image at its real size</span>
          </button>
          <div className="creative-export__item creative-export__item--form">
            <strong>HTML5 display ad</strong>
            <span>A zip for Google Ads and other ad servers</span>
            <label className="creative-export__field">
              <span>Landing page</span>
              <input
                className="creative__input"
                onChange={(e) => setClickUrl(e.target.value)}
                type="url"
                value={clickUrl}
              />
            </label>
            <button
              className="creative__button creative__button--primary"
              disabled={busy !== null}
              onClick={() => void run("html")}
              type="button"
            >
              {busy === "html" ? "Building…" : "Export zip"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
