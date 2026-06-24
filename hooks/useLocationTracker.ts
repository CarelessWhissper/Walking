import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import {
  calculatePace,
  formatDistance,
  calculateAverageSpeed,
  LocationCoords,
  LocationTrackingOptions,
} from "@/config/locationTracker";
import {
  LOCATION_EVENT,
  SessionSnapshot,
  startBackgroundTracking,
  stopBackgroundTracking,
  isTrackingActive,
  loadSession,
  clearSession,
} from "@/config/backgroundLocation";

interface UseLocationTrackerReturn {
  isTracking: boolean;
  locations: LocationCoords[];
  distance: number;
  elapsedTime: number;
  pace: string;
  formattedDistance: string;
  averageSpeed: number;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  resetTracking: () => void;
}

export const useLocationTracker = (
  options: LocationTrackingOptions = {},
): UseLocationTrackerReturn => {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [locations, setLocations] = useState<LocationCoords[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Derive elapsed seconds from the session start timestamp, so the timer is
  // always correct after a background/resume cycle — it never "resets".
  const tickElapsed = useCallback(() => {
    if (startTimeRef.current) {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    tickElapsed();
    timerRef.current = setInterval(tickElapsed, 1000);
  }, [tickElapsed]);

  const applySnapshot = useCallback((snap: SessionSnapshot) => {
    startTimeRef.current = snap.startTime;
    setLocations(snap.locations);
    setDistance(snap.distance);
  }, []);

  // Subscribe to background location batches. The task keeps accumulating in
  // its own process while minimized; here we mirror it into React state.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      LOCATION_EVENT,
      (snap: SessionSnapshot) => {
        startTimeRef.current = snap.startTime;
        setLocations(snap.locations);
        setDistance(snap.distance);
      },
    );
    return () => sub.remove();
  }, []);

  // On mount, restore an in-progress run (e.g. after the app was killed and
  // relaunched while tracking was active).
  useEffect(() => {
    (async () => {
      const active = await isTrackingActive();
      if (active) {
        const snap = await loadSession();
        if (snap) {
          applySnapshot(snap);
          setIsTracking(true);
          startTimer();
        }
      } else {
        // No live tracking — discard any stale snapshot left behind.
        await clearSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute the timer the instant we return to the foreground, so it snaps
  // to the correct value rather than waiting for the next tick.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && startTimeRef.current) {
        tickElapsed();
      }
    });
    return () => sub.remove();
  }, [tickElapsed]);

  const startTracking = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setLocations([]);
      setDistance(0);
      setElapsedTime(0);

      const start = Date.now();
      const started = await startBackgroundTracking(start, options);

      if (started) {
        startTimeRef.current = start;
        setIsTracking(true);
        startTimer();
      } else {
        setError("Location permission denied");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsTracking(false);
    }
  }, [options, startTimer]);

  const stopTracking = useCallback(async (): Promise<void> => {
    await stopBackgroundTracking();
    setIsTracking(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Keep locations/distance/elapsedTime in React state so the run can still
    // be saved and shared; drop the persisted session so a relaunch doesn't
    // think a run is still active.
    await clearSession();
  }, []);

  const resetTracking = useCallback((): void => {
    setLocations([]);
    setDistance(0);
    setElapsedTime(0);
    startTimeRef.current = null;
  }, []);

  // Clear only the local timer on unmount — background tracking intentionally
  // keeps running so minimizing the app does not stop the run.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const pace = calculatePace(elapsedTime, distance);
  const formattedDistance = formatDistance(distance);
  const averageSpeed = calculateAverageSpeed(distance, elapsedTime);

  return {
    isTracking,
    locations,
    distance,
    elapsedTime,
    pace,
    formattedDistance,
    averageSpeed,
    error,
    startTracking,
    stopTracking,
    resetTracking,
  };
};
