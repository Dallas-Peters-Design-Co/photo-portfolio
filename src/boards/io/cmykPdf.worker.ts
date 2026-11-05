import loadGhostscript from "@okathira/ghostpdl-wasm";
import wasmUrl from "@okathira/ghostpdl-wasm/gs.wasm?url";
import { CMYK_ARGS } from "./cmykArgs";

/**
 * Ghostscript in a worker: one PDF in, the same PDF in CMYK out. A fresh
 * Ghostscript for every file, since its main can only be run once, and in a
 * worker because a poster's pictures take it many seconds, which would
 * freeze the page.
 */
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  const log: string[] = [];
  try {
    const gs = await loadGhostscript({
      locateFile: () => wasmUrl,
      print: () => undefined,
      printErr: (line: string) => log.push(line),
    });
    gs.FS.writeFile("in.pdf", new Uint8Array(event.data));
    const code = gs.callMain(CMYK_ARGS);
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
