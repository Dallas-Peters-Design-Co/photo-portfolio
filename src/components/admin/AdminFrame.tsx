import type * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";

/**
 * The shared shell of the admin's list and editor pages (proposals,
 * reviews): one width and one card style, so the pages line up and change
 * together.
 */

/** The page column: full width up to `max-w-8xl`, its parts stacked. */
export function AdminFrame({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid w-full max-w-8xl grid-cols-1 gap-4", className)}
      data-slot="admin-frame"
      {...props}
    />
  );
}

/**
 * A card on an admin page: the thin rule and faint fill they all share.
 * Clipped with overflow: clip, not hidden: it clips the same, but it is not a
 * scroll container, so a sticky child (a review's screenshot) still sticks.
 */
export function AdminCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "w-full overflow-clip border-white/10 bg-white/2",
        className
      )}
      data-slot="admin-card"
      {...props}
    />
  );
}
