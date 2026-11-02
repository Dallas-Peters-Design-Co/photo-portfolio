import { describe, expect, it } from "vitest";
import {
  colourName,
  groupPalette,
  inkOn,
  paperAndInk,
  valuesOf,
} from "./guideModel";

describe("brand guide colours", () => {
  it("sorts a palette into brand, neutral and signal, in the kit's order", () => {
    const groups = groupPalette([
      { name: "cobalt", role: "primary", value: "#1e3dff" },
      { name: "ink", role: "text", value: "#0b0f1a" },
      { name: "snow", role: "", value: "#fafafa" },
      { name: "green", role: "success", value: "#22c55e" },
      { name: "stone", role: "neutral", value: "#a8a29e" },
    ]);
    expect(groups.brand.map((c) => c.name)).toEqual(["cobalt"]);
    expect(groups.neutral.map((c) => c.name)).toEqual(["ink", "snow", "stone"]);
    expect(groups.signal.map((c) => c.name)).toEqual(["green"]);
  });

  it("finds paper and ink whatever order the neutrals are in", () => {
    expect(
      paperAndInk([
        { name: "ink", role: "text", value: "#0b0f1a" },
        { name: "snow", role: "", value: "#fafafa" },
        { name: "stone", role: "neutral", value: "#a8a29e" },
      ])
    ).toEqual({ ink: "#0b0f1a", paper: "#fafafa" });
  });

  it("won't make a mid grey both the paper and the ink", () => {
    expect(
      paperAndInk([
        { name: "op-color-primary-original", role: "", value: "#2e84f5" },
        { name: "op-color-neutral-original", role: "", value: "#cccccc" },
      ])
    ).toEqual({ ink: null, paper: null });
  });

  it("names colours imported from CSS as a person would", () => {
    const named = (name: string) =>
      colourName({ name, role: "", value: "#000000" });
    expect(named("op-color-primary-original")).toBe("Primary");
    expect(named("op-color-alerts-warning-original")).toBe("Alerts warning");
    expect(named("--brand-blue")).toBe("Brand blue");
    expect(named("Cobalt")).toBe("Cobalt");
  });

  it("gives each colour's values in every format", () => {
    expect(valuesOf("#1e3dff")).toEqual({
      hex: "#1E3DFF",
      oklch: "oklch(50.2% 0.28 266.1)",
      rgb: "30, 61, 255",
    });
  });

  it("picks readable ink", () => {
    expect(inkOn("#fafafa")).toBe("dark");
    expect(inkOn("#1e3dff")).toBe("light");
  });
});
