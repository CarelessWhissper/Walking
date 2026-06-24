import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface SavedRun {
  id: string;
  date: string; // ISO timestamp
  distance: number; // meters
  duration: number; // seconds
  pace: string; // formatted m:ss per km
  calories?: number;
  cadence?: number;
  stepCount?: number;
  notes?: string;
  splits?: number[]; // seconds per kilometer
  locations?: RoutePoint[]; // downsampled route
}

export const RUNS_KEY = "runs";

export async function loadRuns(): Promise<SavedRun[]> {
  try {
    const raw = await AsyncStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRuns(runs: SavedRun[]): Promise<void> {
  await AsyncStorage.setItem(RUNS_KEY, JSON.stringify(runs));
}

export async function getRun(id: string): Promise<SavedRun | null> {
  const runs = await loadRuns();
  return runs.find((r) => r.id === id) ?? null;
}
