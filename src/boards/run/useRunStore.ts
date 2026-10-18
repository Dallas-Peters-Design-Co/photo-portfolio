import { useSyncExternalStore } from "react";
import { runStore } from "./runStore";

/** Whether anything is running on this board, live. */
export const useBoardIsRunning = (boardId: string): boolean => {
  useSyncExternalStore(runStore.subscribe, runStore.version);
  return runStore.isRunning(boardId);
};

/** The ids of every board with a run in flight, live. */
export const useRunningBoards = (): ReadonlySet<string> => {
  useSyncExternalStore(runStore.subscribe, runStore.version);
  return new Set(runStore.runningBoards());
};
