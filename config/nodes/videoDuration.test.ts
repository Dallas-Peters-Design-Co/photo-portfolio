import { describe, expect, it } from "vitest";
import {
  durationLabelFor,
  durationOptionsFor,
  durationValueFor,
} from "./videoDuration";

/**
 * The lengths each video endpoint will accept, and the type it wants them in.
 *
 * Asserted against the real generated table rather than a fixture, because the
 * failure this prevents is a disagreement between our vocabulary and fal's, and
 * a fixture would only ever agree with itself.
 *
 * Both halves cost a generation. The one that was reported is the value —
 * "Could not collect the video (Input should be '4s', '6s' or '8s')" after the
 * node sent "5". The one found while fixing it is the type: Wan, MiniMax,
 * PixVerse and Happy Horse declare a plain integer, so the same "5" is refused
 * for being a string.
 */

const VEO = "fal-ai/veo3.1/image-to-video";
const KLING_25 = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const KLING_3 = "fal-ai/kling-video/v3/pro/image-to-video";
const WAN = "fal-ai/wan/v2.7/image-to-video";
const MINIMAX = "minimax/h3/image-to-video";
const SEEDANCE = "bytedance/seedance-2.5/image-to-video";
const NOT_VIDEO = "fal-ai/nano-banana/edit";

describe("durationOptionsFor", () => {
  it("reads Veo's suffixed seconds off the generated table", () => {
    expect(durationOptionsFor(VEO)).toEqual(["4s", "6s", "8s"]);
  });

  it("orders by length rather than alphabetically", () => {
    // The generated table is sorted as text, which puts "10" before "4" and
    // makes the menu read as nonsense.
    expect(durationOptionsFor(KLING_3)?.slice(0, 4)).toEqual([
      "3",
      "4",
      "5",
      "6",
    ]);
  });

  it("writes out a range the endpoint states as min and max", () => {
    // MiniMax lists no values at all — it constrains 5 to 15 — and a range is
    // not something a menu can show.
    expect(durationOptionsFor(MINIMAX)).toEqual([
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
    ]);
  });

  it("puts a word that is not a length last", () => {
    expect(durationOptionsFor(SEEDANCE)?.at(-1)).toBe("auto");
  });

  it("gives null for an endpoint that takes no duration", () => {
    expect(durationOptionsFor(NOT_VIDEO)).toBeNull();
  });
});

describe("durationValueFor", () => {
  it("spells five seconds the way Veo spells it", () => {
    // The reported failure: "5" is not in Veo's enum, and "4s" is the nearest
    // length it does offer.
    expect(durationValueFor(VEO, "5")).toBe("4s");
  });

  it("clamps a length past the endpoint's longest", () => {
    expect(durationValueFor(VEO, "10")).toBe("8s");
  });

  it("matches on length before falling back to distance", () => {
    // "8" and "8s" are one clip written two ways, not two lengths.
    expect(durationValueFor(VEO, "8")).toBe("8s");
  });

  it("breaks a tie towards the shorter clip", () => {
    // Five sits exactly between "4s" and "6s". These endpoints bill by
    // duration, so the shorter is the only one that cannot overcharge.
    expect(durationValueFor(VEO, "5")).toBe("4s");
  });

  it("passes a value through when the endpoint already lists it", () => {
    expect(durationValueFor(KLING_25, "5")).toBe("5");
    expect(durationValueFor(KLING_25, "10")).toBe("10");
  });

  it("sends a number where the endpoint declares an integer", () => {
    // The second bug: Wan takes `duration` as an integer, so the string "5" is
    // refused for its type even though 5 is an allowed length.
    expect(durationValueFor(WAN, "5")).toBe(5);
    expect(durationValueFor(MINIMAX, "10")).toBe(10);
  });

  it("clamps into an endpoint's range before typing it", () => {
    // MiniMax starts at five, so a three-second request cannot be honoured.
    expect(durationValueFor(MINIMAX, "3")).toBe(5);
  });

  it("sends nothing when the endpoint takes no duration", () => {
    expect(durationValueFor(NOT_VIDEO, "5")).toBeNull();
  });

  it("sends nothing for a blank setting", () => {
    expect(durationValueFor(VEO, "")).toBeNull();
  });
});

describe("the menu and the request agree", () => {
  it("shows every stored length as the value that will be sent", () => {
    // The two halves reading one table is the whole point: a control saying
    // one length while the request sends another is the same bug in a hat.
    for (const model of [VEO, KLING_25, KLING_3, WAN, MINIMAX, SEEDANCE]) {
      const options = durationOptionsFor(model);
      expect(options, model).toBeTruthy();
      for (const shown of options as readonly string[]) {
        expect(durationLabelFor(model, shown), `${model} ${shown}`).toBe(shown);
        expect(String(durationValueFor(model, shown))).toBe(shown);
      }
    }
  });

  it("never offers a length the endpoint did not declare", () => {
    // Catches a refreshed table narrowing an enum out from under the menu.
    for (const model of [VEO, KLING_25, KLING_3, SEEDANCE]) {
      for (const shown of durationOptionsFor(model) as readonly string[]) {
        expect(durationValueFor(model, shown), `${model} ${shown}`).toBe(shown);
      }
    }
  });
});
