import * as Location from "expo-location";
import {
  LocationSubscription,
  LocationObject,
  LocationAccuracy,
} from "expo-location";

// Types
export interface LocationCoords {
  lat: number;
  lng: number;
  lon: number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationTrackingOptions {
  timeInterval?: number;
  distanceInterval?: number;
  accuracy?: LocationAccuracy;
}

export type LocationUpdateCallback = (location: LocationObject) => void;

// Track active listeners
let locationSubscription: LocationSubscription | null = null;

/**
 * Request location permissions
 * @returns {Promise<boolean>} - Whether permission was granted
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

/**
 * Start tracking location
 * @param onLocationUpdate - Callback for each location update
 * @param options - Configuration options
 * @returns Subscription object or null if failed
 */
export async function startLocationTracking(
  onLocationUpdate: LocationUpdateCallback,
  options: LocationTrackingOptions = {},
): Promise<LocationSubscription | null> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    console.log("Location permission denied");
    return null;
  }

  // Stop any existing tracking
  await stopLocationTracking();

  // Start watching position
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: options.accuracy || LocationAccuracy.High,
      timeInterval: options.timeInterval || 1000,
      distanceInterval: options.distanceInterval || 5,
    },
    (newLocation: LocationObject) => {
      onLocationUpdate(newLocation);
    },
  );

  return locationSubscription;
}

/**
 * Stop location tracking
 */
export async function stopLocationTracking(): Promise<void> {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((R * c).toFixed(2)); // distance in meters, rounded to 2 decimals
}

/**
 * Calculate total distance from an array of locations
 * @param locations - Array of location objects with latitude/longitude
 * @returns Total distance in meters
 */
export function calculateTotalDistance(locations: LocationCoords[]): number {
  if (!locations || locations.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];

    // Handle different property naming conventions
    const lat1 = prev.latitude ?? prev.lat;
    const lon1 = prev.longitude ?? prev.lng ?? prev.lon;
    const lat2 = curr.latitude ?? curr.lat;
    const lon2 = curr.longitude ?? curr.lng ?? curr.lon;

    // Skip if any coordinates are missing
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      console.warn("Skipping location pair due to missing coordinates");
      continue;
    }

    totalDistance += calculateDistance(lat1, lon1, lat2, lon2);
  }
  return Number(totalDistance.toFixed(2));
}

/**
 * NEW: Smooth location data using moving average
 * @param locations - Array of locations
 * @param windowSize - Number of points to average (default: 3)
 * @returns Smoothed locations
 */
export function smoothLocations(
  locations: LocationCoords[],
  windowSize: number = 3
): LocationCoords[] {
  if (locations.length < windowSize) return locations;

  const smoothed: LocationCoords[] = [];
  
  for (let i = 0; i < locations.length; i++) {
    // Keep first and last few points as-is
    if (i < Math.floor(windowSize / 2) || i >= locations.length - Math.floor(windowSize / 2)) {
      smoothed.push(locations[i]);
      continue;
    }

    let sumLat = 0;
    let sumLon = 0;
    let sumAlt = 0;
    let count = 0;

    for (let j = i - Math.floor(windowSize / 2); j <= i + Math.floor(windowSize / 2); j++) {
      sumLat += locations[j].latitude;
      sumLon += locations[j].longitude;
      if (locations[j].altitude) sumAlt += locations[j].altitude || 0;
      count++;
    }

    smoothed.push({
      ...locations[i],
      latitude: sumLat / count,
      longitude: sumLon / count,
      altitude: sumAlt > 0 ? sumAlt / count : locations[i].altitude,
    });
  }

  return smoothed;
}

/**
 * NEW: Calculate distance with minimum accuracy threshold
 * @param locations - Array of locations
 * @param minAccuracy - Minimum accuracy in meters (lower is better)
 * @returns Filtered total distance
 */
export function calculateAccurateDistance(
  locations: LocationCoords[],
  minAccuracy: number = 20
): number {
  if (!locations || locations.length < 2) return 0;

  // Filter locations by accuracy
  const validLocations = locations.filter(
    loc => loc.accuracy !== null && loc.accuracy !== undefined && loc.accuracy <= minAccuracy
  );

  if (validLocations.length < 2) return 0;

  return calculateTotalDistance(validLocations);
}

/**
 * NEW: Calculate current GPS accuracy status
 * @param accuracy - Current location accuracy in meters
 * @returns Accuracy status and color
 */
export function getAccuracyStatus(accuracy: number | null | undefined): {
  status: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  color: string;
} {
  if (!accuracy) return { status: 'Poor', color: '#E74C3C' };
  
  if (accuracy <= 5) return { status: 'Excellent', color: '#2ECC71' };
  if (accuracy <= 10) return { status: 'Good', color: '#27AE60' };
  if (accuracy <= 20) return { status: 'Fair', color: '#F39C12' };
  return { status: 'Poor', color: '#E74C3C' };
}

/**
 * NEW: Calculate current pace from speed
 * @param speedMps - Speed in meters per second
 * @returns Formatted pace (min/km)
 */
export function calculateCurrentPace(speedMps: number | null | undefined): string {
  if (!speedMps || speedMps <= 0) return '0:00';
  
  const speedKmh = speedMps * 3.6;
  if (speedKmh <= 0) return '0:00';
  
  const minPerKm = 60 / speedKmh;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  
  // Cap at reasonable values
  if (mins > 30) return '0:00';
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * NEW: Detect if user is moving
 * @param locations - Array of locations
 * @param thresholdMps - Speed threshold in m/s (default: 0.5 m/s ≈ 1.8 km/h)
 * @returns Boolean indicating if moving
 */
export function isMoving(
  locations: LocationCoords[],
  thresholdMps: number = 0.5
): boolean {
  if (locations.length < 2) return false;
  
  const lastLoc = locations[locations.length - 1];
  if (lastLoc.speed && lastLoc.speed > thresholdMps) return true;
  
  // Alternative: check distance over recent time
  const recentLocs = locations.slice(-5);
  if (recentLocs.length < 2) return false;
  
  const first = recentLocs[0];
  const last = recentLocs[recentLocs.length - 1];
  const distance = calculateDistance(
    first.latitude, first.longitude,
    last.latitude, last.longitude
  );
  
  // If moved more than 5 meters in recent points, consider moving
  return distance > 5;
}

/**
 * NEW: Calculate distance with speed filtering
 * @param locations - Array of locations
 * @param minSpeedMps - Minimum speed to consider (helps filter stationary noise)
 * @returns Filtered distance
 */
export function calculateMovingDistance(
  locations: LocationCoords[],
  minSpeedMps: number = 0.5
): number {
  if (!locations || locations.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    
    // Skip if current point has low speed (likely stationary noise)
    if (curr.speed && curr.speed < minSpeedMps) continue;
    
    const lat1 = prev.latitude ?? prev.lat;
    const lon1 = prev.longitude ?? prev.lng ?? prev.lon;
    const lat2 = curr.latitude ?? curr.lat;
    const lon2 = curr.longitude ?? curr.lng ?? curr.lon;

    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) continue;
    
    totalDistance += calculateDistance(lat1, lon1, lat2, lon2);
  }
  return Number(totalDistance.toFixed(2));
}

// ... rest of your existing functions remain the same ...

/**
 * Format distance for display
 * @param meters - Distance in meters
 * @param unit - 'metric' or 'imperial'
 * @returns Formatted distance
 */
export function formatDistance(
  meters: number,
  unit: "metric" | "imperial" = "metric",
): string {
  if (unit === "metric") {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  } else {
    // imperial
    const miles = meters * 0.000621371;
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    } else {
      return `${miles.toFixed(2)} mi`;
    }
  }
}

/**
 * Calculate pace from time and distance
 * @param seconds - Time in seconds
 * @param meters - Distance in meters
 * @param unit - 'min_per_km' or 'min_per_mi'
 * @returns Formatted pace
 */
export function calculatePace(
  seconds: number,
  meters: number,
  unit: "min_per_km" | "min_per_mi" = "min_per_km",
): string {
  if (meters === 0 || seconds === 0) return "0:00";

  if (unit === "min_per_km") {
    const minutesPerKm = seconds / 60 / (meters / 1000);
    if (!isFinite(minutesPerKm)) return "0:00";

    const mins = Math.floor(minutesPerKm);
    const secs = Math.round((minutesPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  } else {
    const minutesPerMile = seconds / 60 / (meters * 0.000621371);
    if (!isFinite(minutesPerMile)) return "0:00";

    const mins = Math.floor(minutesPerMile);
    const secs = Math.round((minutesPerMile - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

/**
 * Get current location once (not continuous)
 * @returns Current location or null if failed/permission denied
 */
export async function getCurrentLocation(): Promise<LocationObject | null> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return null;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: LocationAccuracy.High,
    });
    return location;
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}

/**
 * Check if location services are enabled on device
 * @returns Boolean indicating if location services are enabled
 */
export async function areLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch (error) {
    console.error("Error checking location services:", error);
    return false;
  }
}

/**
 * Get last known position (faster but potentially less accurate)
 * @returns Last known location or null
 */
export async function getLastKnownPosition(): Promise<LocationObject | null> {
  try {
    return await Location.getLastKnownPositionAsync();
  } catch (error) {
    console.error("Error getting last known position:", error);
    return null;
  }
}

/**
 * Calculate elevation gain from route
 * @param locations - Array of location objects with altitude
 * @returns Total elevation gain in meters
 */
export function calculateElevationGain(locations: LocationCoords[]): number {
  if (!locations || locations.length < 2) return 0;

  let gain = 0;
  for (let i = 1; i < locations.length; i++) {
    const prevAlt = locations[i - 1].altitude;
    const currAlt = locations[i].altitude;

    if (prevAlt != null && currAlt != null && currAlt > prevAlt) {
      gain += currAlt - prevAlt;
    }
  }
  return Math.round(gain);
}

/**
 * Calculate average speed
 * @param meters - Total distance in meters
 * @param seconds - Total time in seconds
 * @returns Average speed in km/h
 */
export function calculateAverageSpeed(meters: number, seconds: number): number {
  if (seconds === 0) return 0;
  const km = meters / 1000;
  const hours = seconds / 3600;
  return Number((km / hours).toFixed(1));
}