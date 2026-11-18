import { ClipboardPaste, Paintbrush } from "lucide-react";
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
    <>
      <Button
        aria-label="Copy style"
        onClick={copy}
        size="icon-sm"
        title="Copy style"
        type="button"
        variant="ghost"
      >
        <Paintbrush aria-hidden size={14} />
      </Button>
      <Button
        aria-label="Paste style"
        disabled={!raw}
        onClick={paste}
        size="icon-sm"
        title={raw ? "Paste style" : "Copy a component style first"}
        type="button"
        variant="ghost"
      >
        <ClipboardPaste aria-hidden size={14} />
      </Button>
    </>
  );
}
