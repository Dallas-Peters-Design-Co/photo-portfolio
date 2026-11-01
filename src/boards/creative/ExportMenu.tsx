import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { groupFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { AD_WEIGHT_LIMIT, exportHtml5 } from "./exportHtml5";
import { deckSlides, exportDeckPdf, exportEmail } from "./exportOutputs";
import { downloadBlob, exportWidthFor, renderCreative } from "./exportPng";

/**
 * The editor's export: always a PNG at the frame's real size, plus the file
 * the frame is for, read from its size group. An email frame gives an email
 * zip, a landing hero a web page, a slide the whole deck as a PDF, and
 * anything else an HTML5 display ad.
 */

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

type Output = "ad" | "deck" | "email" | "page";

interface OutputCopy {
  action: string;
  hint: string;
  /** What the link field is called, when the output has one. */
  link: string | null;
  title: string;
}

const OUTPUTS: Record<Output, OutputCopy> = {
  ad: {
    action: "Export zip",
    hint: "A zip for Google Ads and other ad servers",
    link: "Landing page",
    title: "HTML5 display ad",
  },
  deck: {
    action: "Export PDF",
    hint: "",
    link: null,
    title: "Deck PDF",
  },
  email: {
    action: "Export zip",
    hint: "HTML that mail apps render, with the design as a linked image",
    link: "Link to",
    title: "Email",
  },
  page: {
    action: "Export zip",
    hint: "One HTML page that scales to the window",
    link: "Link (optional)",
    title: "Web page",
  },
};

const OUTPUT_FOR: Record<string, Output> = {
  Deck: "deck",
  Email: "email",
  Landing: "page",
};

export function ExportMenu({
  frame,
  items,
  layers,
  name,
  textElementFor,
}: {
  frame: BoardItem;
  items: BoardItem[];
  layers: BoardItem[];
  name: string;
  textElementFor: (id: string) => HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"file" | "png" | null>(null);
  const [link, setLink] = useState("https://");
  const root = useRef<HTMLDivElement>(null);
  const output = OUTPUT_FOR[groupFromTitle(frame.body)] ?? "ad";
  const copy = OUTPUTS[output];
  const slideCount = output === "deck" ? deckSlides(items).length : 0;

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

  const url = link.trim() === "https://" ? "" : link.trim();

  const exportFile = async () => {
    if (output === "deck") {
      downloadBlob(await exportDeckPdf(items), name, "pdf");
      toast.success(`Deck exported · ${slideCount} slides`);
      return;
    }
    if (output === "email") {
      downloadBlob(
        await exportEmail(frame, layers, textElementFor, url),
        name,
        "zip"
      );
      toast.success("Email exported", {
        description: "Open index.html, or paste it into your mail tool.",
      });
      return;
    }
    const { blob, linked } = await exportHtml5(
      frame,
      layers,
      exportWidthFor(frame),
      textElementFor,
      url,
      output === "page" ? "page" : "ad"
    );
    downloadBlob(blob, name, "zip");
    const notes = [
      output === "ad" && blob.size > AD_WEIGHT_LIMIT
        ? `${kb(blob.size)}, over the usual ${kb(AD_WEIGHT_LIMIT)} limit. Use smaller pictures.`
        : kb(blob.size),
      linked > 0
        ? `${linked} picture${linked === 1 ? "" : "s"} couldn't be copied in and stay linked.`
        : "",
    ].filter(Boolean);
    toast.success(`${copy.title} exported`, { description: notes.join(" ") });
  };

  const run = async (kind: "file" | "png") => {
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
        await exportFile();
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
            <strong>{copy.title}</strong>
            <span>
              {output === "deck"
                ? `Every slide on this board, in reading order: ${slideCount} ${slideCount === 1 ? "page" : "pages"}`
                : copy.hint}
            </span>
            {copy.link ? (
              <label className="creative-export__field">
                <span>{copy.link}</span>
                <input
                  className="creative__input"
                  onChange={(e) => setLink(e.target.value)}
                  type="url"
                  value={link}
                />
              </label>
            ) : null}
            <button
              className="creative__button creative__button--primary"
              disabled={busy !== null}
              onClick={() => void run("file")}
              type="button"
            >
              {busy === "file" ? "Building…" : copy.action}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
