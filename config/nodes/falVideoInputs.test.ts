import { describe, expect, it } from "vitest";
import { missingVideoInputs, videoInputsNote } from "./falVideoInputs.js";

const KLING_I2V = "fal-ai/kling-video/v3/pro/image-to-video";
const KLING_T2V = "fal-ai/kling-video/v3/pro/text-to-video";
const HAPPY_HORSE_REF = "alibaba/happy-horse/reference-to-video";

describe("missingVideoInputs", () => {
  it("asks an image-to-video model for its start frame", () => {
    expect(missingVideoInputs(KLING_I2V, {})).toEqual(["a start frame"]);
    expect(missingVideoInputs(KLING_I2V, { image: true })).toEqual([]);
  });

  it("asks a text-to-video model for nothing wired", () => {
    expect(missingVideoInputs(KLING_T2V, {})).toEqual([]);
  });

  it("counts references and a required prompt", () => {
    expect(missingVideoInputs(HAPPY_HORSE_REF, {})).toEqual([
      "reference images",
      "a prompt",
    ]);
    expect(
      missingVideoInputs(HAPPY_HORSE_REF, { prompt: true, references: 3 })
    ).toEqual([]);
  });

  it("leaves an endpoint the table does not list to the row", () => {
    expect(missingVideoInputs("someone/hand-added", {})).toEqual([]);
    expect(missingVideoInputs(undefined, {})).toEqual([]);
  });
});

describe("videoInputsNote", () => {
  it("names what the model takes and what it requires", () => {
    expect(videoInputsNote(KLING_I2V)).toBe(
      "Takes end frame, start frame (required), prompt."
    );
  });

  it("says nothing for a model it does not know", () => {
    expect(videoInputsNote("auto")).toBeNull();
  });
});
