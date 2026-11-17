import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit";
import { ActiveBrandProvider } from "../brand/ActiveBrand";
import { BrandDock } from "./BrandDock";

const shader = {
  id: "s1",
  layers: [{ id: "l1", name: "Plasma", props: {} }],
  name: "Brand glow",
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = "";
});

it("places a kit shader on the board from the Brand panel", async () => {
  const kit = {
    createdAt: "",
    doc: { ...EMPTY_KIT, shaders: [shader] },
    id: "k1",
    inherited: [],
    name: "Pretext",
    parentId: null,
    parentName: null,
    resolvedDoc: { ...EMPTY_KIT, shaders: [shader] },
    updatedAt: "",
    version: 1,
    versionCount: 1,
    versionId: "v1",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json([kit])))
  );
  localStorage.setItem("board-brand:b1", "k1");
  const onAddShader = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <ActiveBrandProvider boardId="b1">
        <BrandDock
          onAddShader={onAddShader}
          onClose={() => undefined}
          onInsert={() => undefined}
        />
      </ActiveBrandProvider>
    )
  );
  await vi.waitFor(() => {
    expect(
      host.querySelector('[title="Brand glow — add to board"]')
    ).not.toBeNull();
  });
  (
    host.querySelector('[title="Brand glow — add to board"]') as HTMLElement
  ).click();
  expect(onAddShader).toHaveBeenCalledWith({ layers: shader.layers });
});
