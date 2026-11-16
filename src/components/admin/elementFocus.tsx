import { createContext, useContext } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";

/**
 * The element picked in the editor's preview, for the settings to open:
 * its own row and every row it sits inside (a panel, a slot's group), and
 * then scroll to it. `nonce` changes on every pick, so picking the same
 * element again scrolls to it again.
 */
export interface ElementFocus {
  nonce: number;
  /** The picked element and the ones holding it. */
  path: ReadonlySet<string>;
  target: string | null;
}

export const NO_FOCUS: ElementFocus = {
  nonce: 0,
  path: new Set(),
  target: null,
};

const ElementFocusContext = createContext<ElementFocus>(NO_FOCUS);

export const ElementFocusProvider = ElementFocusContext.Provider;

export const useElementFocus = () => useContext(ElementFocusContext);

/** The ids from the top of the list down to `id`, or [] if it isn't there. */
export const pathTo = (
  elements: ReviewConceptElement[],
  id: string
): string[] => {
  for (const element of elements) {
    if (element.id === id) {
      return [id];
    }
    const children = [
      ...Object.values(element.slots ?? {}).flatMap((s) => s?.elements ?? []),
      ...(element.group?.elements ?? []),
    ];
    const below = pathTo(children, id);
    if (below.length > 0) {
      return [element.id, ...below];
    }
  }
  return [];
};
