import loadGhostscript from "@okathira/ghostpdl-wasm";
import wasmUrl from "@okathira/ghostpdl-wasm/gs.wasm?url";
import { outlinePdfArgs } from "./outlinePdfArgs";

/**
 * Ghostscript in a worker: one PDF in, outlined artwork out. A fresh
 * Ghostscript for every file, since its main can only be run once, and in a
 * worker because a poster's pictures take it many seconds, which would
 * freeze the page.
 */
self.onmessage = async (
  event: MessageEvent<{ bytes: ArrayBuffer; cmyk: boolean }>
) => {
  const log: string[] = [];
  try {
    const gs = await loadGhostscript({
      locateFile: () => wasmUrl,
      print: () => undefined,
      printErr: (line: string) => log.push(line),
    });
    gs.FS.writeFile("in.pdf", new Uint8Array(event.data.bytes));
    const code = gs.callMain(outlinePdfArgs(event.data.cmyk));
    const out = code === 0 ? gs.FS.readFile("out.pdf") : null;
    if (!out) {
      throw new Error(log.at(-1) ?? `Ghostscript stopped (${code})`);
    }
    self.postMessage({ pdf: out.buffer }, { transfer: [out.buffer] });
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : String(log.at(-1) ?? e),
    });
  }
};
