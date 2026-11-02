import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaleBoardError } from "../../../services/boardSave";

/**
 * A copy of the board that is behind (another tab saved since it loaded) must
 * stop saving; this window's own overlapping requests must not count as that.
 */

const api = {
  flush: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
};
const toastError = vi.fn();

vi.mock("../../../services/portfolioService", () => ({
  boardsApi: api,
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const { useBoardVersion } = await import("./useBoardVersion");

type Hook = ReturnType<typeof useBoardVersion>;
let hook: Hook;
let host: HTMLDivElement;
let root: Root;

function Probe() {
  hook = useBoardVersion("b1");
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Probe />));
  hook.version.current = "2026-11-01T10:00:00.000Z";
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useBoardVersion", () => {
  it("sends the version it has and takes the new one", async () => {
    api.update.mockResolvedValue({ updatedAt: "2026-11-01T10:05:00.000Z" });
    await expect(hook.saveArrangement({ items: [] })).resolves.toBe(true);
    expect(api.update).toHaveBeenCalledWith("b1", {
      baseUpdatedAt: "2026-11-01T10:00:00.000Z",
      items: [],
    });
    expect(hook.version.current).toBe("2026-11-01T10:05:00.000Z");
  });

  it("stops saving when another window saved since", async () => {
    api.update.mockRejectedValue(new StaleBoardError("stale"));
    await act(async () => {
      await expect(hook.saveArrangement({ items: [] })).resolves.toBe(false);
    });
    expect(hook.isStale).toBe(true);
    expect(toastError).toHaveBeenCalledOnce();
    api.update.mockClear();
    await expect(hook.saveArrangement({ items: [] })).resolves.toBe(false);
    expect(api.update).not.toHaveBeenCalled();
    await hook.flushArrangement([], []);
    expect(api.flush).not.toHaveBeenCalled();
  });

  it("retries once when only its own requests crossed", async () => {
    let releaseFlush: (v: unknown) => void = () => undefined;
    api.flush.mockReturnValue(
      new Promise((resolve) => {
        releaseFlush = resolve;
      })
    );
    const flushing = hook.flushArrangement([], []);
    api.update
      .mockRejectedValueOnce(new StaleBoardError("stale"))
      .mockResolvedValueOnce({ updatedAt: "2026-11-01T10:09:00.000Z" });
    api.get.mockResolvedValue({ updatedAt: "2026-11-01T10:08:00.000Z" });
    await expect(hook.saveArrangement({ items: [] })).resolves.toBe(true);
    expect(api.update).toHaveBeenLastCalledWith("b1", {
      baseUpdatedAt: "2026-11-01T10:08:00.000Z",
      items: [],
    });
    expect(toastError).not.toHaveBeenCalled();
    releaseFlush({ updatedAt: "2026-11-01T10:08:00.000Z" });
    await flushing;
    // An older answer arriving late doesn't step the version backwards.
    expect(hook.version.current).toBe("2026-11-01T10:09:00.000Z");
  });
});
