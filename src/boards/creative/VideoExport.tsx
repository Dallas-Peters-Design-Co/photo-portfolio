import { useEffect, useState } from "react";
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
 * The export menu's video: the frame as a HyperFrames project, written
 * straight into a folder on this computer (picked once, then updated in
 * place each time), where HyperFrames Studio or its preview picks it up to
 * retime and render to MP4. A zip where the browser can't write to a folder.
 * The exporter and the Studio runtime it copies in load on first use.
 */

const LENGTHS = [6, 8, 10, 15];
const SIZES = [
  { label: "HD · 1920", value: 1920 },
  { label: "4K · 3840", value: 3840 },
  { label: "Social · 1080", value: 1080 },
];

type Folder = FileSystemDirectoryHandle;

interface Build {
  frame: BoardItem;
  layers: BoardItem[];
  options: VideoOptions;
  palette: string[];
  textElementFor: (id: string) => HTMLElement | null;
}

const projectOf = async (b: Build) => {
  const [{ hyperframesProject }, { runtimeBytes }] = await Promise.all([
    import("../io/hyperframes/exportHyperframes"),
    import("../io/hyperframes/runtimeUrl"),
  ]);
  return hyperframesProject(
    b.frame,
    b.layers,
    b.textElementFor,
    b.palette,
    b.options,
    await runtimeBytes()
  );
};

const studioNote = (n: number) =>
  `${n} Studio layer${n === 1 ? "" : "s"} drawn live.`;

/** Into the folder: `<folder>/<project>/`, replacing what was there. */
const sendToFolder = async (folder: Folder, b: Build) => {
  const [{ writeProject }, project] = await Promise.all([
    import("../io/hyperframes/projectFolder"),
    projectOf(b),
  ]);
  await writeProject(folder, project.name, project.files);
  toast.success(`Updated ${folder.name}/${project.name}`, {
    description: `${studioNote(project.studioLayers)} HyperFrames Studio reloads it if it's open on that folder; otherwise open it there or run npm run dev in it.`,
  });
};

const downloadZip = async (b: Build) => {
  const { zip } = await import("../../lib/zip");
  const project = await projectOf(b);
  downloadBlob(
    zip(
      project.files.map((f) => ({ ...f, name: `${project.name}/${f.name}` }))
    ),
    project.name,
    "zip"
  );
  toast.success("HyperFrames project exported", {
    description: `${studioNote(project.studioLayers)} Unzip it and open the folder in HyperFrames, or run npm run dev.`,
  });
};

/**
 * The folder to write to: the one picked before, or a new pick. Permission
 * is asked straight from the click, before anything slow, since browsers
 * only ask while the click is fresh.
 */
const folderToUse = async (change: boolean): Promise<Folder | null> => {
  const { chooseFolder, mayWrite, savedFolder } = await import(
    "../io/hyperframes/projectFolder"
  );
  const folder =
    (change ? null : await savedFolder()) ?? (await chooseFolder());
  if (!folder) {
    return null;
  }
  if (!(await mayWrite(folder))) {
    throw new Error(`Can't write to ${folder.name}: allow it when asked`);
  }
  return folder;
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

  const [canFolder, setCanFolder] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("../io/hyperframes/projectFolder")
      .then(async ({ canUseFolder, savedFolder }) => {
        const can = canUseFolder();
        const folder = can ? await savedFolder() : null;
        if (live) {
          setCanFolder(can);
          setFolderName(folder?.name ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const run = async (how: "change" | "folder" | "zip") => {
    onBusy(true);
    try {
      const build = { frame, layers, options, palette, textElementFor };
      if (how === "zip") {
        await downloadZip(build);
        return;
      }
      const folder = await folderToUse(how === "change");
      if (folder) {
        setFolderName(folder.name);
        await sendToFolder(folder, build);
      }
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
        A project for HyperFrames Studio to retime and render to MP4. Studio
        layers move as themselves.
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
          Loop
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
      <span className="creative-export__pair">
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
        <label title="The video's longer side, in pixels">
          Size
          <select
            className="creative__input"
            onChange={(e) => set({ longEdge: Number(e.target.value) })}
            value={options.longEdge}
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </span>
      <ExportButtons
        busy={busy}
        canFolder={canFolder}
        folderName={folderName}
        onRun={(how) => void run(how)}
      />
    </div>
  );
}

function ExportButtons({
  busy,
  canFolder,
  folderName,
  onRun,
}: {
  busy: boolean;
  canFolder: boolean;
  folderName: string | null;
  onRun: (how: "change" | "folder" | "zip") => void;
}) {
  if (!canFolder) {
    return (
      <button
        className="creative__button creative__button--primary"
        disabled={busy}
        onClick={() => onRun("zip")}
        type="button"
      >
        {busy ? "Building…" : "Download project"}
      </button>
    );
  }
  return (
    <>
      <button
        className="creative__button creative__button--primary"
        disabled={busy}
        onClick={() => onRun("folder")}
        title="Writes the project into this folder on your computer, replacing the last export"
        type="button"
      >
        {busy ? "Building…" : `Send to ${folderName ?? "a folder…"}`}
      </button>
      <span className="creative-export__links">
        <button disabled={busy} onClick={() => onRun("change")} type="button">
          {folderName ? "Change folder" : "Choose folder"}
        </button>
        <button disabled={busy} onClick={() => onRun("zip")} type="button">
          Download zip
        </button>
      </span>
    </>
  );
}
