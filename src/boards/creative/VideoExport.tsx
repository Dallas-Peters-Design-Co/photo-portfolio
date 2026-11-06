import { useState } from "react";
import { toast } from "sonner";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import type {
  VideoOptions,
  VideoStyle,
} from "../io/hyperframes/exportHyperframes";
import { DEFAULT_PALETTE } from "../studio/tools";
import { downloadBlob } from "./exportPng";

/**
 * The export menu's video: the frame as a HyperFrames project, to open in
 * the HyperFrames app, retime there and render to MP4. The exporter and the
 * Studio runtime it copies in load on first use.
 */

const LENGTHS = [6, 8, 10, 15];
const SIZES = [
  { label: "HD", value: 1920 },
  { label: "4K", value: 3840 },
  { label: "Social", value: 1080 },
];

const saveVideo = async (
  frame: BoardItem,
  layers: BoardItem[],
  textElementFor: (id: string) => HTMLElement | null,
  palette: string[],
  options: VideoOptions
) => {
  const [{ exportHyperframes }, { runtimeBytes }] = await Promise.all([
    import("../io/hyperframes/exportHyperframes"),
    import("../io/hyperframes/runtimeUrl"),
  ]);
  const { blob, name, studioLayers } = await exportHyperframes(
    frame,
    layers,
    textElementFor,
    palette,
    options,
    await runtimeBytes()
  );
  downloadBlob(blob, name, "zip");
  toast.success("HyperFrames project exported", {
    description: `${studioLayers} Studio layer${studioLayers === 1 ? "" : "s"} drawn live. Unzip it and open the folder in HyperFrames, or run npm run dev.`,
  });
};

export function VideoExport({
  busy,
  frame,
  layers,
  onBusy,
  textElementFor,
}: {
  busy: boolean;
  frame: BoardItem;
  layers: BoardItem[];
  onBusy: (busy: boolean) => void;
  textElementFor: (id: string) => HTMLElement | null;
}) {
  const brand = useActiveBrand();
  const entries = brand?.kit?.resolvedDoc.palette ?? [];
  const palette =
    entries.length > 0 ? entries.map((p) => p.value) : DEFAULT_PALETTE;
  const [options, setOptions] = useState<VideoOptions>({
    duration: 8,
    longEdge: 1920,
    pushIn: true,
    style: "build",
  });
  const set = (patch: Partial<VideoOptions>) =>
    setOptions((o) => ({ ...o, ...patch }));

  const run = async () => {
    onBusy(true);
    try {
      await saveVideo(frame, layers, textElementFor, palette, options);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export the video");
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="creative-export__item creative-export__item--form">
      <strong>Video for HyperFrames</strong>
      <span>
        A project to retime and render to MP4. Studio layers move as themselves.
      </span>
      <span className="creative-export__checks">
        <label>
          <input
            checked={options.style === "build"}
            name="video-style"
            onChange={() => set({ style: "build" as VideoStyle })}
            type="radio"
          />
          Builds in
        </label>
        <label>
          <input
            checked={options.style === "loop"}
            name="video-style"
            onChange={() => set({ style: "loop" as VideoStyle })}
            type="radio"
          />
          Seamless loop
        </label>
        <label title="A slow push in over the whole video. Not on a loop, which has to end where it starts.">
          <input
            checked={options.pushIn && options.style === "build"}
            disabled={options.style === "loop"}
            onChange={(e) => set({ pushIn: e.target.checked })}
            type="checkbox"
          />
          Push in
        </label>
      </span>
      <span className="creative-export__checks">
        <label>
          Length
          <select
            className="creative__input"
            onChange={(e) => set({ duration: Number(e.target.value) })}
            value={options.duration}
          >
            {LENGTHS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
        <label>
          Size
          <select
            className="creative__input"
            onChange={(e) => set({ longEdge: Number(e.target.value) })}
            value={options.longEdge}
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.value} px long side)
              </option>
            ))}
          </select>
        </label>
      </span>
      <button
        className="creative__button creative__button--primary"
        disabled={busy}
        onClick={() => void run()}
        type="button"
      >
        {busy ? "Building…" : "Export project"}
      </button>
    </div>
  );
}
