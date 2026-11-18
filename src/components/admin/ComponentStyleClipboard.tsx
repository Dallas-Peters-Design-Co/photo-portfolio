import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  copyComponentLook,
  pasteComponentLook,
} from "../../../config/componentStyleTransfer.js";
import { cleanConceptStyles } from "../../../config/conceptStyle.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";

const KEY = "studio-component-style";
const EVENT = "studio-component-style-copied";
let fallback: string | null = null;
function read() {
  if (fallback !== null) {
    return fallback;
  }
  try {
    return localStorage.getItem(KEY);
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}
export function ComponentStyleClipboard({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const copy = () => {
    fallback = JSON.stringify({
      id: "clipboard",
      kind: element.kind,
      look: copyComponentLook(element),
      name: "Clipboard",
    });
    try {
      localStorage.setItem(KEY, fallback);
      fallback = null;
    } catch {
      /* Still available in this tab. */
    }
    window.dispatchEvent(new Event(EVENT));
    toast.success("Style copied");
  };
  const paste = () => {
    try {
      const [source] = cleanConceptStyles([JSON.parse(raw ?? "null")]);
      if (!source) {
        throw new Error("Invalid style");
      }
      onChange(pasteComponentLook(element, source.kind, source.look));
      toast.success("Style pasted");
    } catch {
      toast.error("Copy a component style first.");
    }
  };
  return (
    <div className="review-concepts__style-link">
      <Button onClick={copy} size="xs" type="button" variant="ghost">
        Copy style
      </Button>
      <Button
        disabled={!raw}
        onClick={paste}
        size="xs"
        type="button"
        variant="ghost"
      >
        Paste style
      </Button>
    </div>
  );
}
