import type { ReviewScreen, RichText } from "../../../config/review.js";
import { PageDesignView } from "../../boards/pages/PageDesignView";
import { PageEditor } from "../../cms/PageEditor";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { ScreenUpdate } from "./ReviewScreenEditor";
import { toEditorDoc } from "./reviewEditing";

export function ReviewPageScreenEditor({
  boardId,
  screen,
  onChange,
  onRemove,
}: {
  boardId?: string | null;
  screen: ReviewScreen;
  onChange: ScreenUpdate;
  onRemove: () => void;
}) {
  if (!screen.pageDesign) {
    return null;
  }
  return (
    <div className="stack">
      <Label htmlFor={`page-title-${screen.id}`}>Page title</Label>
      <Input
        id={`page-title-${screen.id}`}
        onChange={(e) =>
          onChange((prev) => ({ ...prev, title: e.target.value }))
        }
        value={screen.title}
      />
      <p>
        The page stays interactive here. Edit its layout on the canvas, then
        publish the board’s review again to update it.
      </p>
      {boardId ? <a href={`/admin/boards/${boardId}`}>Open on canvas</a> : null}
      <PageDesignView page={screen.pageDesign} />
      <Label>About this page</Label>
      <PageEditor
        onChange={(note) =>
          onChange((prev) => ({ ...prev, note: note as RichText }))
        }
        value={toEditorDoc(screen.note)}
      />
      <Button onClick={onRemove} type="button" variant="ghost">
        Remove page
      </Button>
    </div>
  );
}
