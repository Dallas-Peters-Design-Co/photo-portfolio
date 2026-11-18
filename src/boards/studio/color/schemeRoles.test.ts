import { expect, it } from "vitest";
import { schemePalette } from "./schemeRoles";

it("matches status roles across kits in different orders and keeps their authored names", () => {
  const target = [
    { name: "Caution", role: "warning", value: "#663300" },
    { name: "Confirmed", role: "success", value: "#005500" },
    { name: "Ink", role: "text", value: "#111111" },
  ];
  const source = [
    { name: "Green", role: "success", value: "#22aa55" },
    { name: "Amber", role: "", value: "#ffaa00" },
  ];
  expect(schemePalette(target, source, { 1: "warning" }, true)).toEqual([
    { ...target[0], value: "#ffaa00" },
    { ...target[1], value: "#22aa55" },
    target[2],
  ]);
});
