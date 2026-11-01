import { beforeEach, describe, expect, it, vi } from "vitest";
import { type BrandKitDoc, EMPTY_KIT } from "../../config/brandKit.js";
import type { FalModelDef } from "../../config/falModels.js";

const describeWithClaude = vi.fn();
const generateImage = vi.fn();
vi.mock("./claudeVision.js", () => ({ describeWithClaude }));
vi.mock("./fal.js", () => ({ generateImage }));

const { brandImage, imagePlan, imageSizeFor, promptBrief, readImageRequest } =
  await import("./creativeImage.js");

const def = (
  id: string,
  input: FalModelDef["input"],
  imageParam: FalModelDef["imageParam"] = "image_url"
): FalModelDef => ({
  id,
  imageParam,
  input,
  label: id,
  output: "image",
  vector: false,
});
const MODELS: FalModelDef[] = [
  def("auto", "prompt-or-image"),
  def("fal-ai/nano-banana-pro", "prompt"),
  def("fal-ai/nano-banana/edit", "prompt-and-image", "image_urls"),
  def("fal-ai/flux-2-pro", "prompt-and-image"),
  def("fal-ai/birefnet/v2", "image"),
];

const kit: BrandKitDoc = {
  ...EMPTY_KIT,
  offBrand: ["https://blob/off.jpg"],
  onBrand: [
    "https://blob/a.jpg",
    "https://blob/b.jpg",
    "https://blob/c.jpg",
    "https://blob/d.jpg",
  ],
  palette: [{ name: "Ember", role: "primary", value: "#f25c3b" }],
  references: [
    {
      body: "Always daylight, never studio.",
      date: "2026-10-01",
      id: "r1",
      source: "",
      title: "Light",
    },
  ],
  voice: "warm, plain-spoken",
};

beforeEach(() => {
  describeWithClaude.mockReset();
  generateImage.mockReset();
  generateImage.mockResolvedValue({
    description: null,
    height: 1024,
    url: "https://blob/out.png",
    width: 1024,
  });
});

describe("creativeImage", () => {
  it("picks fal's nearest shape for the frame", () => {
    expect(imageSizeFor(1920, 1080)).toBe("landscape_16_9");
    expect(imageSizeFor(1080, 1080)).toBe("square_hd");
    expect(imageSizeFor(1080, 1350)).toBe("portrait_4_3");
    expect(imageSizeFor(1080, 1920)).toBe("portrait_16_9");
  });

  it("clamps the request", () => {
    const req = readImageRequest({
      ask: ` ${"x".repeat(900)} `,
      height: "1350",
      width: -4,
    });
    expect(req.ask).toHaveLength(600);
    expect(req).toMatchObject({ height: 1350, matchPhotos: true, width: 1 });
  });

  it("briefs Claude with the kit's notes, grade and which pictures are off-brand", () => {
    const brief = promptBrief(
      kit,
      {
        ask: "a kitchen",
        height: 1080,
        look: "Golden 2",
        matchPhotos: true,
        model: "",
        width: 1080,
      },
      { off: 1, on: 4 }
    );
    expect(brief).toContain("Request: a kitchen");
    expect(brief).toContain("Always daylight");
    expect(brief).toContain('"Golden 2" look');
    expect(brief).toContain("last 1 picture(s) are OFF-brand");
  });

  it("writes the prompt with Claude and sends the on-brand photos as references", async () => {
    describeWithClaude.mockResolvedValue("A sunlit kitchen, warm daylight.");
    const out = await brandImage(
      kit,
      readImageRequest({ ask: "a kitchen", height: 1080, width: 1920 }),
      MODELS
    );
    expect(describeWithClaude.mock.calls[0]?.[0]).toEqual([
      ...kit.onBrand,
      ...kit.offBrand,
    ]);
    const [prompt, source, , , params] = generateImage.mock.calls[0] ?? [];
    expect(prompt).toContain("A sunlit kitchen");
    expect(source).toBe("https://blob/a.jpg");
    expect(params).toMatchObject({
      blendWith: ["https://blob/b.jpg", "https://blob/c.jpg"],
      palette: ["#f25c3b"],
      size: "landscape_16_9",
    });
    expect(out.url).toBe("https://blob/out.png");
  });

  it("still makes a brand picture when Claude is unavailable, without references when asked", async () => {
    describeWithClaude.mockRejectedValue(new Error("not configured"));
    await brandImage(
      kit,
      readImageRequest({
        ask: "a kitchen",
        height: 1,
        matchPhotos: false,
        width: 1,
      })
    );
    const [prompt, source] = generateImage.mock.calls[0] ?? [];
    expect(prompt).toContain("a kitchen");
    expect(prompt).toContain("warm, plain-spoken");
    expect(source).toBeNull();
  });

  it("uses the chosen model, and only sends photos to one that takes them", () => {
    const req = (model: string, matchPhotos = true) =>
      readImageRequest({ ask: "x", height: 1, matchPhotos, model, width: 1 });
    expect(imagePlan(kit, req("fal-ai/nano-banana-pro"), MODELS)).toEqual({
      blend: [],
      model: "fal-ai/nano-banana-pro",
      source: null,
    });
    expect(imagePlan(kit, req("fal-ai/flux-2-pro"), MODELS)).toEqual({
      blend: [],
      model: "fal-ai/flux-2-pro",
      source: "https://blob/a.jpg",
    });
    expect(imagePlan(kit, req("not/on-the-list"), MODELS).model).toBeNull();
    expect(() => imagePlan(kit, req("fal-ai/birefnet/v2"), MODELS)).toThrow(
      "doesn't make pictures"
    );
    expect(() =>
      imagePlan(kit, req("fal-ai/flux-2-pro", false), MODELS)
    ).toThrow("reworks a photo");
  });
});
