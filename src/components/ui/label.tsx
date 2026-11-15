import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A field's label. One look across the admin — small caps, wide tracking —
 * set here rather than at each call site (@shadcn/lint no-restyle). `inline`
 * is the sentence-case label beside a checkbox or switch.
 */
const labelVariants = cva(
  "flex select-none items-center gap-2 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
  {
    defaultVariants: { variant: "field" },
    variants: {
      variant: {
        field: "text-micro-xs text-white/90 uppercase tracking-widest",
        inline: "text-sm text-white/80",
      },
    },
  }
);

function Label({
  children,
  className,
  htmlFor,
  variant,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label
      className={cn(labelVariants({ variant }), className)}
      data-slot="label"
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}

export { Label, labelVariants };
