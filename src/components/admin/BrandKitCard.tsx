import BookOpen01Icon from "@hugeicons-pro/core-stroke-standard/BookOpen01Icon";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-standard/PlusSignIcon";
import type { ReactNode } from "react";
import type { BrandKit } from "../../services/brandKitService";
import { AdminListRow, AdminRowAction } from "./AdminList";
import { PalettePreview } from "./BrandKitPreviews";
import "./BrandKitsPanel.css";

/**
 * One kit in the library, as a row of the shared admin list.
 *
 * The last thing out of BrandKitsPanel, which was over the 500-line ceiling. A
 * row is a summary and a way in — it neither edits a document nor knows how one
 * is saved, which is the whole of what the panel around it does.
 */

function kitMeta(kit: BrandKit): string {
  const version =
    kit.version === null
      ? "No version yet"
      : `v${kit.version} · ${kit.resolvedDoc.palette.length} colours`;
  const inherits =
    kit.inherited.length > 0 ? ` · inherits ${kit.inherited.length}` : "";
  return `${version}${inherits}`;
}

export function KitCard({
  below,
  indent = false,
  kit,
  onAddSub,
  onOpen,
  onRemove,
}: {
  /** The add-a-sub-brand form, while it is open for this kit. */
  below?: ReactNode;
  /** A sub-brand: set in under its parent. */
  indent?: boolean;
  kit: BrandKit;
  onAddSub?: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <AdminListRow
      actions={
        <>
          <AdminRowAction
            href={`/admin/brand-kits/${kit.id}/guide`}
            icon={BookOpen01Icon}
            label={`Open the ${kit.name} brand guide`}
          />
          {onAddSub ? (
            <AdminRowAction
              icon={PlusSignIcon}
              label={`Add a sub-brand of ${kit.name}`}
              onClick={onAddSub}
            />
          ) : null}
          <AdminRowAction
            danger
            icon={Delete02Icon}
            label={`Delete ${kit.name}`}
            onClick={onRemove}
          />
        </>
      }
      below={below}
      indent={indent}
      lead={<PalettePreview doc={kit.resolvedDoc} />}
      meta={<span className="tabular-nums">{kitMeta(kit)}</span>}
      onOpen={onOpen}
      title={kit.name}
    />
  );
}
