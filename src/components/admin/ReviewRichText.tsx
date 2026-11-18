import { memo, useCallback, useMemo } from "react";
import type { ReviewDoc, RichText } from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { toEditorDoc } from "./reviewEditing";

export const ReviewRichText = memo(function RichTextBody({
  field,
  onChange,
  value,
}: {
  field: "intro" | "summary" | "closing";
  onChange: (patch: Partial<ReviewDoc>) => void;
  value: RichText;
}) {
  const doc = useMemo(() => toEditorDoc(value), [value]);
  const change = useCallback(
    (next: unknown) => onChange({ [field]: next as RichText }),
    [field, onChange]
  );
  return <PageEditor onChange={change} value={doc} />;
});
