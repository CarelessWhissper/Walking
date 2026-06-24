import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LocationCoords,
  LocationTrackingOptions,
  calculateAccurateDistance,
  calculateTotalDistance,
  smoothLocations,
  formatDistance,
  calculatePace,
} from "./locationTracker";

export const LOCATION_TASK_NAME = "track-background-location";
export const LOCATION_EVENT = "track-location-update";
const SESSION_KEY = "activeRunSession";

// Module-level live state. Because tracking runs as an Android foreground
// service, this process stays alive while the app is backgrounded, so this
// state survives minimize/resume without touching storage. The persisted
// snapshot below is only a safety net for a full process kill.
let sessionStartTime: number | null = null;
let sessionLocations: LocationCoords[] = [];
let sessionDistance = 0;
let sessionOptions: LocationTrackingOptions = {};

// The exact options object passed to startLocationUpdatesAsync. We re-issue it
// (with a refreshed notification body) on each location batch to push live
// stats into the foreground-service notification.
let trackingConfig:
  | Parameters<typeof Location.startLocationUpdatesAsync>[1]
  | null = null;
// Last notification text we pushed, so we skip redundant native round-trips.
let lastNotificationBody = "";

export interface SessionSnapshot {
  startTime: number;
  locations: LocationCoords[];
  distance: number;
  options?: LocationTrackingOptions;
}

/** Format a duration in seconds as H:MM:SS (or M:SS under an hour). */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Build the live-stats line shown in the foreground-service notification. */
function buildNotificationBody(): string {
  if (sessionStartTime == null) return "Recording your run";
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const dist = formatDistance(sessionDistance);
  const clock = formatClock(elapsed);
  const pace = calculatePace(elapsed, sessionDistance);
  return `${dist}  ·  ${clock}  ·  ${pace} /km`;
}

/** Assemble the location-updates options, including the foreground service. */
function buildTrackingConfig(
  options: LocationTrackingOptions,
  notificationBody: string,
): Parameters<typeof Location.startLocationUpdatesAsync>[1] {
  return {
    accuracy: options.accuracy ?? Location.Accuracy.High,
    timeInterval: options.timeInterval ?? 1000,
    distanceInterval: options.distanceInterval ?? 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.Fitness,
    foregroundService: {
      notificationTitle: "track",
      notificationBody,
      notificationColor: "#00D9FF",
    },
  };
}

/**
 * Refresh the foreground-service notification with the current live stats.
 * Re-issuing startLocationUpdatesAsync for an already-running task updates its
 * options in place — Android reuses the same notification, so the text changes
 * without spawning a second notification. Best-effort: a failure here must
 * never interrupt tracking.
 */
async function updateNotification(): Promise<void> {
  if (!trackingConfig) return;
  const body = buildNotificationBody();
  if (body === lastNotificationBody) return;
  lastNotificationBody = body;
  trackingConfig = {
    ...trackingConfig,
    foregroundService: {
      ...trackingConfig.foregroundService,
      notificationTitle: "track",
      notificationBody: body,
      notificationColor: "#00D9FF",
    },
  };
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, trackingConfig);
  } catch {
    // best-effort notification refresh
  }
}

function toCoords(l: Location.LocationObject): LocationCoords {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    altitude: l.coords.altitude,
    accuracy: l.coords.accuracy,
    altitudeAccuracy: l.coords.altitudeAccuracy,
    heading: l.coords.heading,
    speed: l.coords.speed,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    lon: l.coords.longitude,
    timestamp: l.timestamp,
  };
}

function recomputeDistance(): void {
  if (sessionLocations.length > 5) {
    const smoothed = smoothLocations(sessionLocations, 3);
    sessionDistance = calculateAccurateDistance(smoothed, 15);
  } else if (sessionLocations.length > 1) {
    sessionDistance = calculateTotalDistance(sessionLocations);
  }
}

async function persist(): Promise<void> {
  if (sessionStartTime == null) return;
  const snapshot: SessionSnapshot = {
    startTime: sessionStartTime,
    locations: sessionLocations,
    distance: sessionDistance,
    options: sessionOptions,
  };
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // best-effort persistence
  }
}

/**
 * Returns the active session, hydrating module state from storage if this is
 * a cold start (e.g. the OS killed and relaunched the process).
 */
export async function loadSession(): Promise<SessionSnapshot | null> {
  if (sessionStartTime != null) {
    return {
      startTime: sessionStartTime,
      locations: sessionLocations,
      distance: sessionDistance,
    };
  }
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as SessionSnapshot;
      sessionStartTime = snap.startTime;
      sessionLocations = snap.locations ?? [];
      sessionDistance = snap.distance ?? 0;
      sessionOptions = snap.options ?? {};
      // Rebuild the config so a cold-relaunched task can still refresh the
      // notification (the live module state was lost when the process died).
      if (!trackingConfig) {
        trackingConfig = buildTrackingConfig(
          sessionOptions,
          buildNotificationBody(),
        );
      }
      return snap;
    }
  } catch {
    // ignore corrupt snapshot
  }
  return null;
}

function beginSession(startTime: number, options: LocationTrackingOptions): void {
  sessionStartTime = startTime;
  sessionLocations = [];
  sessionDistance = 0;
  sessionOptions = options;
  lastNotificationBody = "";
  trackingConfig = buildTrackingConfig(options, "Recording your run");
}

export async function clearSession(): Promise<void> {
  sessionStartTime = null;
  sessionLocations = [];
  sessionDistance = 0;
  sessionOptions = {};
  trackingConfig = null;
  lastNotificationBody = "";
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// Defined at module scope so it is registered as soon as the JS bundle loads,
// including when Android relaunches the app headless to deliver background
// locations.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (!data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // Recover session if the task fired in a freshly relaunched process.
  if (sessionStartTime == null) {
    await loadSession();
    if (sessionStartTime == null) {
      sessionStartTime = locations[0].timestamp ?? Date.now();
    }
  }

  for (const l of locations) {
    sessionLocations.push(toCoords(l));
  }
  recomputeDistance();
  await persist();
  await updateNotification();

  DeviceEventEmitter.emit(LOCATION_EVENT, {
    startTime: sessionStartTime,
    locations: sessionLocations,
    distance: sessionDistance,
  } as SessionSnapshot);
});

/**
 * Whether the background location updates task is currently running.
 */
export async function isTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

/**
 * Start background-capable location tracking with an Android foreground
 * service so updates continue when the app is minimized or the screen is off.
 * @returns true if tracking started, false if permission was denied.
 */
export async function startBackgroundTracking(
  startTime: number,
  options: LocationTrackingOptions = {},
): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;

  // Background permission lets tracking survive when minimized. If the user
  // denies it, foreground tracking + the foreground service still work.
  try {
    await Location.requestBackgroundPermissionsAsync();
  } catch {
    // not fatal
  }

  // Clean up any stale task before starting a fresh session.
  if (await isTrackingActive()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  beginSession(startTime, options);
  await persist();

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, trackingConfig!);

  return true;
}

/**
 * Stop background tracking. Does NOT clear the session snapshot — the caller
 * decides whether to save/share the run first, then call clearSession().
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (await isTrackingActive()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
