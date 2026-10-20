import { describe, expect, it } from "vitest";
import { readVideoMedia, videoBodyFor, videoRefusal } from "./videoBody.js";

const FRAME = "https://example.com/a.jpg";
const LAST = "https://example.com/b.jpg";
const KLING_I2V = {
  id: "fal-ai/kling-video/v3/pro/image-to-video",
  imageParam: "image_url",
  label: "Kling v3 Pro",
};
const WAN_REF = {
  id: "alibaba/wan-3.0/reference-to-video",
  imageParam: "image_url",
  label: "Wan 3.0 Reference",
};

describe("readVideoMedia", () => {
  it("still accepts the old single imageUrl", () => {
    expect(readVideoMedia({ imageUrl: FRAME }).image).toBe(FRAME);
  });

  it("drops anything parsePublicHttpUrl refuses", () => {
    const media = readVideoMedia({
      inputs: {
        references: [FRAME, "javascript:alert(1)", 4],
        video: "https://user:secret@example.com/a.mp4",
      },
    });
    expect(media.references).toEqual([FRAME]);
    expect(media.video).toBeNull();
  });
});

describe("videoBodyFor", () => {
  it("puts each frame under the name the endpoint gives it", () => {
    const media = readVideoMedia({ inputs: { end: LAST, image: FRAME } });
    expect(videoBodyFor(KLING_I2V, media, "a slow push in", "")).toEqual({
      end_image_url: LAST,
      prompt: "a slow push in",
      start_image_url: FRAME,
    });
  });

  it("sends references as a list, capped at the schema's maximum", () => {
    const many = Array.from(
      { length: 14 },
      (_, i) => `https://example.com/${i}.jpg`
    );
    const media = readVideoMedia({ inputs: { references: many } });
    const body = videoBodyFor(WAN_REF, media, "", "");
    expect(body.reference_image_urls).toHaveLength(10);
    expect(body).not.toHaveProperty("prompt");
  });

  it("falls back to the row's image_param for an unlisted endpoint", () => {
    const media = readVideoMedia({ imageUrl: FRAME });
    expect(
      videoBodyFor({ id: "x/unlisted", imageParam: "image_url" }, media, "", "")
    ).toEqual({ image_url: FRAME });
  });
});

describe("videoRefusal", () => {
  it("refuses before billing when a required input is missing", () => {
    expect(videoRefusal(KLING_I2V, readVideoMedia({}), "")).toBe(
      "Kling v3 Pro needs a start frame."
    );
  });

  it("lets a text-to-video model run with nothing wired", () => {
    const t2v = { id: "fal-ai/kling-video/v3/pro/text-to-video", label: "T" };
    expect(videoRefusal(t2v, readVideoMedia({}), "a cat")).toBeNull();
  });
});
