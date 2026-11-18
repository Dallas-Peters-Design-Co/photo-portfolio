import { type ComponentProps, memo, useCallback } from "react";
import type { ReviewScreen } from "../../../config/review.js";
import { ReviewPageScreenEditor } from "./ReviewPageScreenEditor";
import { ReviewScreenEditor } from "./ReviewScreenEditor";

type Props = Omit<
  ComponentProps<typeof ReviewScreenEditor>,
  "onChange" | "onRemove"
> & {
  onChange: (
    id: string,
    update: (screen: ReviewScreen) => ReviewScreen
  ) => void;
  onRemove: (id: string) => void;
  boardId?: string | null;
};

/** Only the screen being edited needs to redraw its markup, notes and controls. */
export const ReviewEditorScreen = memo(function ScreenBody({
  onChange,
  onRemove,
  boardId,
  ...props
}: Props) {
  const { id } = props.screen;
  const change = useCallback(
    (update: (screen: ReviewScreen) => ReviewScreen) => onChange(id, update),
    [id, onChange]
  );
  const remove = useCallback(() => onRemove(id), [id, onRemove]);
  if (props.screen.pageDesign) {
    return (
      <ReviewPageScreenEditor
        boardId={boardId}
        onChange={change}
        onRemove={remove}
        screen={props.screen}
      />
    );
  }
  return <ReviewScreenEditor {...props} onChange={change} onRemove={remove} />;
});
