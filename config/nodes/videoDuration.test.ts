import { describe, expect, it } from "vitest";
import { durationFor, durationOptionsFor } from "./videoDuration";

/**
 * The lengths each video endpoint will accept.
 *
 * Asserted against the real generated table rather than a fixture, because the
 * failure this prevents is a disagreement between our vocabulary and fal's —
 * and a fixture would only ever agree with itself. The one that cost money was
 * Veo: the node sent "5", Veo answered "Input should be '4s', '6s' or '8s'",
 * and the answer arrived after the generation was billed.
 */

const VEO = "fal-ai/veo3.1/image-to-video";
const KLING_25 = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const KLING_3 = "fal-ai/kling-video/v3/pro/image-to-video";
const WAN = "fal-ai/wan/v2.7/image-to-video";

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

  it("gives an empty list for an endpoint that constrains nothing", () => {
    expect(durationOptionsFor(WAN)).toEqual([]);
  });

  it("gives null for an endpoint with no duration at all", () => {
    expect(durationOptionsFor("fal-ai/nano-banana/edit")).toBeNull();
  });
});

describe("durationFor", () => {
  it("spells five seconds the way Veo spells it", () => {
    // The exact failure: "5" is not in Veo's enum, but "4s" is the nearest
    // length it does offer.
    expect(durationFor(VEO, "5")).toBe("4s");
  });

  it("passes a value through when the endpoint already offers it", () => {
    expect(durationFor(KLING_25, "5")).toBe("5");
    expect(durationFor(KLING_25, "10")).toBe("10");
  });

  it("matches on length before falling back to distance", () => {
    // "8" and "8s" are the same clip written two ways, not two lengths.
    expect(durationFor(VEO, "8")).toBe("8s");
  });

  it("clamps a length past the endpoint's longest", () => {
    expect(durationFor(VEO, "10")).toBe("8s");
  });

  it("breaks a tie towards the shorter clip", () => {
    // Five seconds sits exactly between "4s" and "6s". These endpoints bill by
    // duration, so the shorter one is the only one that cannot overcharge.
    expect(durationFor(VEO, "5")).toBe("4s");
  });

  it("passes anything through when the endpoint constrains nothing", () => {
    expect(durationFor(WAN, "7")).toBe("7");
  });

  it("sends nothing when the endpoint takes no duration", () => {
    expect(durationFor("fal-ai/nano-banana/edit", "5")).toBeNull();
  });
});
