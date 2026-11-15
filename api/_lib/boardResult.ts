import type { VercelResponse } from "@vercel/node";
import type { getSql } from "./db.js";

type Sql = ReturnType<typeof getSql>;
type Result = Record<string, unknown> | null;

export class BoardResultError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Sends a BoardResultError with its own status, anything else as a 500. */
export const sendBoardResultError = (
  res: VercelResponse,
  error: unknown,
  fallback: string
) =>
  res
    .status(error instanceof BoardResultError ? error.status : 500)
    .json({ error: error instanceof Error ? error.message : fallback });

/** One write plus eight retries against the latest history. */
const MAX_ATTEMPTS = 9;

/** Rebuild against the latest history if another result write won the race. */
export const updateBoardResult = async (
  sql: Sql,
  boardId: string,
  itemId: string,
  update: (previous: Result) => Result,
  succeeded = false
): Promise<Result> => {
  // Each attempt depends on the one before it, so retries recurse rather
  // than loop: the reads and writes must stay strictly sequential.
  const attempt = async (remaining: number): Promise<Result> => {
    if (remaining === 0) {
      throw new Error("The image history changed. Please try again.");
    }
    const [row] = (await sql`
      SELECT result FROM board_items
      WHERE id = ${itemId} AND board_id = ${boardId}
    `) as { result: Result }[];
    if (!row) {
      throw new BoardResultError("Item not found on this board", 404);
    }
    const previous = row.result;
    const result = update(previous);
    const written = await sql`
      UPDATE board_items
      SET result = ${result === null ? null : JSON.stringify(result)}::jsonb,
          run_state = CASE WHEN ${succeeded} THEN 'succeeded' ELSE run_state END,
          run_error = CASE WHEN ${succeeded} THEN NULL ELSE run_error END
      WHERE id = ${itemId} AND board_id = ${boardId}
        AND result IS NOT DISTINCT FROM ${previous === null ? null : JSON.stringify(previous)}::jsonb
      RETURNING id
    `;
    if (written.length > 0) {
      return result;
    }
    return attempt(remaining - 1);
  };
  return await attempt(MAX_ATTEMPTS);
};
