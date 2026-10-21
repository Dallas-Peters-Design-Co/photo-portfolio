import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelsProvider } from "../ModelsContext";
import { SettingField } from "./SettingField";

/**
 * The model picker, rendered for real.
 *
 * It showed an empty box for a node whose model was never set: the stored
 * value is absent, the Select was handed `undefined`, and Base UI draws
 * nothing for that — while the node's header said "Auto" one inch above.
 */
const row = (id: string, label: string, output: "image" | "video") => ({
  createdAt: "",
  enabled: true,
  id,
  imageParam: "image_url",
  input: "prompt",
  label,
  lora: null,
  output,
  sortOrder: 0,
  training: null,
  updatedAt: "",
  vector: false,
});

vi.mock("../../services/portfolioService", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  modelsApi: {
    listEnabled: () =>
      Promise.resolve([
        row("auto", "Auto", "image"),
        ...Array.from({ length: 30 }, (_, i) =>
          row(`img/${i}`, `Image ${i}`, "image")
        ),
        row("fal-ai/veo3.1/text-to-video", "Veo 3.1 Text", "video"),
      ]),
  },
}));

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

const render = async (video: boolean, value?: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <ModelsProvider>
      <SettingField
        onChange={() => undefined}
        readOnly={false}
        setting={{
          default: "auto",
          key: "model",
          kind: "model",
          label: "Model",
          video,
        }}
        value={value}
      />
    </ModelsProvider>
  );
  await settle();
  return host;
};

afterEach(() => {
  root?.unmount();
  host?.remove();
});

const trigger = (el: HTMLElement) =>
  // The chevron is a text glyph inside the trigger; only the label matters.
  (el.querySelector(".setting-field__trigger")?.textContent ?? "")
    .replace("▼", "")
    .trim();

describe("ModelSetting", () => {
  it("shows the default for a node whose model was never set", async () => {
    expect(trigger(await render(false))).toBe("Auto");
  });

  it("names Auto on a video node too, where no row is called auto", async () => {
    expect(trigger(await render(true))).toContain("Auto");
  });

  it("shows the chosen model's label", async () => {
    expect(trigger(await render(false, "img/3"))).toBe("Image 3");
  });
});
