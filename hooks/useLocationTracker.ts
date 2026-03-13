import { useState, useEffect, useCallback, useRef } from "react";
import {
  startLocationTracking,
  stopLocationTracking,
  calculateDistance,
  calculatePace,
  formatDistance,
  calculateAverageSpeed,
  LocationCoords,
  LocationTrackingOptions,
  calculateTotalDistance,
  calculateAccurateDistance,
  smoothLocations,
} from "@/config/locationTracker";
import { LocationObject } from "expo-location";
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

  // Handle location updates from the tracker
  const handleLocationUpdate = useCallback((newLocation: LocationObject) => {
    setLocations((prev) => {
      const newCoords: LocationCoords = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
        altitude: newLocation.coords.altitude,
        accuracy: newLocation.coords.accuracy,
        altitudeAccuracy: newLocation.coords.altitudeAccuracy,
        heading: newLocation.coords.heading,
        speed: newLocation.coords.speed,
        lat: newLocation.coords.latitude,
        lng: newLocation.coords.longitude,
        lon: newLocation.coords.longitude,
      };

      const updatedLocations = [...prev, newCoords];

      // Use smoothed locations for distance calculation
      if (updatedLocations.length > 5) {
        const smoothed = smoothLocations(updatedLocations, 3);
        const accurateDist = calculateAccurateDistance(smoothed, 15);
        setDistance(accurateDist);
      } else if (updatedLocations.length > 1) {
        const totalDist = calculateTotalDistance(updatedLocations);
        setDistance(totalDist);
      }

      return updatedLocations;
    });
  }, []);

  const startTracking = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setLocations([]);
      setDistance(0);
      setElapsedTime(0);

      const subscription = await startLocationTracking(
        handleLocationUpdate,
        options,
      );

      if (subscription) {
        setIsTracking(true);
        startTimeRef.current = Date.now();

        // Start timer
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            setElapsedTime(
              Math.floor((Date.now() - startTimeRef.current) / 1000),
            );
          }
        }, 1000);
      } else {
        setError("Failed to start location tracking");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsTracking(false);
    }
  }, [handleLocationUpdate, options]);

  const stopTracking = useCallback(async (): Promise<void> => {
    await stopLocationTracking();
    setIsTracking(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTracking = useCallback((): void => {
    setLocations([]);
    setDistance(0);
    setElapsedTime(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopLocationTracking();
    };
  }, []);

  // Calculate derived values
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
