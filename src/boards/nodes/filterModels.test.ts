import { describe, expect, it } from "vitest";
import { filterModels } from "./SettingField";

const KLING = "fal-ai/kling-video/v3/pro/image-to-video";
const MODELS = [
  { id: KLING, label: "Kling v3 Pro" },
  { id: "fal-ai/veo3.1/image-to-video", label: "Veo 3.1" },
  { id: "fal-ai/veo3.1/text-to-video", label: "Veo 3.1 Text" },
];

describe("filterModels", () => {
  it("keeps every row for an empty query", () => {
    expect(filterModels(MODELS, "  ", undefined)).toHaveLength(3);
  });

  it("matches every word against the label and the id", () => {
    expect(
      filterModels(MODELS, "veo text", undefined).map((m) => m.label)
    ).toEqual(["Veo 3.1 Text"]);
  });

  it("keeps the chosen model listed whatever is typed", () => {
    const kept = filterModels(MODELS, "veo", KLING);
    expect(kept.map((m) => m.label)).toContain("Kling v3 Pro");
  });
});
