"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's one button.
 *
 * Two things here are deliberate, because their absence is what drove 60 call
 * sites to re-skin this component by hand:
 *
 * 1. Colours come from `--btn-*` custom properties rather than literal classes.
 *    Buttons are painted on two surfaces — the dark admin chrome and the board
 *    editor's inverting paper — and a surface sets those variables once for
 *    everything inside it (see `index.css`). A button never needs to know which
 *    surface it is on, so a board button and an admin button are the same call.
 *
 * 2. The text sizes carry the app's micro-label treatment (10px, uppercase,
 *    wide tracking) and a 44px minimum touch target. That styling was already
 *    on nearly every button in the app; keeping it out of the component only
 *    meant every author had to remember it, and they disagreed — `tracking-
 *    widest` and `` were both in use for the same intent.
 *
 * Icon sizes deliberately skip the label treatment: there is no label to treat.
 *
 * Prefer a variant/size over `className`. Positioning a button within its
 * parent (`absolute top-2 right-2`) is still the parent's business and stays a
 * className — but anything about how the button itself *looks* belongs here, so
 * that it can be fixed in one place.
 */
const buttonVariants = cva(
  // 150ms, not 300: hover fires on every pass of the cursor, and a transition
  // long enough to notice on a high-frequency interaction reads as lag.
  // `scale` is named explicitly rather than using `transition-all`, which would
  // also animate layout properties and cost a frame on every state change.
  // Press feedback is suppressed on menu triggers (`aria-haspopup`), where the
  // button stays put while a popup opens against it.
  "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-control border border-transparent bg-clip-padding font-medium outline-none transition duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-96 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    compoundVariants: [
      {
        class:
          "border-btn-danger-border text-btn-danger-fg hover:border-btn-danger-hover-border hover:bg-btn-danger-hover-bg hover:text-btn-danger-hover-fg",
        tone: "danger",
        variant: "outline",
      },
      {
        // Calm at rest, red on intent. A row of icon actions should not be a
        // wall of red, and the label already says "Delete".
        class: "hover:bg-btn-danger-hover-bg hover:text-btn-danger-fg",
        tone: "danger",
        variant: "ghost",
      },
      {
        class:
          "bg-btn-danger-solid-bg text-btn-danger-solid-fg hover:bg-btn-danger-solid-hover-bg",
        tone: "danger",
        variant: "default",
      },
    ],
    defaultVariants: {
      fullWidth: false,
      size: "default",
      tone: "default",
      variant: "outline",
    },
    variants: {
      fullWidth: {
        false: "",
        true: "w-full",
      },
      fullWidthLeft: {
        false: "",
        true: "w-full flex-grow-1 justify-start",
      },
      size: {
        default: "min-h-11 px-4 text-sm uppercase tracking-widest",
        /** An icon in the board editor's header bar. */
        header: "relative size-9 min-w-0 p-0",
        icon: "size-10 min-h-11 min-w-11",
        "icon-lg": "size-11 min-h-11 min-w-11",
        // Below the 40px dense-desktop minimum on their own, so the target is
        // extended past the visible box with a pseudo-element rather than by
        // growing the art. Only use these where nothing sits within ~8px, or
        // the invisible targets will overlap.
        "icon-sm": "relative size-8 after:absolute after:-inset-1",
        "icon-xs":
          "relative size-6 after:absolute after:-inset-2 [&_svg:not([class*='size-'])]:size-3",
        // The tall, wide call to action — "Save settings", "Add photos".
        lg: "min-h-12 gap-2 px-8 text-sm uppercase tracking-widest",
        sm: "min-h-11 gap-1.5 px-3 text-xs uppercase tracking-widest",
        // Dense toolbars, where a 44px target would not fit. Use sparingly.
        xs: "min-h-9 gap-1.5 px-2 text-xs uppercase tracking-widest",
      },
      stacked: {
        false: "",
        true: "w-full flex-col justify-center gap-1.5 text-xs",
      },
      /**
       * Danger is a tone, not a variant.
       *
       * The old code proved it: "delete" buttons appeared as an outlined red,
       * a red text button, and a neutral icon that reddens on hover — three
       * shapes, one meaning. Crossing tone with variant says that once.
       */
      tone: {
        /**
         * A toggle whose "on" state is worth seeing across a grid — today the
         * homepage-slideshow star. It colours from `aria-pressed`, which the
         * button must already carry for screen readers, so the state is stated
         * once instead of once for assistive tech and again in a ternary.
         */
        accent: "aria-pressed:text-btn-accent-fg",
        danger: "",
        default: "",
        /** The board is published: its link and globe say so in green. */
        live: "text-emerald-500 hover:text-emerald-400",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-btn-solid-hover-bg",
        ghost:
          "text-btn-fg hover:bg-btn-ghost-hover-bg hover:text-btn-fg-strong aria-expanded:bg-btn-ghost-hover-bg aria-expanded:text-btn-fg-strong",
        /** The board editor's header: ink on the paper, pressed when on. */
        header:
          "text-board-ink/70 hover:text-board-ink aria-pressed:bg-board-ink/10 aria-pressed:text-board-ink",
        link: "text-btn-fg underline-offset-4 hover:text-btn-fg-strong hover:underline",
        noborder:
          "text-btn-fg hover:bg-btn-ghost-hover-bg hover:text-btn-fg-strong aria-expanded:bg-btn-ghost-hover-bg aria-expanded:text-btn-fg-strong",
        outline:
          "border-btn-border text-btn-fg hover:bg-btn-hover-bg hover:text-btn-hover-fg aria-expanded:bg-btn-ghost-hover-bg aria-expanded:text-btn-fg-strong",
        // A pressed/selected toggle, e.g. the board's stacked-view switch.
        selected:
          "border-btn-selected-border bg-btn-selected-bg text-btn-fg-strong hover:bg-btn-hover-bg hover:text-btn-hover-fg",
      },
    },
  }
);

function Button({
  className,
  variant,
  size,
  stacked,
  tone,
  fullWidth,
  fullWidthLeft,
  ...props
}: Omit<ButtonPrimitive.Props, "size"> & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(
        buttonVariants({
          className,
          fullWidth,
          fullWidthLeft,
          size,
          stacked,
          tone,
          variant,
        })
      )}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
