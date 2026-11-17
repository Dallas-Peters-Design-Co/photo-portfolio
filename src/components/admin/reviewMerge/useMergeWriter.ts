import { useEffect, useRef, useState } from "react";
import type { MergeWriteup } from "../../../../config/brandMerge.js";
import { reviewsApi } from "../../../services/reviewService";

/**
 * The agent writing a brand merge writeup: started, then checked every few
 * seconds until it's done or stops. It takes minutes; the editor can be used
 * meanwhile, and the result lands in the merge when it arrives.
 */

const POLL_MS = 4000;

type Writeup = MergeWriteup;

export type WriterState =
  | { state: "idle" }
  | { phase: string; state: "running" }
  | { error: string; state: "failed" };

export const useMergeWriter = (onWritten: (writeup: Writeup) => void) => {
  const [status, setStatus] = useState<WriterState>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const written = useRef(onWritten);
  written.current = onWritten;

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const poll = (session: string, options: string[]) => {
    timer.current = setTimeout(async () => {
      try {
        const at = await reviewsApi.mergeStatus(session, options);
        if (at.state === "running") {
          setStatus(at);
          poll(session, options);
          return;
        }
        if (at.state === "failed") {
          setStatus(at);
          return;
        }
        written.current(at.writeup);
        setStatus({ state: "idle" });
      } catch (err) {
        setStatus({
          error: err instanceof Error ? err.message : "The agent stopped.",
          state: "failed",
        });
      }
    }, POLL_MS);
  };

  const start = async (input: {
    brandA: string;
    brandB: string;
    options: string[];
  }) => {
    setStatus({ phase: "Starting the agent…", state: "running" });
    try {
      const { session } = await reviewsApi.mergeStart(input);
      poll(session, input.options);
    } catch (err) {
      setStatus({
        error: err instanceof Error ? err.message : "Couldn't start the agent.",
        state: "failed",
      });
    }
  };

  return { start, status };
};
