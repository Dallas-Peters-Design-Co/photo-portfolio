import { portfolioService } from "../../services/portfolioService";
import { type Graph, wiredImageFor } from "../canvas/wiredPreviews";
import { renderFrameBlob } from "./frameRender";
import { currentFrameRender } from "./frameRenderKey";

export const uploadFrameRender = async (png: Blob): Promise<string> =>
  (
    await portfolioService.uploadImageFile(
      new File([png], "frame.png", { type: "image/png" }),
      undefined,
      "boards/frames"
    )
  ).url;

/** A portable shader needs a durable picture of the whole wired frame. */
export async function shaderFrameInput(
  itemId: string,
  graph: Graph
): Promise<string | null> {
  const wire = graph.wires.find(
    (w) => w.targetItemId === itemId && w.targetPort === "image"
  );
  const source =
    wire && graph.items.find((item) => item.id === wire.sourceItemId);
  if (source?.kind === "frame") {
    return (
      currentFrameRender(source, graph.items) ??
      (await uploadFrameRender(await renderFrameBlob(source, graph.items)))
    );
  }
  const url = wiredImageFor(itemId, graph);
  if (wire && !url) {
    throw new Error("The connected shader input has no picture yet.");
  }
  return url;
}
