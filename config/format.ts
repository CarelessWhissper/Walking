import AsyncStorage from "@react-native-async-storage/async-storage";

export type DistanceUnit = "km" | "mi";

export const METERS_PER_MILE = 1609.344;

export async function loadDistanceUnit(): Promise<DistanceUnit> {
  try {
    const saved = await AsyncStorage.getItem("distanceUnit");
    return saved === "mi" ? "mi" : "km";
  } catch {
    return "km";
  }
}

/** "412 m" / "4.62 km", or "0.26 mi" / "4.62 mi". */
export function formatDistanceIn(meters: number, unit: DistanceUnit): string {
  if (unit === "mi") {
    return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Bare numeric distance value ("4.62") in the given unit, for layouts that render the unit separately. */
export function distanceValueIn(meters: number, unit: DistanceUnit): string {
  const value = unit === "mi" ? meters / METERS_PER_MILE : meters / 1000;
  return value.toFixed(2);
}

export function distanceUnitLabel(unit: DistanceUnit): string {
  return unit;
}

export function paceUnitLabel(unit: DistanceUnit): string {
  return unit === "mi" ? "/mi" : "/km";
}

/** Pace ("5:16") per km or per mile from raw duration and distance. */
export function formatPaceIn(
  seconds: number,
  meters: number,
  unit: DistanceUnit,
): string {
  if (meters <= 0 || seconds <= 0) return "0:00";
  const perUnit = unit === "mi" ? meters / METERS_PER_MILE : meters / 1000;
  const minutes = seconds / 60 / perUnit;
  if (!isFinite(minutes)) return "0:00";
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Average speed value in km/h or mph. */
export function speedValueIn(
  meters: number,
  seconds: number,
  unit: DistanceUnit,
): number {
  if (seconds <= 0) return 0;
  const dist = unit === "mi" ? meters / METERS_PER_MILE : meters / 1000;
  return Number((dist / (seconds / 3600)).toFixed(1));
}

export function speedUnitLabel(unit: DistanceUnit): string {
  return unit === "mi" ? "mph" : "km/h";
}
