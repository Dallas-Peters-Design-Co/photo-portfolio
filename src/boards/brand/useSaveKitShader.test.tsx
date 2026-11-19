import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { cleanKitShader } from "../../../config/kitShaders";
import { useSaveKitShader } from "./useSaveKitShader";

const { saveKit } = vi.hoisted(() => ({ saveKit: vi.fn() }));
vi.mock("../../services/brandKitService", () => ({
  brandKitsApi: { save: saveKit },
}));
vi.mock("./ActiveBrand", () => ({
  useActiveBrand: () => ({
    kit: {
      doc: { shaders: [] },
      id: "kit",
      name: "Kit",
      resolvedDoc: { shaders: [] },
    },
  }),
}));
vi.mock("../../components/admin/ConfirmProvider", () => ({
  useConfirm: () => ({ prompt: async () => "Pixel throw" }),
}));

it("packages the connected artwork inside PixelThrow for use away from the board", async () => {
  const url = "https://example.com/frames/artwork.png";
  const root = createRoot(document.createElement("div"));
  let save: ReturnType<typeof useSaveKitShader>["save"] | undefined;
  function Host() {
    ({ save } = useSaveKitShader());
    return null;
  }
  try {
    act(() => root.render(<Host />));
    await save?.(
      {
        imageFit: "cover",
        layers: [{ id: "effect", name: "PixelThrow", props: { strength: 2 } }],
      },
      "PixelThrow",
      async () => url
    );
    const shader = cleanKitShader(saveKit.mock.calls[0][1].shaders[0]);
    expect(shader?.layers).toMatchObject([
      {
        children: [
          { name: "ImageTexture", props: { objectFit: "cover", url } },
        ],
        name: "PixelThrow",
        props: { strength: 2 },
      },
    ]);
  } finally {
    act(() => root.unmount());
  }
});
