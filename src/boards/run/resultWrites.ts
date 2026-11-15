/** A tool can show its output while its separate history save is still pending. */
const pending = new Map<string, Set<Promise<unknown>>>();

export const keepResultWrite = async <T>(
  boardId: string,
  itemId: string,
  write: Promise<T>
): Promise<T> => {
  const key = `${boardId}:${itemId}`;
  const writes = pending.get(key) ?? new Set<Promise<unknown>>();
  writes.add(write);
  pending.set(key, writes);
  try {
    return await write;
  } finally {
    writes.delete(write);
    if (writes.size === 0) {
      pending.delete(key);
    }
  }
};

/** A newly shown image must be saved before its removal can be persisted. */
export const waitForResultWrites = async (
  boardId: string,
  itemId: string
): Promise<void> => {
  await Promise.allSettled(pending.get(`${boardId}:${itemId}`) ?? []);
};
