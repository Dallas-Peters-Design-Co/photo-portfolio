import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  onTrainingStarted,
  pollTraining,
  type TrainingPending,
} from "../io/dataset";

/**
 * Collects finished trainings, wherever in the admin you happen to be — and
 * says, the whole time, that one is going.
 *
 * A training is started from a board — that is where the frame is — and takes
 * minutes. Nothing holds the job, so something has to come back and collect
 * it, and for a while the only thing that did was the Models panel. So the
 * ordinary path was: train from a board, stay on the board, and the run
 * finished on fal and sat there uncollected. The model never appeared, and
 * there was nothing to suggest that looking at a different screen was what it
 * was waiting for.
 *
 * Mounted by both the board and the admin page instead. The endpoint is
 * idempotent, so two screens open cannot turn one training into two models.
 *
 * Two things this used to get wrong, both fixed here:
 *
 * The watch stopped polling once it heard "nothing training", and a training
 * started after that was invisible to it until the screen remounted. Now
 * `startTraining` announces itself and the watch restarts on the announcement.
 *
 * And there was no sign anything was happening. Between the "Training…" toast
 * that faded after twenty seconds and the model appearing, a board looked
 * exactly like a board where nothing was training. Now a loading toast stays
 * up for as long as anything is, names it, and counts the minutes, and is
 * replaced — not joined — by the success when it lands.
 */

/**
 * How often to ask, once something is known to be training.
 *
 * A run takes minutes, so this is not about being quick. It is about the model
 * arriving within a minute of being ready rather than whenever somebody next
 * reloads.
 */
const POLL_MS = 30_000;

/** One toast for the whole set, updated in place, so it never stacks. */
const TOAST_ID = "training-watch";

export interface TrainingWatch {
  /** What is still going, as of the last check. */
  pending: readonly TrainingPending[];
  /** How many runs are still going, as of the last check. */
  training: number;
}

const minutesSince = (iso: string | null): number | null => {
  if (!iso) {
    return null;
  }
  const started = new Date(iso).getTime();
  return Number.isFinite(started)
    ? Math.max(0, Math.round((Date.now() - started) / 60_000))
    : null;
};

const describe = (pending: readonly TrainingPending[]): string => {
  if (pending.length === 1) {
    const [one] = pending;
    const minutes = minutesSince(one.startedAt);
    const age =
      minutes === null
        ? ""
        : minutes < 1
          ? " · just started"
          : ` · ${minutes} min`;
    return `Training “${one.label}”${age}`;
  }
  return `Training ${pending.length} styles`;
};

const showPending = (pending: readonly TrainingPending[]): void => {
  if (pending.length === 0) {
    toast.dismiss(TOAST_ID);
    return;
  }
  toast.loading(describe(pending), {
    description: "Usually a few minutes. It lands in Models when fal is done.",
    duration: Number.POSITIVE_INFINITY,
    id: TOAST_ID,
  });
};

/**
 * Watches for finished trainings and announces them.
 *
 * @param enabled Whether to watch at all. False on a published board, where
 *   there is no admin to tell and the endpoint would refuse the request.
 * @param onFinished Called when a run lands, so a screen showing models can
 *   refresh itself.
 */
export const useTrainingWatch = (
  enabled: boolean,
  onFinished?: () => void
): TrainingWatch => {
  const [pending, setPending] = useState<readonly TrainingPending[]>([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const check = async () => {
      try {
        const result = await pollTraining();
        if (!alive) {
          return;
        }
        setPending(result.pending);
        showPending(result.pending);
        if (result.finished.length > 0) {
          toast.success(
            result.finished.length === 1
              ? `“${result.finished[0].label}” is trained and ready to use.`
              : `${result.finished.length} styles are trained and ready.`,
            {
              description: "Pick it as the model on a Generate node.",
              duration: 15_000,
              // Same id as the loading toast: the success *replaces* the
              // "training…" rather than sitting under it.
              id: TOAST_ID,
            }
          );
          onFinished?.();
        }
        // Only keep asking while there is something to ask about. One check
        // per screen visit is cheap; a timer running forever on a board with
        // nothing training is a request every thirty seconds for no reason.
        if (result.training === 0) {
          stop();
        }
      } catch {
        // A failed check is not a failed training, and nothing can be done
        // about it from here. The next tick tries again; saying so every
        // thirty seconds would be noise about somebody else's outage.
      }
    };

    const start = () => {
      stop();
      void check();
      timer = setInterval(() => void check(), POLL_MS);
    };

    start();

    // A training begun on this screen, after the watch had already gone
    // quiet: show it at once, then start asking again.
    const unsubscribe = onTrainingStarted((started) => {
      if (!alive) {
        return;
      }
      setPending((current) =>
        current.some((p) => p.id === started.id)
          ? current
          : [
              ...current,
              {
                id: started.id,
                label: started.label,
                startedAt: new Date().toISOString(),
              },
            ]
      );
      showPending([
        { id: started.id, label: started.label, startedAt: null },
      ]);
      start();
    });

    return () => {
      alive = false;
      unsubscribe();
      stop();
      // Somebody else may still be watching; the toast is theirs now. Only a
      // screen that is the last to leave takes it down, and there is no cheap
      // way to know that, so leaving it is the safer error: a stale "training"
      // toast is dismissable, a missing one is the bug this fixes.
    };
  }, [enabled, onFinished]);

  return { pending, training: pending.length };
};
