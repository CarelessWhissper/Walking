import * as Location from "expo-location";

// Track active listeners
let locationSubscription = null;

/**
 * Request location permissions
 * @returns {Promise<boolean>} - Whether permission was granted
 */
export async function requestLocationPermissions() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

/**
 * Start tracking location
 * @param {Function} onLocationUpdate - Callback for each location update
 * @param {Object} options - Configuration options
 * @returns {Promise<Object|null>} - Subscription object or null if failed
 */
export async function startLocationTracking(onLocationUpdate, options = {}) {
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
      accuracy: Location.Accuracy.High,
      timeInterval: options.timeInterval || 1000,
      distanceInterval: options.distanceInterval || 5,
      ...options,
    },
    (newLocation) => {
      onLocationUpdate(newLocation);
    },
  );

  return locationSubscription;
}

/**
 * Stop location tracking
 */
export async function stopLocationTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} - Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

/**
 * Calculate total distance from an array of locations
 * @param {Array} locations - Array of location objects with latitude/longitude
 * @returns {number} - Total distance in meters
 */
export function calculateTotalDistance(locations) {
  if (!locations || locations.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    totalDistance += calculateDistance(
      prev.latitude || prev.lat,
      prev.longitude || prev.lng || prev.lon,
      curr.latitude || curr.lat,
      curr.longitude || curr.lng || curr.lon,
    );
  }
  return totalDistance;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @param {string} unit - 'metric' or 'imperial'
 * @returns {string} - Formatted distance
 */
export function formatDistance(meters, unit = "metric") {
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
 * @param {number} seconds - Time in seconds
 * @param {number} meters - Distance in meters
 * @param {string} unit - 'min_per_km' or 'min_per_mi'
 * @returns {string} - Formatted pace
 */
export function calculatePace(seconds, meters, unit = "min_per_km") {
  if (meters === 0 || seconds === 0) return "0:00";

  if (unit === "min_per_km") {
    const minutesPerKm = seconds / 60 / (meters / 1000);
    const mins = Math.floor(minutesPerKm);
    const secs = Math.round((minutesPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  } else {
    const minutesPerMile = seconds / 60 / (meters * 0.000621371);
    const mins = Math.floor(minutesPerMile);
    const secs = Math.round((minutesPerMile - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

/**
 * Get current location once (not continuous)
 * @returns {Promise<Object|null>} - Current location or null if failed/permission denied
 */
export async function getCurrentLocation() {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return null;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location;
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}
