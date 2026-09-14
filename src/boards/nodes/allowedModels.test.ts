import { describe, expect, it } from "vitest";
import { allowedModels } from "./SettingField";

/**
 * Which rows a model picker may offer.
 *
 * Worth a test of its own because the cost of getting it wrong is money rather
 * than a wrong pixel: a Video node set to an image endpoint, or an Edit tool set
 * to a video one, is refused by fal *after* the request has been billed. The
 * flag that prevents it sat in the registry unread for the life of the feature,
 * which is exactly the kind of thing that comes back.
 */

const MODELS = [
  { id: "fal-ai/nano-banana/edit", output: "image" },
  { id: "fal-ai/recraft/vectorize", output: "image" },
  { id: "fal-ai/veo3.1/image-to-video", output: "video" },
  { id: "bytedance/seedance-2.5/image-to-video", output: "video" },
];

const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

describe("allowedModels", () => {
  it("offers only video endpoints when the setting asks for video", () => {
    expect(idsOf(allowedModels(MODELS, true))).toEqual([
      "fal-ai/veo3.1/image-to-video",
      "bytedance/seedance-2.5/image-to-video",
    ]);
  });

  it("keeps video endpoints out of an image setting", () => {
    expect(idsOf(allowedModels(MODELS, false))).toEqual([
      "fal-ai/nano-banana/edit",
      "fal-ai/recraft/vectorize",
    ]);
  });

  it("treats a setting that says nothing as an image setting", () => {
    // Absent is not "everything": a setting that has never thought about video
    // is an image setting, and the video rows have to be asked for.
    expect(idsOf(allowedModels(MODELS, undefined))).toEqual([
      "fal-ai/nano-banana/edit",
      "fal-ai/recraft/vectorize",
    ]);
  });

  it("returns nothing rather than everything when no row fits", () => {
    // The picker's own fallback then shows the node's stored choice. Falling
    // back to the whole table here would put image endpoints back on a Video
    // node by another door.
    const imagesOnly = MODELS.filter((row) => row.output === "image");
    expect(allowedModels(imagesOnly, true)).toEqual([]);
  });
});
