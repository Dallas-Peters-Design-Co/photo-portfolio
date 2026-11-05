import type { ReactNode } from "react";
import { ActiveBrandProvider } from "./brand/ActiveBrand";
import {
  type ColorVarsDoc,
  ColorVarsProvider,
} from "./colorVars/ColorVarsContext";
import { ModelsProvider } from "./ModelsContext";

/** Everything a board's tree reads from context, in one wrapper. */
export function BoardProviders({
  boardId,
  children,
  colours,
}: {
  boardId: string;
  children: ReactNode;
  /** The board's colour variables, where the board can be edited. */
  colours?: ColorVarsDoc;
}) {
  return (
    <ModelsProvider>
      <ActiveBrandProvider boardId={boardId}>
        {colours ? (
          <ColorVarsProvider doc={colours}>{children}</ColorVarsProvider>
        ) : (
          children
        )}
      </ActiveBrandProvider>
    </ModelsProvider>
  );
}
