import { SavedRun } from "./runs";

/** Local YYYY-MM-DD key for a date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Set of local day keys on which at least one run was recorded. */
export function runDayKeys(runs: SavedRun[]): Set<string> {
  const set = new Set<string>();
  for (const r of runs) {
    const d = new Date(r.date);
    if (!isNaN(d.getTime())) set.add(dayKey(d));
  }
  return set;
}

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * Current streak counts back from today (or yesterday, if you haven't run yet
 * today) over consecutive days with a run. Longest streak scans all run days.
 */
export function computeStreaks(runs: SavedRun[]): Streaks {
  const days = runDayKeys(runs);
  if (days.size === 0) return { current: 0, longest: 0 };

  // Current streak
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) {
    // Allow the streak to remain "alive" if you ran yesterday but not yet today.
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) {
      // Neither today nor yesterday — current streak is 0.
      return { current: 0, longest: computeLongest(days) };
    }
  }
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest: computeLongest(days) };
}

function computeLongest(days: Set<string>): number {
  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev) {
      const diffDays = Math.round(
        (date.getTime() - prev.getTime()) / 86400000,
      );
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }
  return longest;
}

export interface HeatCell {
  key: string; // YYYY-MM-DD
  date: Date;
  count: number; // runs that day
  distance: number; // total meters that day
}

/**
 * Build a GitHub-style heatmap grid: an array of week columns (oldest first),
 * each a 7-element array indexed Sun..Sat, covering the last `weeks` weeks
 * ending with the current week.
 */
export function buildHeatmap(runs: SavedRun[], weeks: number = 16): HeatCell[][] {
  const byDay = new Map<string, { count: number; distance: number }>();
  for (const r of runs) {
    const d = new Date(r.date);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    const entry = byDay.get(k) ?? { count: 0, distance: 0 };
    entry.count += 1;
    entry.distance += r.distance || 0;
    byDay.set(k, entry);
  }

  // Start from the Sunday of the week `weeks-1` weeks ago.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);

  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + day);
      const k = dayKey(date);
      const entry = byDay.get(k);
      col.push({
        key: k,
        date,
        count: entry?.count ?? 0,
        distance: entry?.distance ?? 0,
      });
    }
    grid.push(col);
  }
  return grid;
}
