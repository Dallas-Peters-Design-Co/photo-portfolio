import { rememberComponents } from "../boards/components/store";
import type { Board } from "../types";

/**
 * A save refused because the board was saved elsewhere (another tab or
 * window) after this copy loaded it. Saving anyway would put the older
 * arrangement back over the newer one; see useBoardVersion.
 */
export class StaleBoardError extends Error {}

/** A board save's answer: the board, StaleBoardError (409), or an Error. */
export const readBoardSave = async (
  res: Response,
  readError: (res: Response, fallback: string) => Promise<string>
): Promise<Board> => {
  if (res.status === 409) {
    throw new StaleBoardError(
      await readError(res, "This board changed elsewhere")
    );
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Could not save board"));
  }
  return (await res.json()) as Board;
};

/** A loaded board, its components remembered so its instances can be drawn. */
export const withComponents = (board: Board): Board => {
  rememberComponents(board.components);
  return board;
};
