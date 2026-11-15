const pending = new Map<string, Promise<boolean>>();

/** Resolves only after @font-face rules are registered, before measuring text. */
export const loadFontStylesheet = (
  href: string,
  crossOrigin = true
): Promise<boolean> => {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }
  const previous = pending.get(href);
  if (previous) {
    return previous;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = "anonymous";
  }
  const ready = new Promise<boolean>((resolve) => {
    link.addEventListener("load", () => resolve(true), { once: true });
    link.addEventListener(
      "error",
      () => {
        pending.delete(href);
        link.remove();
        resolve(false);
      },
      { once: true }
    );
  });
  pending.set(href, ready);
  document.head.append(link);
  return ready;
};
