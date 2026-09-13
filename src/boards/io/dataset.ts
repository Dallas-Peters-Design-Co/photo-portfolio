import {
  apiBase,
  boardUrl,
  jsonHeaders,
  readPageError,
} from "../../services/portfolioService";

/**
 * Turning a board, or one frame of it, into a training set.
 *
 * Its own module rather than another method on `boardsApi`: portfolioService.ts
 * is one of the two files this project has already declared too long to grow,
 * and this belongs beside the other board-to-elsewhere transports in
 * `src/boards/io` — Affinity, Google Drive, copy-to-board — rather than in the
 * general service.
 */

export interface Dataset {
  /** How many images made it into the archive. */
  count: number;
  /** Named as fal names it, so it pastes straight into the trainer. */
  images_data_url: string;
  /** Images that were found but could not be read or were too large. */
  skipped: number;
}

/**
 * Packs images into one zip at a public URL, ready for fal's LoRA trainer.
 *
 * `itemId` names a frame and takes what is sitting on it; omitted, it takes the
 * whole board. The archive is built on the server because the pictures are
 * already in our own storage — pulling sixty of them into the browser only to
 * post them back up would be the slow way round. See
 * api/boards/[id]/dataset.ts.
 */
export const buildDataset = async (
  boardId: string,
  itemId?: string
): Promise<Dataset> => {
  const res = await fetch(`${boardUrl(boardId)}/dataset`, {
    body: JSON.stringify(itemId ? { itemId } : {}),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not build the dataset"));
  }
  return (await res.json()) as Dataset;
};

/** A style whose training has been accepted, as the models table now holds it. */
export interface TrainingStarted {
  id: string;
  label: string;
  lora: { trigger: string | null } | null;
}

/*
 * Told, not discovered.
 *
 * The watch only polls while it believes something is training, and it finds
 * that out by asking. A training started *after* its last answer of "nothing"
 * was invisible to it until the screen remounted — which is how a style
 * trained from a board could finish on fal with nobody collecting it and no
 * sign on the board that anything was happening. So starting a training says
 * so, here, and every watch on the page wakes up.
 */
const TRAINING_STARTED = "boards:training-started";

export const announceTrainingStarted = (started: TrainingStarted): void => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<TrainingStarted>(TRAINING_STARTED, { detail: started })
    );
  }
};

export const onTrainingStarted = (
  listener: (started: TrainingStarted) => void
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const handler = (event: Event) => {
    listener((event as CustomEvent<TrainingStarted>).detail);
  };
  window.addEventListener(TRAINING_STARTED, handler);
  return () => window.removeEventListener(TRAINING_STARTED, handler);
};

/**
 * Hands a built dataset to fal's trainer and returns the model row it made.
 *
 * Two calls rather than one — `buildDataset` then this — because the archive
 * is worth having on its own: it is what makes a training reproducible, and
 * what somebody pastes into fal by hand if they would rather drive it there.
 *
 * Answers as soon as fal accepts the job, not when the training ends. The run
 * runs for minutes, well past a function's ceiling; `pollTraining` finishes
 * it.
 */
export const startTraining = async (
  datasetUrl: string,
  name: string
): Promise<TrainingStarted> => {
  const res = await fetch(`${apiBase()}/api/models/train`, {
    body: JSON.stringify({ datasetUrl, name }),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not start the training"));
  }
  const started = (await res.json()) as TrainingStarted;
  announceTrainingStarted(started);
  return started;
};

/**
 * Advances every training fal has finished, and says how many are still going.
 *
 * Safe to call as often as wanted: the endpoint is idempotent, so a second
 * caller cannot turn one training into two models.
 */
/** A run fal has accepted and not yet finished. */
export interface TrainingPending {
  id: string;
  label: string;
  /** ISO time the job was handed to fal, for "going for four minutes". */
  startedAt: string | null;
}

export interface TrainingPoll {
  finished: TrainingStarted[];
  pending: TrainingPending[];
  training: number;
}

export const pollTraining = async (): Promise<TrainingPoll> => {
  const res = await fetch(`${apiBase()}/api/models/training`, {
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not check the training"));
  }
  return (await res.json()) as TrainingPoll;
};
