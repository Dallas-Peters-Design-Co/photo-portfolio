import { FileText, Upload } from "lucide-react";
import type { CSSProperties } from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";

/**
 * A file upload: a dashed drop area with its prompt, and — once a file name
 * is set (`placeholder`, "File after upload") — the file it holds, so a
 * sequence can show the moment after a file is picked.
 */
export function ConceptUploadPreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const size = Math.round(element.fontSize * 1.6);
  const file = element.placeholder?.trim();
  return (
    <div
      className="concept-upload"
      style={{
        ...style,
        border:
          style.border ??
          "2px solid color-mix(in srgb, currentColor 30%, transparent)",
        borderStyle: "dashed",
      }}
    >
      <Upload aria-hidden size={size} strokeWidth={1.75} />
      <span>{element.text || "Drop a file here, or browse"}</span>
      {file ? (
        <span className="concept-upload__file">
          <FileText aria-hidden size={element.fontSize} />
          {file}
        </span>
      ) : null}
    </div>
  );
}
