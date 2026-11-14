import type { ZipFile } from "../../../lib/zip";

/**
 * A folder on this computer that video projects are written straight into,
 * instead of downloading a zip each time: picked once, remembered in this
 * browser, and each export updates its project folder there in place. With
 * HyperFrames Studio (or `npx hyperframes preview`) open on that folder, the
 * preview reloads as soon as the files change.
 *
 * Chrome, Edge, Arc and other Chromium browsers can write to a folder;
 * Safari and Firefox can't, so the export menu offers the zip there.
 */

/** The parts of the File System Access API this uses, not all in lib.dom yet. */
interface WritableFolder extends FileSystemDirectoryHandle {
  queryPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
}

type FolderPicker = (options: {
  id?: string;
  mode?: "readwrite";
}) => Promise<WritableFolder>;

const pickerOf = (): FolderPicker | null => {
  const picker = (window as unknown as { showDirectoryPicker?: FolderPicker })
    .showDirectoryPicker;
  return typeof picker === "function" ? picker.bind(window) : null;
};

/** Whether this browser can write into a folder at all. */
export const canUseFolder = (): boolean => pickerOf() !== null;

const DB = "hyperframes-folder";
const STORE = "handles";
const KEY = "projects";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Couldn't open storage"));
  });

const inStore = async <T>(
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = act(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Storage failed"));
    });
  } finally {
    db.close();
  }
};

/** The folder picked before, if this browser still has it. */
export const savedFolder = async (): Promise<WritableFolder | null> => {
  try {
    const handle = await inStore("readonly", (s) => s.get(KEY));
    return (handle as WritableFolder | undefined) ?? null;
  } catch {
    return null;
  }
};

/** Asks for a folder and remembers it. Null if the picker was cancelled. */
export const chooseFolder = async (): Promise<WritableFolder | null> => {
  const picker = pickerOf();
  if (!picker) {
    return null;
  }
  try {
    const folder = await picker({ id: "hyperframes", mode: "readwrite" });
    await inStore("readwrite", (s) => s.put(folder, KEY)).catch(() => null);
    return folder;
  } catch {
    return null;
  }
};

/**
 * Whether the site may write to the folder, asking if it has to. Browsers
 * forget the grant between visits, so the first export of a visit asks
 * once; it has to run straight from a click.
 */
export const mayWrite = async (folder: WritableFolder): Promise<boolean> => {
  const mode = { mode: "readwrite" as const };
  if ((await folder.queryPermission?.(mode)) === "granted") {
    return true;
  }
  return (await folder.requestPermission?.(mode)) === "granted";
};

/** A folder inside another, made if it isn't there; each level in turn. */
const subfolder = (
  root: FileSystemDirectoryHandle,
  parts: string[]
): Promise<FileSystemDirectoryHandle> =>
  parts.reduce<Promise<FileSystemDirectoryHandle>>(
    async (dir, part) => (await dir).getDirectoryHandle(part, { create: true }),
    Promise.resolve(root)
  );

const writeFile = async (project: FileSystemDirectoryHandle, file: ZipFile) => {
  const parts = file.name.split("/").filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) {
    return;
  }
  const dir = await subfolder(project, parts);
  const handle = await dir.getFileHandle(leaf, { create: true });
  const out = await handle.createWritable();
  await out.write(file.bytes);
  await out.close();
};

/**
 * Writes the project into `<folder>/<name>/`, replacing files of the same
 * name and leaving anything else there alone (renders, Studio's own files).
 * index.html goes last, so a preview watching the folder reloads once the
 * assets it points at are already there.
 */
export const writeProject = async (
  folder: FileSystemDirectoryHandle,
  name: string,
  files: ZipFile[]
): Promise<void> => {
  const project = await folder.getDirectoryHandle(name, { create: true });
  const page = files.filter((f) => f.name === "index.html");
  const rest = files.filter((f) => f.name !== "index.html");
  await Promise.all(rest.map((f) => writeFile(project, f)));
  await Promise.all(page.map((f) => writeFile(project, f)));
};
