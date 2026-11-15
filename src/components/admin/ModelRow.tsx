import ArrowDown01Icon from "@hugeicons-pro/core-stroke-standard/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons-pro/core-stroke-standard/ArrowUp01Icon";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import Edit02Icon from "@hugeicons-pro/core-stroke-standard/Edit02Icon";
import ToggleOffIcon from "@hugeicons-pro/core-stroke-standard/ToggleOffIcon";
import ToggleOnIcon from "@hugeicons-pro/core-stroke-standard/ToggleOnIcon";
import type { ReactNode } from "react";
import { PROTECTED_MODEL_ID } from "../../../config/models";
import type { AiModel } from "../../types";
import {
  AdminListNote,
  AdminListRow,
  AdminMono,
  AdminRowAction,
} from "./AdminList";
import { inputLabel, loraSummary } from "./modelSummary";
import "../../styles/adminChrome.css";

/**
 * One model in the list.
 *
 * Its own file because ModelsPanel holds three things — a form, a list and a
 * row — and only the row is self-contained. Splitting it is what brought the
 * panel back under the size ceiling without compressing anything.
 */

export interface ModelRowProps {
  /** The edit form, when this is the row being edited. */
  below?: ReactNode;
  isFirst: boolean;
  isLast: boolean;
  model: AiModel;
  onEdit: () => void;
  onMoved: (id: string, direction: -1 | 1) => void;
  onRemoved: (model: AiModel) => void;
  onToggled: (model: AiModel) => void;
}

export function ModelRow({
  below,
  isFirst,
  isLast,
  model,
  onEdit,
  onMoved,
  onRemoved,
  onToggled,
}: ModelRowProps) {
  const isAuto = model.id === PROTECTED_MODEL_ID;
  const summary = loraSummary(model);
  const isTraining = model.training?.status === "training";
  const failure =
    model.training?.status === "failed" ? model.training.error : undefined;
  const hasBelow = Boolean(below) || isTraining || Boolean(failure);
  return (
    <AdminListRow
      actions={
        <>
          <AdminRowAction
            disabled={isFirst}
            icon={ArrowUp01Icon}
            label={`Move ${model.label} up`}
            onClick={() => onMoved(model.id, -1)}
          />
          <AdminRowAction
            disabled={isLast}
            icon={ArrowDown01Icon}
            label={`Move ${model.label} down`}
            onClick={() => onMoved(model.id, 1)}
          />
          <AdminRowAction
            disabled={isAuto}
            icon={model.enabled ? ToggleOnIcon : ToggleOffIcon}
            label={`Toggle ${model.label}`}
            onClick={() => onToggled(model)}
            pressed={model.enabled}
          />
          <AdminRowAction
            icon={Edit02Icon}
            label={`Edit ${model.label}`}
            onClick={onEdit}
          />
          <AdminRowAction
            danger
            disabled={isAuto}
            icon={Delete02Icon}
            label={`Delete ${model.label}`}
            onClick={() => onRemoved(model)}
          />
        </>
      }
      badges={
        <>
          {model.vector ? (
            <span className="admin-chip admin-chip--kind">Vector</span>
          ) : null}
          {/* Training before Off, and instead of it. A style that is still
              cooking is switched off for a reason, and "Off" alone reads as
              something the author turned off. */}
          {isTraining ? (
            <span className="admin-chip admin-chip--kind">Training…</span>
          ) : null}
          {model.training?.status === "failed" ? (
            <span className="admin-chip admin-chip--plain">
              Training failed
            </span>
          ) : null}
          {model.enabled || isTraining ? null : (
            <span className="admin-chip admin-chip--plain">Off</span>
          )}
          {isAuto ? (
            <span className="admin-chip admin-chip--on">Default</span>
          ) : null}
        </>
      }
      below={
        hasBelow ? (
          <div className="grid gap-3">
            {/* The reason, not just the fact. A training that failed silently
                is indistinguishable from one still running, and knowing which
                decides whether to wait or to start again. */}
            {failure ? (
              <AdminListNote tone="warn">{failure}</AdminListNote>
            ) : null}
            {isTraining ? (
              <AdminListNote>
                Training on fal. Usually a few minutes; it turns itself on when
                the weights arrive.
              </AdminListNote>
            ) : null}
            {below}
          </div>
        ) : null
      }
      meta={
        <>
          <AdminMono>{model.id}</AdminMono>
          <span>
            {inputLabel(model.input)}
            {summary ? ` · ${summary}` : ""}
          </span>
        </>
      }
      title={model.label}
    />
  );
}
