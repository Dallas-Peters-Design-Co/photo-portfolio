import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Every text field in the app. Its look lives here, not at the call site
 * (@shadcn/lint no-restyle): pick a size, a tone and a face; put width and
 * spacing on a wrapper around it.
 */
const inputVariants = cva(
  "w-full min-w-0 rounded-control border px-2.5 py-1 outline-none transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  {
    defaultVariants: { face: "sans", size: "default", tone: "admin" },
    variants: {
      /** Mono for addresses and codes; numeric lines figures up in a column. */
      face: {
        mono: "font-mono",
        numeric: "tabular-nums",
        sans: "",
      },
      /** sm and default sit in toolbars and rows; lg is a form field, a touch target. */
      size: {
        default: "h-8 text-sm",
        lg: "min-h-11 text-base",
        sm: "h-7 text-sm",
      },
      /** The admin's dark ground, or the board's paper. */
      tone: {
        admin:
          "border-white/10 bg-black/40 text-white placeholder:text-white/40 focus:border-white/40",
        board:
          "border-board-ink/10 bg-board-surface/40 text-board-ink placeholder:text-board-ink/40 focus:border-board-ink/40",
      },
    },
  }
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants> & {
    ref?: React.RefObject<HTMLInputElement | null>;
  };

const Input = function Input({
  className,
  face,
  ref,
  size,
  tone,
  type,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      className={cn(inputVariants({ face, size, tone }), className)}
      data-slot="input"
      // Base UI Input is typed as HTMLElement ref; forwardRef uses HTMLInputElement — same node at runtime.
      ref={ref as never}
      type={type}
      {...props}
    />
  );
};

export { Input, inputVariants };
