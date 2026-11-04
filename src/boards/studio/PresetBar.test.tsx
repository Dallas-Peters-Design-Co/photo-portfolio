import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
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
  const select = host.querySelector("select") as HTMLSelectElement;
  expect([...select.options].map((o) => o.textContent).join("|")).toBe(
    "Choose…|Yellow flow"
  );
  act(() => {
    select.value = state.stored[0]?.id ?? "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(latest).toEqual({ gap: 30, painted: "2.2#00ff00", text: "2" });
  // Loaded: it shows as the one picked.
  expect((host.querySelector("select") as HTMLSelectElement).value).toBe(
    state.stored[0]?.id
  );
  act(() => root2.unmount());
  host.remove();
});
