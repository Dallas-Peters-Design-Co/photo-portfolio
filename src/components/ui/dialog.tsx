import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

/**
 * A dialog over the admin: near-black with a thin ring, defined here rather
 * than at each call site (@shadcn/lint no-restyle). `size` sets how wide it
 * grows; `list` and `form` are capped against the window and scroll inside,
 * so a long one never pushes its own buttons off the screen.
 */
const dialogContentVariants = cva(
  "data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-inset -translate-x-1/2 -translate-y-1/2 gap-4 rounded-surface bg-neutral-950 p-4 text-sm text-white outline-none ring-1 ring-white/10 duration-100 data-closed:animate-out data-open:animate-in",
  {
    defaultVariants: { layout: "default", size: "sm" },
    variants: {
      layout: {
        default: "",
        form: "max-h-dialog overflow-y-auto overflow-x-hidden",
        list: "max-h-dialog-list overflow-hidden",
      },
      size: { lg: "sm:max-w-xl", md: "sm:max-w-md", sm: "sm:max-w-sm" },
    },
  }
);

function DialogContent({
  className,
  children,
  layout,
  showCloseButton = true,
  size,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean;
  }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        className={cn(dialogContentVariants({ layout, size }), className)}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton ? (
          <div className="absolute top-2 right-2">
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button size="icon-sm" variant="ghost" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-surface p-4 text-white sm:flex-row sm:justify-end",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      ) : null}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-light text-sm text-white uppercase leading-snug tracking-micro-widest",
        className
      )}
      data-slot="dialog-title"
      {...props}
    />
  );
}

const dialogDescriptionVariants = cva(
  "text-white/90 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-white",
  {
    defaultVariants: { variant: "body" },
    variants: {
      variant: {
        /** The sentence that says what the dialog is asking. */
        body: "text-micro-md leading-relaxed",
        /** A small-caps line under the title. */
        caption: "text-xs uppercase tracking-widest",
      },
    },
  }
);

function DialogDescription({
  className,
  variant,
  ...props
}: DialogPrimitive.Description.Props &
  VariantProps<typeof dialogDescriptionVariants>) {
  return (
    <DialogPrimitive.Description
      className={cn(dialogDescriptionVariants({ variant }), className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
