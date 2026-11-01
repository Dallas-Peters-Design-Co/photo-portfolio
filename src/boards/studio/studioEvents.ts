/**
 * Opening the Studio from anywhere (the insert palette, the design canvas)
 * without threading the board's internals through to each.
 */

const EVENT = "board-studio";

export const openStudio = (toolId: string): void => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { toolId } }));
};

export const onOpenStudio = (
  handler: (toolId: string) => void
): (() => void) => {
  const listener = (e: Event) =>
    handler(
      String((e as CustomEvent<{ toolId?: string }>).detail?.toolId ?? "")
    );
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
