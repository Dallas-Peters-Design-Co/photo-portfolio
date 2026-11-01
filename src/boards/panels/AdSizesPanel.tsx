import { HugeiconsIcon } from "@hugeicons/react";
import FrameIcon from "@hugeicons-pro/core-stroke-standard/FrameIcon";
import PenTool01Icon from "@hugeicons-pro/core-stroke-standard/PenTool01Icon";
import { useState } from "react";
import { AD_SIZES, sizeFromTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import "./AdSizesPanel.css";

/**
 * Ad sizes for a frame: resize this one, or copy it out at several.
 *
 * The frame is the ad and what sits on it is the design; either action lays
 * the design out again so corners stay in corners and centred type stays
 * centred (config/adLayout.ts). Checking one size offers both; checking more
 * offers copies, since one frame cannot be two sizes.
 */

export type FitMode = "copy" | "resize";

export function AdSizesRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="panel-row panel-row--divided"
      onClick={onOpen}
      type="button"
    >
      <HugeiconsIcon aria-hidden icon={FrameIcon} size={14} />
      <span>Ad sizes…</span>
    </button>
  );
}

export function DesignRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="panel-row panel-row--divided"
      onClick={onOpen}
      type="button"
    >
      <HugeiconsIcon aria-hidden icon={PenTool01Icon} size={14} />
      <span>Design this frame…</span>
    </button>
  );
}

export function AdSizesPanel({
  frame,
  onCancel,
  onFit,
}: {
  frame: BoardItem;
  onCancel: () => void;
  onFit: (sizeIds: string[], mode: FitMode) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const current = sizeFromTitle(frame.body);
  const toggle = (id: string) =>
    setChecked((was) =>
      was.includes(id) ? was.filter((x) => x !== id) : [...was, id]
    );
  const groups = [...new Set(AD_SIZES.map((s) => s.group))];

  return (
    <div className="panel-section ad-sizes">
      <span className="panel-label">Sizes</span>
      <div className="ad-sizes__list">
        {groups.map((group) => (
          <fieldset className="ad-sizes__group" key={group}>
            <legend className="ad-sizes__legend">{group}</legend>
            {AD_SIZES.filter((s) => s.group === group).map((size) => {
              const isCurrent = current?.w === size.w && current?.h === size.h;
              return (
                <label className="ad-sizes__option" key={size.id}>
                  <input
                    checked={checked.includes(size.id)}
                    onChange={() => toggle(size.id)}
                    type="checkbox"
                  />
                  <span>{size.label}</span>
                  <span className="ad-sizes__dims">
                    {size.w}×{size.h}
                    {isCurrent ? " · now" : ""}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <p className="panel-hint">
        Items keep their corner or stay centred; a photo filling the frame keeps
        filling it.
      </p>
      <div className="panel-actions">
        <button className="panel-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="panel-button"
          disabled={checked.length !== 1}
          onClick={() => onFit(checked, "resize")}
          type="button"
        >
          Resize this frame
        </button>
        <button
          className="panel-button panel-button--tinted"
          disabled={checked.length === 0}
          onClick={() => onFit(checked, "copy")}
          type="button"
        >
          {checked.length > 1 ? `Make ${checked.length} copies` : "Make a copy"}
        </button>
      </div>
    </div>
  );
}
