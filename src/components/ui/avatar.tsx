import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import "./avatar.css";

type AvatarProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  src?: string;
  initials: string;
  alt?: string;
};

export function Avatar({
  src,
  initials,
  alt,
  className,
  ...props
}: AvatarProps) {
  return (
    <BaseAvatar.Root
      {...props}
      aria-label={alt || initials || "Avatar"}
      className={cn("ui-avatar", className)}
      role="img"
    >
      {src ? <BaseAvatar.Image alt="" src={src} /> : null}
      <BaseAvatar.Fallback>{initials || "?"}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
