import { createContext, useContext } from "react";
import type { ColorVar } from "./colorVars";

export interface ColorVarsValue {
  add: (value: string, name?: string) => ColorVar | null;
  /** Several at once (a brand's palette), skipping colours already kept. */
  addAll: (list: { name: string; value: string }[]) => void;
  close: () => void;
  open: () => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  /** Changes the variable, and its colour everywhere on the board. */
  setValue: (id: string, value: string) => void;
  vars: ColorVar[];
}

export const ColorVarsContext = createContext<ColorVarsValue | null>(null);

/** The board's colour variables, or null where there's no board. */
export const useColorVars = (): ColorVarsValue | null =>
  useContext(ColorVarsContext);
