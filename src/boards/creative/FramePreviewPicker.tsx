import {
  isSocialPreviewId,
  SOCIAL_PREVIEW_OPTIONS,
  type SocialPreviewId,
} from "../../../config/socialPreview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import "./FramePreviewPicker.css";

export const socialPreviewOf = (value: unknown): SocialPreviewId =>
  isSocialPreviewId(value) ? value : "artwork";

export function FramePreviewPicker({
  onChange,
  value,
}: {
  onChange: (value: SocialPreviewId) => void;
  value: SocialPreviewId;
}) {
  return (
    <div className="creative__preview-control">
      <span>Preview</span>
      <Select
        onValueChange={(next) => {
          if (next !== null && isSocialPreviewId(next)) {
            onChange(next);
          }
        }}
        value={value}
      >
        <SelectTrigger
          aria-label="Frame platform preview"
          size="sm"
          tone="board"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Frame</SelectLabel>
            <SelectItem value="artwork">Original artwork</SelectItem>
          </SelectGroup>
          {[
            ...new Set(SOCIAL_PREVIEW_OPTIONS.map((option) => option.group)),
          ].map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {SOCIAL_PREVIEW_OPTIONS.filter(
                (option) => option.group === group
              ).map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
