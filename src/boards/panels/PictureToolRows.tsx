import { HugeiconsIcon } from "@hugeicons/react";
import MagicWand01Icon from "@hugeicons-pro/core-stroke-standard/MagicWand01Icon";
import PaintBrush01Icon from "@hugeicons-pro/core-stroke-standard/PaintBrush01Icon";
import type { BoardItem } from "../../types";
import "../boardChrome.css";

/**
 * The two things the menu does *to* a picture: trace it into vector art, or
 * put effects over it. Split from MenuRows, which was at its size ceiling.
 */

const rowClass = "panel-row";

/**
 * Whether "Add effects" is offered: any item with a picture that is not
 * already a shader. A node's result or a Studio layer can take effects too,
 * not only a placed picture.
 */
const canTakeEffects = (
  picked: BoardItem | null,
  hasPicture: boolean,
  onAddEffects: ((itemId: string) => void) | undefined
): picked is BoardItem =>
  picked !== null &&
  hasPicture &&
  onAddEffects !== undefined &&
  picked.kind !== "shader";

function EffectsRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button className={rowClass} onClick={onAdd} type="button">
      <HugeiconsIcon aria-hidden icon={PaintBrush01Icon} size={14} />
      <span>Add effects</span>
    </button>
  );
}

function VectorizeRow({ onVectorize }: { onVectorize: () => void }) {
  return (
    <button className={rowClass} onClick={onVectorize} type="button">
      <HugeiconsIcon aria-hidden icon={MagicWand01Icon} size={14} />
      <span>Vectorize</span>
    </button>
  );
}

/** The two things done *to* a picture: trace it, or put effects over it. */
export function PictureToolRows({
  canVectorize,
  hasPicture,
  onAddEffects,
  onVectorize,
  picked,
}: {
  canVectorize: boolean;
  hasPicture: boolean;
  onAddEffects?: (itemId: string) => void;
  onVectorize?: (itemId: string) => void;
  picked: BoardItem | null;
}) {
  return (
    <>
      {picked && canVectorize && onVectorize ? (
        <VectorizeRow onVectorize={() => onVectorize(picked.id)} />
      ) : null}
      {canTakeEffects(picked, hasPicture, onAddEffects) && onAddEffects ? (
        <EffectsRow onAdd={() => onAddEffects(picked.id)} />
      ) : null}
    </>
  );
}
