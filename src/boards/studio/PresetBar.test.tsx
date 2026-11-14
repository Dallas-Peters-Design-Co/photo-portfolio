import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { StudioPreset } from "./presets";
import type { StudioValues } from "./types";

/**
 * Saving a Studio tool's settings by name and loading them on another frame,
 * with the picture's own painted tiles left as they were.
 */
const state = { stored: [] as StudioPreset[] };
// The site's presets endpoint, as fetch sees it.
vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
  if (!init?.body) {
    return Promise.resolve(Response.json(state.stored));
  }
  const body = JSON.parse(String(init.body)) as Omit<StudioPreset, "id"> & {
    action: string;
    id?: string;
  };
  if (body.action === "deletePreset") {
    state.stored = state.stored.filter((p) => p.id !== body.id);
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  const out: StudioPreset = {
    id: body.id ?? `p${state.stored.length + 1}`,
    name: body.name,
    tool: body.tool,
    updatedAt: "now",
    values: body.values,
  };
  state.stored = [...state.stored.filter((x) => x.id !== out.id), out];
  return Promise.resolve(Response.json(out, { status: 201 }));
});
vi.mock("../../components/admin/ConfirmProvider", () => ({
  useConfirm: () => ({
    confirm: () => Promise.resolve(true),
    prompt: () => Promise.resolve("Yellow flow"),
  }),
}));

const { PresetBar } = await import("./PresetBar");

let latest: StudioValues = {};
function Harness({ start }: { start: StudioValues }) {
  const [values, setValues] = useState(start);
  latest = values;
  return <PresetBar onLoad={setValues} tool="flow" values={values} />;
}

const settle = () =>
  act(async () => await new Promise((r) => setTimeout(r, 20)));

const trigger = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>(
    "button[aria-label='Saved settings']"
  ) as HTMLButtonElement;

/** Opens the menu (Base UI opens on pointer events) and lists its options. */
const openMenu = async (host: HTMLElement) => {
  await userEvent.click(trigger(host));
  return await vi.waitFor(() => {
    const found = [
      ...document.querySelectorAll<HTMLElement>("[role='option']"),
    ];
    if (found.length === 0) {
      throw new Error("menu not open");
    }
    return found;
  });
};

it("saves settings by name and loads them back, keeping painted tiles", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <Harness start={{ gap: 30, painted: "1.1#ff0000", text: "2" }} />
    )
  );
  await settle();
  const save = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Save")
  ) as HTMLButtonElement;
  act(() => save.click());
  await settle();
  expect(state.stored).toHaveLength(1);
  expect(state.stored[0]?.values).toEqual({ gap: 30, text: "2" });
  // Another frame: different settings, its own painted tiles.
  act(() => root.unmount());
  const root2 = createRoot(host);
  act(() =>
    root2.render(
      <Harness start={{ gap: 5, painted: "2.2#00ff00", text: "7" }} />
    )
  );
  await settle();
  expect(trigger(host).textContent).toContain("Choose…");
  const options = await openMenu(host);
  expect(options.map((o) => o.textContent).join("|")).toBe("Yellow flow");
  await userEvent.click(options[0] as HTMLElement);
  await settle();
  expect(latest).toEqual({ gap: 30, painted: "2.2#00ff00", text: "2" });
  // Loaded: it shows as the one picked.
  expect(trigger(host).textContent).toContain("Yellow flow");
  act(() => root2.unmount());
  host.remove();
});

it("loads a ready-made look exactly: the defaults under it, painted tiles kept", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let got: StudioValues = {};
  act(() =>
    root.render(
      <PresetBar
        defaults={{ columns: 72, gap: 44, source: "clouds" }}
        looks={[{ name: "Fade", values: { gap: 0, source: "fade" } }]}
        onLoad={(v) => {
          got = v;
        }}
        tool="dither"
        values={{ columns: 120, gap: 10, painted: "1.1#ff0000" }}
      />
    )
  );
  await settle();
  const fade = (await openMenu(host)).find((o) =>
    o.textContent?.includes("Fade")
  ) as HTMLElement;
  await userEvent.click(fade);
  expect(got).toEqual({
    columns: 72,
    gap: 0,
    painted: "1.1#ff0000",
    source: "fade",
  });
  act(() => root.unmount());
  host.remove();
});
