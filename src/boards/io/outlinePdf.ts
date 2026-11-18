/**
 * A print PDF with outlined fonts in the browser, by Ghostscript built to WebAssembly
 * (outlinePdf.worker.ts). Done here rather than on the server: the converter is
 * a 15 MB download fetched only when it's asked for, and a large poster's
 * pictures take it longer than a server function is given.
 */
export const outlinePdf = (pdf: Blob, cmyk: boolean): Promise<Blob> =>
  pdf.arrayBuffer().then(
    (bytes) =>
      new Promise<Blob>((resolve, reject) => {
        const worker = new Worker(
          new URL("./outlinePdf.worker.ts", import.meta.url),
          { type: "module" }
        );
        const done = () => worker.terminate();
        worker.onmessage = (
          event: MessageEvent<{ error?: string; pdf?: ArrayBuffer }>
        ) => {
          done();
          const { error, pdf: out } = event.data;
          if (out) {
            resolve(new Blob([out], { type: "application/pdf" }));
          } else {
            reject(
              new Error(`Couldn't outline the print PDF: ${error ?? "unknown"}`)
            );
          }
        };
        worker.onerror = (event) => {
          done();
          reject(new Error(`Couldn't outline the print PDF: ${event.message}`));
        };
        worker.postMessage({ bytes, cmyk }, [bytes]);
      })
  );
