/**
 * Calorie estimation for running using MET (Metabolic Equivalent of Task) values.
 *
 * MET values by running speed (from Compendium of Physical Activities):
 *   4.0 km/h (walk)   → MET 3.0
 *   6.4 km/h (jog)    → MET 6.0
 *   8.0 km/h          → MET 8.3
 *  10.0 km/h          → MET 10.0
 *  12.0 km/h          → MET 11.8
 *  14.0 km/h          → MET 13.5
 *  16.0 km/h+         → MET 15.0
 *
 * Formula: calories = MET × weight_kg × duration_hours
 */

const MET_TABLE: [number, number][] = [
  [4.0, 3.0],
  [6.4, 6.0],
  [8.0, 8.3],
  [10.0, 10.0],
  [12.0, 11.8],
  [14.0, 13.5],
  [16.0, 15.0],
];

function getMET(speedKmh: number): number {
  if (speedKmh <= MET_TABLE[0][0]) return MET_TABLE[0][1];
  if (speedKmh >= MET_TABLE[MET_TABLE.length - 1][0]) return MET_TABLE[MET_TABLE.length - 1][1];

  // Linear interpolation between closest entries
  for (let i = 1; i < MET_TABLE.length; i++) {
    const [s1, m1] = MET_TABLE[i - 1];
    const [s2, m2] = MET_TABLE[i];
    if (speedKmh <= s2) {
      const ratio = (speedKmh - s1) / (s2 - s1);
      return m1 + ratio * (m2 - m1);
    }
  }

  return 10.0; // fallback
}

/**
 * Estimate calories burned during a run.
 * @param distanceMeters - Total distance in meters
 * @param durationSeconds - Total duration in seconds
 * @param weightKg - User weight in kg (default 70)
 * @returns Estimated calories burned (kcal)
 */
export function estimateCalories(
  distanceMeters: number,
  durationSeconds: number,
  weightKg: number = 70,
): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;

  const speedKmh = (distanceMeters / 1000) / (durationSeconds / 3600);
  const met = getMET(speedKmh);
  const durationHours = durationSeconds / 3600;

  return Math.round(met * weightKg * durationHours);
}

export const DEFAULT_WEIGHT_KG = 70;
