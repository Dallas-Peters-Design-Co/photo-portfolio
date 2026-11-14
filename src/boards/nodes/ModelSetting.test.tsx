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

const trigger = (el: HTMLElement) =>
  // The chevron is a text glyph inside the trigger; only the label matters.
  (el.querySelector(".setting-field__trigger")?.textContent ?? "")
    .replace("▼", "")
    .trim();

const render = (video: boolean, value?: string) => {
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
  const el = host;
  return el;
};

afterEach(() => {
  root?.unmount();
  host?.remove();
});

/**
 * Waits for the trigger to settle on what the test expects. The models load
 * asynchronously; before they arrive the trigger shows the raw value ("auto"),
 * so a fixed pause, or waiting for any text, races a slow CI runner.
 */
const settlesOn = (el: HTMLElement, check: (label: string) => void) =>
  vi.waitFor(() => check(trigger(el)), { interval: 20, timeout: 5000 });

describe("ModelSetting", () => {
  it("shows the default for a node whose model was never set", async () => {
    const el = render(false);
    await settlesOn(el, (label) => expect(label).toBe("Auto"));
  });

  it("names Auto on a video node too, where no row is called auto", async () => {
    const el = render(true);
    await settlesOn(el, (label) => expect(label).toContain("Auto"));
  });

  it("shows the chosen model's label", async () => {
    const el = render(false, "img/3");
    await settlesOn(el, (label) => expect(label).toBe("Image 3"));
  });
});
