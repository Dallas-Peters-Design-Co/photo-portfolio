import {
  durationFor,
  durationOptionsFor,
} from "../../../config/nodes/videoDuration.js";
import { SettingField } from "./SettingField";

/**
 * The Video node's Seconds menu, offering what the chosen endpoint accepts.
 *
 * A fixed pair — "5" and "10" — was offered to every model. The endpoints do
 * not agree: Veo takes "4s", "6s" and "8s" and refuses everything else with a
 * 422 that arrives after the generation has been billed. Kling v2.5 takes "5"
 * and "10"; Kling v3 takes three through fifteen; several take no duration at
 * all. See config/nodes/videoDuration.ts for the table and where it comes from.
 *
 * Its own file because OpNodeView sits a dozen lines under the size ceiling and
 * this is a whole control, not a branch — the same reason SettingField and
 * ResultImages were lifted out of it.
 *
 * The stored value is shown in the endpoint's spelling rather than as stored. A
 * node that was set to "5" on Kling and then pointed at Veo would otherwise
 * render an empty menu — the control saying nothing while the run sends "4s".
 */
export function VideoDurationField({
  label,
  model,
  onChange,
  readOnly,
  stored,
}: {
  label: string;
  model: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  /** The stored seconds, or undefined when the node has never been told. */
  stored: string | undefined;
}) {
  const seconds = durationOptionsFor(model);
  // Null means the endpoint declares no duration; empty means it constrains it
  // to nothing. Either way there is no honest menu to draw.
  if (!seconds || seconds.length === 0) {
    return null;
  }
  return (
    <SettingField
      onChange={onChange}
      readOnly={readOnly}
      setting={{
        // Five seconds where the endpoint has one, its nearest length where it
        // does not — never a value the menu cannot show.
        default: durationFor(model, "5") ?? seconds[0],
        key: "duration",
        kind: "select",
        label,
        options: seconds,
      }}
      value={
        stored === undefined
          ? undefined
          : (durationFor(model, stored) ?? undefined)
      }
    />
  );
}
