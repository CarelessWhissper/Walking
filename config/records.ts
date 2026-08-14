import { SavedRun } from "./runs";

export interface Records {
  longestDistance: number; // meters
  longestDuration: number; // seconds
  fastest1k: number | null; // seconds
  fastest5k: number | null; // seconds
  fastest10k: number | null; // seconds
}

const EMPTY: Records = {
  longestDistance: 0,
  longestDuration: 0,
  fastest1k: null,
  fastest5k: null,
  fastest10k: null,
};

/**
 * Fastest contiguous window of `k` kilometers in a single run's splits.
 * Returns null if the run is shorter than `k` km.
 */
export function bestWindow(splits: number[] | undefined, k: number): number | null {
  if (!splits || splits.length < k) return null;
  let best = Infinity;
  let sum = 0;
  for (let i = 0; i < splits.length; i++) {
    sum += splits[i];
    if (i >= k) sum -= splits[i - k];
    if (i >= k - 1) best = Math.min(best, sum);
  }
  return isFinite(best) ? best : null;
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

export function computeRecords(runs: SavedRun[]): Records {
  return runs.reduce<Records>((acc, run) => {
    return {
      longestDistance: Math.max(acc.longestDistance, run.distance || 0),
      longestDuration: Math.max(acc.longestDuration, run.duration || 0),
      fastest1k: minDefined(acc.fastest1k, bestWindow(run.splits, 1)),
      fastest5k: minDefined(acc.fastest5k, bestWindow(run.splits, 5)),
      fastest10k: minDefined(acc.fastest10k, bestWindow(run.splits, 10)),
    };
  }, EMPTY);
}

export interface PRDetail {
  label: string;
  kind: "distance" | "duration";
  value: number;
  /** The record this run beat, or null when it's the first of its kind. */
  previous: number | null;
}

/**
 * Compare a freshly finished run against the records set by all prior runs and
 * return details (new value + beaten value) for any new personal records.
 */
export function detectPRDetails(
  newRun: SavedRun,
  priorRuns: SavedRun[],
): PRDetail[] {
  const prior = computeRecords(priorRuns);
  const prs: PRDetail[] = [];

  if ((newRun.distance || 0) > prior.longestDistance) {
    prs.push({
      label: "Longest run",
      kind: "distance",
      value: newRun.distance || 0,
      previous: prior.longestDistance > 0 ? prior.longestDistance : null,
    });
  }
  if ((newRun.duration || 0) > prior.longestDuration) {
    prs.push({
      label: "Longest duration",
      kind: "duration",
      value: newRun.duration || 0,
      previous: prior.longestDuration > 0 ? prior.longestDuration : null,
    });
  }

  const beats = (
    value: number | null,
    record: number | null,
    label: string,
  ) => {
    if (value != null && (record == null || value < record)) {
      prs.push({ label, kind: "duration", value, previous: record });
    }
  };
  beats(bestWindow(newRun.splits, 1), prior.fastest1k, "Fastest 1K");
  beats(bestWindow(newRun.splits, 5), prior.fastest5k, "Fastest 5K");
  beats(bestWindow(newRun.splits, 10), prior.fastest10k, "Fastest 10K");

  return prs;
}

/** Labels-only variant of detectPRDetails. */
export function detectPRs(newRun: SavedRun, priorRuns: SavedRun[]): string[] {
  return detectPRDetails(newRun, priorRuns).map((p) => p.label);
}
