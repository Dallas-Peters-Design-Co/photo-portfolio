/**
 * Nodes the browser draws, and where each keeps what it drew.
 *
 * Composite, Cover, Print wrap and Mockup are not run by a model: the browser
 * renders them before a run and stores the file's URL on the node's config,
 * and the server's "run" is to hand that URL back as the result. That makes
 * their output available a step earlier than every other node's — the moment
 * the flush has written it, before the run has stored a result — and both
 * sides of the app need to read it from there:
 *
 * - the run's `outputsOf`, so a Cover fed by a Composite finds its artwork on
 *   the first press of Run rather than the second (the flush renders the
 *   Composite, then the Cover, then the run begins; a Cover that only read
 *   the Composite's *result* was refused for want of an input it plainly had);
 * - the canvas's `outputImageOf`, so a wire from one of these shows what it
 *   carries, and the next node's own flush can read it.
 *
 * One table, in config, because it is consulted from api/, src/boards/ and
 * the finishers, and three copies of "which key" is how they drift.
 */
export const RENDER_URL_KEYS: Readonly<Record<string, string>> = {
  composite: "compositeUrl",
  cover: "coverUrl",
  mockup: "mockupUrl",
  trace: "traceUrl",
  wrap: "wrapUrl",
};

/** The browser's render for this node, if it has one that is still current. */
export const renderedUrlOf = (
  nodeType: string | null | undefined,
  config: Record<string, unknown> | null | undefined
): string | null => {
  const key = nodeType ? RENDER_URL_KEYS[nodeType] : undefined;
  if (!key) {
    return null;
  }
  const url = config?.[key];
  return typeof url === "string" && url ? url : null;
};
