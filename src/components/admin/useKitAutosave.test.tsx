import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { saveBeforeSiteReload } from "../../hooks/beforeSiteReload";
import type { BrandKit } from "../../services/brandKitService";

const save = vi.fn(async () => ({}) as BrandKit);
const rename = vi.fn(async () => ({}) as BrandKit);
vi.mock("../../services/brandKitService", () => ({
  brandKitsApi: { rename, save },
}));

const { useKitAutosave } = await import("./useKitAutosave");

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const kit = {
  doc: EMPTY_KIT,
  id: "kit-1",
  name: "Pretext",
} as unknown as BrandKit;

let host: HTMLDivElement;
let root: Root;
let edit: (voice: string) => void = () => undefined;
let state = "";
const saved = vi.fn();

function Harness() {
  const [doc, setDoc] = useState(EMPTY_KIT);
  edit = (voice) => setDoc((d) => ({ ...d, voice }));
  ({ state } = useKitAutosave({ doc, kit, name: kit.name, onSaved: saved }));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockClear();
  rename.mockClear();
  saved.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  host.remove();
});

it("saves a moment after a pause in editing, once for a run of changes", async () => {
  act(() => edit("Plain"));
  act(() => edit("Plain and"));
  act(() => edit("Plain and warm"));
  expect(state).toBe("unsaved");
  expect(save).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1300);
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    "kit-1",
    expect.objectContaining({ voice: "Plain and warm" }),
    { autosave: true }
  );
  expect(rename).not.toHaveBeenCalled();
  expect(state).toBe("saved");
  expect(saved).toHaveBeenCalledTimes(1);
});

it("does not save when nothing changed", async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(save).not.toHaveBeenCalled();
  expect(state).toBe("saved");
});

it("saves the last change on the way out, before the pause ends", async () => {
  act(() => edit("Left mid-pause"));
  await act(async () => {
    root.unmount();
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(save).toHaveBeenCalledWith(
    "kit-1",
    expect.objectContaining({ voice: "Left mid-pause" }),
    { autosave: true }
  );
});

it("says when a save failed, and saves again later", async () => {
  save.mockRejectedValueOnce(new Error("offline"));
  act(() => edit("Try one"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1300);
  });
  expect(state).toBe("failed");
  act(() => edit("Try two"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1300);
  });
  expect(state).toBe("saved");
});

it("waits for pending kit edits before updating the site, including after a failed save", async () => {
  act(() => edit("Fresh palette edits"));
  save.mockRejectedValueOnce(new Error("offline"));
  let ready = true;
  await act(async () => {
    ready = await saveBeforeSiteReload();
  });
  expect(ready).toBe(false);
  await act(async () => {
    ready = await saveBeforeSiteReload();
  });
  expect(ready).toBe(true);
  expect(save).toHaveBeenLastCalledWith(
    "kit-1",
    expect.objectContaining({ voice: "Fresh palette edits" }),
    { autosave: true }
  );
});
