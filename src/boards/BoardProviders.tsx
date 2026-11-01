import type { ReactNode } from "react";
import { ActiveBrandProvider } from "./brand/ActiveBrand";
import { ModelsProvider } from "./ModelsContext";

/** Everything a board's tree reads from context, in one wrapper. */
export function BoardProviders({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  return (
    <ModelsProvider>
      <ActiveBrandProvider boardId={boardId}>{children}</ActiveBrandProvider>
    </ModelsProvider>
  );
}
