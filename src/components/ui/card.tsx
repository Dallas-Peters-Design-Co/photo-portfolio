import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cards, with their looks defined here rather than at each call site
 * (@shadcn/lint no-restyle). A card is the admin's panel: a faint fill and a
 * thin ring, full width; its header, title, content and footer each take a
 * layout instead of classes. Width beyond full goes on a wrapper.
 *
 * Clipped with overflow: clip, not hidden: it clips the same, but it is not
 * a scroll container, so a sticky child (a review's screenshot) still sticks.
 */

const cardVariants = cva(
  "group/card flex w-full flex-col overflow-clip rounded-surface text-card-foreground text-sm ring-1 has-[>img:first-child]:pt-0 has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-surface *:[img:last-child]:rounded-b-surface",
  {
    defaultVariants: { flush: false, selected: false, tone: "default" },
    variants: {
      /** A list card: rows run edge to edge, with no gap or padding. */
      flush: { false: "gap-4 py-4", true: "gap-0 py-0" },
      /** The one picked among several. */
      selected: { false: "ring-white/10", true: "ring-white" },
      tone: {
        default: "bg-white/2",
        raised: "bg-white/5",
        sunken: "bg-black/20",
      },
    },
  }
);

function Card({
  className,
  flush,
  selected,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      className={cn(cardVariants({ flush, selected, tone }), className)}
      data-slot="card"
      {...props}
    />
  );
}

const cardHeaderVariants = cva("group/card-header rounded-t-surface px-4", {
  defaultVariants: { layout: "stack" },
  variants: {
    layout: {
      /** Title over its actions, wrapping to a row on a wide window, ruled off. */
      bar: "flex flex-col gap-3 border-white/5 border-b pb-4 md:flex-row md:items-center md:justify-between md:gap-4",
      /** Title left, actions right. */
      row: "flex flex-row items-center justify-between gap-4",
      /** Things stacked from the left: a back link over the title. */
      stack: "flex flex-col items-start gap-2",
    },
  },
});

function CardHeader({
  className,
  layout,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardHeaderVariants>) {
  return (
    <div
      className={cn(cardHeaderVariants({ layout }), className)}
      data-slot="card-header"
      {...props}
    />
  );
}

/** The admin's panel heading: small caps, wide tracking, an icon beside it. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-micro-widest",
        className
      )}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("shrink-0 self-start", className)}
      data-slot="card-action"
      {...props}
    />
  );
}

const cardContentVariants = cva("", {
  defaultVariants: { flush: false, layout: "block" },
  variants: {
    /** Content that runs to the card's edges. */
    flush: { false: "px-4", true: "p-0" },
    layout: {
      block: "",
      /** Two columns of fields on a wide window. */
      grid: "grid gap-4 sm:grid-cols-2",
      /** Sections one under another. */
      stack: "flex flex-col gap-6",
    },
  },
});

function CardContent({
  className,
  flush,
  layout,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardContentVariants>) {
  return (
    <div
      className={cn(cardContentVariants({ flush, layout }), className)}
      data-slot="card-content"
      {...props}
    />
  );
}

/** The card's actions, at its end. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 rounded-b-surface border-t bg-muted/50 p-4",
        className
      )}
      data-slot="card-footer"
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
};
