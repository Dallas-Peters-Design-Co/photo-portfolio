import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

/**
 * The one way back out of a full-page admin editor: top left, above the
 * title, naming where it goes ("Proposals", "Brand kits"). Every editor uses
 * this so leaving is always in the same place.
 */
export function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="-ml-3 self-start"
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      <ArrowLeft aria-hidden size={14} />
      {label}
    </Button>
  );
}
