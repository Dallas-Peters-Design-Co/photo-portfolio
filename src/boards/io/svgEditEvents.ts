/**
 * Saving an edited SVG back onto its board item, from wherever it was edited
 * (the item's own tool bar), without threading the board's save through the
 * canvas to get there. The board editor answers (useBoardVectorTools); the
 * asker gets a promise that settles when the save has.
 */

const EVENT = "board-svg-save";

interface Ask {
  done: (error?: Error) => void;
  itemId: string;
  svg: string;
}

const claimed = new WeakSet<Ask["done"]>();

export const saveSvgEdit = (itemId: string, svg: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const done = (error?: Error) => (error ? reject(error) : resolve());
    window.dispatchEvent(
      new CustomEvent<Ask>(EVENT, { detail: { done, itemId, svg } })
    );
    // Nobody listening (a published board): say so rather than hang.
    if (!claimed.has(done)) {
      reject(new Error("This board can't be changed here"));
    }
  });

export const onSvgEdit = (
  handler: (itemId: string, svg: string) => Promise<void>
): (() => void) => {
  const listener = (e: Event) => {
    const ask = (e as CustomEvent<Ask>).detail;
    claimed.add(ask.done);
    handler(ask.itemId, ask.svg).then(
      () => ask.done(),
      (err: unknown) =>
        ask.done(err instanceof Error ? err : new Error("Couldn't save it"))
    );
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
