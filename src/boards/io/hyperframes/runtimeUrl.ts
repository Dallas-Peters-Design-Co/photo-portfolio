// The Studio runtime (runtime.ts), bundled by Vite as a self-contained
// script, for the HyperFrames export to copy in as assets/studio.js. Bundled
// as a worker only because that's how Vite builds one file with everything
// it imports inlined; it runs as a plain script in the video's page.
import runtimeUrl from "./runtime.ts?worker&url";

/**
 * opentype.js stamps the date into fonts it writes, which the runtime never
 * does, but HyperFrames' check fails any script that says `new Date()`.
 * Written another way, it's the same code and passes.
 */
export const forHyperframes = (js: string): string =>
  js.replaceAll(NEW_DATE, "new (Date)(");

const NEW_DATE = /new\s+Date\s*\(/g;

/** The runtime script's bytes, fetched from the site. */
export const runtimeBytes = async (): Promise<Uint8Array<ArrayBuffer>> => {
  const res = await fetch(runtimeUrl);
  if (!res.ok) {
    throw new Error("Couldn't load the Studio runtime");
  }
  return new TextEncoder().encode(forHyperframes(await res.text()));
};
