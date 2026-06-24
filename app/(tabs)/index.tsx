import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StatusBar,
  LogBox,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocationTracker } from "@/hooks/useLocationTracker";
import {
  LocationCoords,
  computeSplits,
  downsampleRoute,
} from "@/config/locationTracker";
import { loadRuns, saveRuns, SavedRun } from "@/config/runs";
import { detectPRs } from "@/config/records";
import {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  CameraRef,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme } from "@/constants/theme";
import { DARK_MAP_STYLE, DARK_MAP_STYLE_RASTER } from "@/config/mapStyle";
import { useCadenceTracker } from "@/hooks/useCadenceTracker";
import { estimateCalories, DEFAULT_WEIGHT_KG } from "@/config/calories";
import { useOfflineMap } from "@/hooks/useOfflineMap";
import { ShareCardData } from "@/components/ShareCard";
import { setPendingShare } from "@/components/shareState";
import { toast } from "@/components/Toast";
import { useRouter } from "expo-router";

LogBox.ignoreLogs([
  "Request failed due to a permanent error: Canceled",
  "Mbgl-HttpRequest",
]);

interface RouteGeoJSON {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

const METERS_PER_MILE = 1609.344;

type DistanceUnit = "km" | "mi";

type GoalType = "distance" | "steps";

export default function HomeScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useRasterFallback, setUseRasterFallback] = useState(false);
  const [userWeight, setUserWeight] = useState(DEFAULT_WEIGHT_KG);
  const [targetMeters, setTargetMeters] = useState<number | null>(null);
  const [targetSteps, setTargetSteps] = useState<number | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("distance");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const goalReachedRef = useRef(false);
  const cameraRef = useRef<CameraRef>(null);

  const {
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
  } = useLocationTracker({
    timeInterval: 1000,
    distanceInterval: 5,
  });

  const { cadence, stepCount } = useCadenceTracker(isTracking);
  const { isDownloading, progress, hasOfflinePack, downloadArea } = useOfflineMap();
  const calories = estimateCalories(distance, elapsedTime, userWeight);
  const router = useRouter();

  const buildShareData = useCallback((): ShareCardData => ({
    distance: distance >= 1000
      ? (distance / 1000).toFixed(2)
      : `0.${Math.round(distance).toString().padStart(3, "0")}`,
    duration: (() => {
      const hrs = Math.floor(elapsedTime / 3600);
      const mins = Math.floor((elapsedTime % 3600) / 60);
      const secs = elapsedTime % 60;
      if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    })(),
    pace,
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    calories,
    cadence,
    locations: locations.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
    })),
  }), [distance, elapsedTime, pace, calories, cadence, locations]);

  const openShare = useCallback(() => {
    setPendingShare(buildShareData());
    router.push("/share");
  }, [buildShareData, router]);

  // Load user weight preference
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("userWeight");
      if (saved) setUserWeight(parseFloat(saved));
    })();
  }, []);

  // Load saved goal & unit
  useEffect(() => {
    (async () => {
      const [savedTarget, savedSteps, savedType, savedUnit] = await Promise.all([
        AsyncStorage.getItem("targetMeters"),
        AsyncStorage.getItem("targetSteps"),
        AsyncStorage.getItem("goalType"),
        AsyncStorage.getItem("distanceUnit"),
      ]);
      if (savedTarget) {
        const parsed = parseFloat(savedTarget);
        if (!isNaN(parsed) && parsed > 0) setTargetMeters(parsed);
      }
      if (savedSteps) {
        const parsed = parseInt(savedSteps, 10);
        if (!isNaN(parsed) && parsed > 0) setTargetSteps(parsed);
      }
      if (savedType === "distance" || savedType === "steps") setGoalType(savedType);
      if (savedUnit === "km" || savedUnit === "mi") setUnit(savedUnit);
    })();
  }, []);

  // Active goal based on selected type
  const activeTarget = goalType === "steps" ? targetSteps : targetMeters;
  const activeCurrent = goalType === "steps" ? stepCount : distance;

  // Notify once when goal is reached
  useEffect(() => {
    if (!isTracking) {
      goalReachedRef.current = false;
      return;
    }
    if (activeTarget && activeCurrent >= activeTarget && !goalReachedRef.current) {
      goalReachedRef.current = true;
      const label = goalType === "steps"
        ? `${activeTarget.toLocaleString()} step`
        : unit === "km"
          ? `${(activeTarget / 1000).toFixed(2)} km`
          : `${(activeTarget / METERS_PER_MILE).toFixed(2)} mi`;
      toast.success("Goal reached!", `You hit your ${label} target.`);
    }
  }, [isTracking, activeCurrent, activeTarget, goalType, unit]);

  const goalProgress = activeTarget && activeTarget > 0
    ? Math.min(activeCurrent / activeTarget, 1)
    : 0;

  const formatGoal = (meters: number, u: DistanceUnit): string => {
    const value = u === "km" ? meters / 1000 : meters / METERS_PER_MILE;
    return `${value.toFixed(2)} ${u}`;
  };

  const formatTarget = (): string => {
    if (!activeTarget) return "";
    return goalType === "steps"
      ? `${activeTarget.toLocaleString()} steps`
      : formatGoal(activeTarget, unit);
  };

  const remainingLabel = (): string => {
    if (!activeTarget) return "";
    const remaining = Math.max(activeTarget - activeCurrent, 0);
    return goalType === "steps"
      ? `${Math.ceil(remaining).toLocaleString()} steps`
      : formatGoal(remaining, unit);
  };

  const prefillGoalInput = useCallback((type: GoalType) => {
    if (type === "steps") {
      setGoalInput(targetSteps ? targetSteps.toString() : "");
    } else if (targetMeters) {
      const value = unit === "km"
        ? (targetMeters / 1000).toFixed(2)
        : (targetMeters / METERS_PER_MILE).toFixed(2);
      setGoalInput(value);
    } else {
      setGoalInput("");
    }
  }, [targetMeters, targetSteps, unit]);

  const openGoalEditor = useCallback(() => {
    prefillGoalInput(goalType);
    setGoalError(null);
    setIsEditingGoal(true);
  }, [prefillGoalInput, goalType]);

  const switchGoalType = useCallback(async (next: GoalType) => {
    if (next === goalType) return;
    setGoalType(next);
    setGoalError(null);
    prefillGoalInput(next);
    await AsyncStorage.setItem("goalType", next);
  }, [goalType, prefillGoalInput]);

  const saveGoal = useCallback(async () => {
    const trimmed = goalInput.trim();
    if (!trimmed) {
      if (goalType === "steps") {
        await AsyncStorage.removeItem("targetSteps");
        setTargetSteps(null);
      } else {
        await AsyncStorage.removeItem("targetMeters");
        setTargetMeters(null);
      }
      setGoalError(null);
      setIsEditingGoal(false);
      Keyboard.dismiss();
      return;
    }
    if (goalType === "steps") {
      const parsed = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
      if (isNaN(parsed) || parsed <= 0) {
        setGoalError("Enter a positive whole number");
        return;
      }
      setTargetSteps(parsed);
      setGoalError(null);
      await AsyncStorage.setItem("targetSteps", parsed.toString());
      await AsyncStorage.setItem("goalType", "steps");
    } else {
      const parsed = parseFloat(trimmed.replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) {
        setGoalError("Enter a positive number");
        return;
      }
      const meters = unit === "km" ? parsed * 1000 : parsed * METERS_PER_MILE;
      setTargetMeters(meters);
      setGoalError(null);
      await AsyncStorage.setItem("targetMeters", meters.toString());
      await AsyncStorage.setItem("distanceUnit", unit);
      await AsyncStorage.setItem("goalType", "distance");
    }
    setIsEditingGoal(false);
    Keyboard.dismiss();
  }, [goalInput, unit, goalType]);

  const cancelGoalEdit = useCallback(() => {
    setIsEditingGoal(false);
    setGoalError(null);
    Keyboard.dismiss();
  }, []);

  const clearGoal = useCallback(async () => {
    if (goalType === "steps") {
      setTargetSteps(null);
      await AsyncStorage.removeItem("targetSteps");
    } else {
      setTargetMeters(null);
      await AsyncStorage.removeItem("targetMeters");
    }
    setGoalError(null);
    setIsEditingGoal(false);
    Keyboard.dismiss();
  }, [goalType]);

  const toggleUnit = useCallback(async () => {
    const next: DistanceUnit = unit === "km" ? "mi" : "km";
    setUnit(next);
    await AsyncStorage.setItem("distanceUnit", next);
    // Convert any in-progress input value to match the new unit so user intent is preserved
    if (isEditingGoal && goalInput) {
      const parsed = parseFloat(goalInput.replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        const converted = next === "mi"
          ? parsed / 1.609344
          : parsed * 1.609344;
        setGoalInput(converted.toFixed(2));
      }
    }
  }, [unit, isEditingGoal, goalInput]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(status === "granted");
      if (status === "granted" && !hasOfflinePack) {
        // Auto-cache tiles around current location
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced });
          downloadArea(loc.coords.latitude, loc.coords.longitude);
        } catch {
          // silent fail - online tiles still work
        }
      }
    })();
  }, []);

  const saveRun = useCallback(async () => {
    if (locations.length < 10) return;

    try {
      const priorRuns = await loadRuns();
      const splits = computeSplits(locations);
      const route = downsampleRoute(locations, 400).map((l) => ({
        latitude: l.latitude,
        longitude: l.longitude,
      }));

      const newRun: SavedRun = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        distance,
        duration: elapsedTime,
        pace,
        calories,
        cadence,
        stepCount,
        splits: splits.map((s) => s.seconds),
        locations: route,
      };

      await saveRuns([...priorRuns, newRun]);

      const prs = detectPRs(newRun, priorRuns);
      if (prs.length > 0) {
        toast.success(
          prs.length === 1 ? "New personal record!" : "New personal records!",
          prs.join("  ·  "),
        );
      } else {
        toast.success("Run saved", "View it in your history.");
      }
    } catch (err) {
      console.error("Error saving run:", err);
      toast.error("Couldn't save run", "Try again in a moment.");
    }
  }, [distance, elapsedTime, pace, calories, cadence, stepCount, locations]);

  const handleStopTracking = useCallback(async () => {
    await stopTracking();
    await saveRun();
  }, [stopTracking, saveRun]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const routeGeoJSON = (): RouteGeoJSON | null => {
    if (locations.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: locations.map((loc: LocationCoords) => [
          loc.longitude,
          loc.latitude,
        ]) as [number, number][],
      },
    };
  };

  useEffect(() => {
    if (isTracking && locations.length > 0 && cameraRef.current) {
      const lastLoc = locations[locations.length - 1];
      cameraRef.current.setCamera({
        centerCoordinate: [lastLoc.longitude, lastLoc.latitude],
        zoomLevel: 16,
        animationDuration: 1000,
      });
    }
  }, [locations, isTracking]);

  const routeData = routeGeoJSON();
  const mapStyle = useRasterFallback ? DARK_MAP_STYLE_RASTER : DARK_MAP_STYLE;

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />
        <View style={styles.centerContainer}>
          <Icon name="map-marker-off" size={56} color={Theme.textMuted} />
          <Text style={styles.permissionText}>
            Location access needed to track runs
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              setPermissionGranted(status === "granted");
            }}
          >
            <Text style={styles.permissionButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          mapStyle={mapStyle as any}
          attributionEnabled={false}
          logoEnabled={false}
          onDidFinishLoadingMap={() => setMapError(null)}
          onDidFailLoadingMap={() => {
            if (!useRasterFallback) {
              setUseRasterFallback(true);
            } else {
              setMapError("Map unavailable");
            }
          }}
        >
          <Camera
            ref={cameraRef}
            followUserLocation={isTracking}
            followZoomLevel={16}
            animationDuration={1000}
            animationMode="easeTo"
            minZoomLevel={5}
            maxZoomLevel={20}
          />
          <UserLocation visible={true} showsUserHeadingIndicator={true} />
          {routeData && (
            <ShapeSource id="routeSource" shape={routeData}>
              <LineLayer
                id="routeLine"
                style={{
                  lineColor: Theme.accent,
                  lineWidth: 4,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </ShapeSource>
          )}
        </MapView>

        {mapError && (
          <View style={styles.mapErrorOverlay}>
            <Text style={styles.mapErrorText}>{mapError}</Text>
          </View>
        )}

        {/* Status pill */}
        <View style={[styles.statusPill, isTracking && styles.statusPillActive]}>
          <View style={[styles.statusDot, isTracking && styles.statusDotActive]} />
          <Text style={[styles.statusText, isTracking && styles.statusTextActive]}>
            {isTracking ? "recording" : "ready"}
          </Text>
        </View>

        {/* Offline indicator */}
        {isDownloading && (
          <View style={styles.offlinePill}>
            <Icon name="download" size={12} color={Theme.accent} />
            <Text style={styles.offlineText}>caching {progress}%</Text>
          </View>
        )}
        {hasOfflinePack && !isDownloading && (
          <View style={styles.offlinePill}>
            <Icon name="check-circle" size={12} color={Theme.accent} />
            <Text style={styles.offlineText}>offline ready</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        {/* Primary stat - time */}
        <View style={styles.primaryStat}>
          <Text style={styles.primaryValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.primaryLabel}>duration</Text>
        </View>

        {/* Secondary stats row */}
        <View style={styles.secondaryStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formattedDistance || "0m"}</Text>
            <Text style={styles.statLabel}>distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>pace</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{averageSpeed.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
        </View>

        {/* Tertiary stats - cadence & calories */}
        <View style={styles.tertiaryStats}>
          <View style={styles.tertiaryStat}>
            <Icon name="shoe-print" size={14} color={Theme.textMuted} />
            <Text style={styles.tertiaryValue}>
              {cadence > 0 ? cadence : "—"}
            </Text>
            <Text style={styles.tertiaryLabel}>spm</Text>
          </View>
          <View style={styles.tertiaryStat}>
            <Icon name="fire" size={14} color={Theme.textMuted} />
            <Text style={styles.tertiaryValue}>
              {calories > 0 ? calories : "—"}
            </Text>
            <Text style={styles.tertiaryLabel}>kcal</Text>
          </View>
          <View style={styles.tertiaryStat}>
            <Icon name="walk" size={14} color={Theme.textMuted} />
            <Text style={styles.tertiaryValue}>
              {stepCount > 0 ? stepCount : "—"}
            </Text>
            <Text style={styles.tertiaryLabel}>steps</Text>
          </View>
        </View>
      </View>

      {/* Goal */}
      <View style={styles.goalContainer}>
        {isEditingGoal ? null : activeTarget ? (
          isTracking ? (
            <View style={styles.goalProgressWrap}>
              <View style={styles.goalProgressLabels}>
                <Text style={styles.goalProgressText}>
                  {goalType === "steps"
                    ? `${Math.min(stepCount, activeTarget).toLocaleString()} / ${activeTarget.toLocaleString()} steps`
                    : `${formatGoal(Math.min(distance, activeTarget), unit)} / ${formatGoal(activeTarget, unit)}`}
                </Text>
                <Text style={styles.goalProgressRemaining}>
                  {goalProgress >= 1 ? "goal reached" : `${remainingLabel()} left`}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${goalProgress * 100}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.goalChip}
              onPress={openGoalEditor}
              activeOpacity={0.7}
            >
              <Icon
                name={goalType === "steps" ? "walk" : "flag-outline"}
                size={14}
                color={Theme.accent}
              />
              <Text style={styles.goalChipText}>Goal: {formatTarget()}</Text>
              <Icon name="pencil" size={12} color={Theme.textMuted} />
            </TouchableOpacity>
          )
        ) : !isTracking ? (
          <TouchableOpacity
            style={styles.setGoalButton}
            onPress={openGoalEditor}
            activeOpacity={0.7}
          >
            <Icon name="flag-outline" size={14} color={Theme.textSecondary} />
            <Text style={styles.setGoalText}>Set goal</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isTracking && locations.length > 0 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resetTracking}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={22} color={Theme.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.mainButton,
            isTracking ? styles.stopButton : styles.startButton,
          ]}
          onPress={isTracking ? handleStopTracking : startTracking}
          activeOpacity={0.8}
        >
          <Icon
            name={isTracking ? "stop" : "play"}
            size={32}
            color={isTracking ? Theme.white : Theme.bg}
          />
        </TouchableOpacity>

        {!isTracking && locations.length > 0 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={openShare}
            activeOpacity={0.7}
          >
            <Icon
              name="share-variant"
              size={22}
              color={Theme.accent}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Goal editor — floats at the top so the keyboard never covers it */}
      {isEditingGoal && (
        <>
          <Pressable style={styles.goalEditorBackdrop} onPress={cancelGoalEdit} />
          <View style={styles.goalEditorOverlay} pointerEvents="box-none">
            <View style={styles.goalEditorWrap}>
              <View style={styles.goalTypeRow}>
                {(["distance", "steps"] as GoalType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.goalTypeChip, goalType === type && styles.goalTypeChipActive]}
                    onPress={() => switchGoalType(type)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={type === "steps" ? "walk" : "map-marker-distance"}
                      size={13}
                      color={goalType === type ? Theme.accent : Theme.textMuted}
                    />
                    <Text style={[styles.goalTypeText, goalType === type && styles.goalTypeTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.goalEditor, goalError && styles.goalEditorError]}>
                <TextInput
                  style={styles.goalInput}
                  value={goalInput}
                  onChangeText={(t) => {
                    setGoalInput(t);
                    if (goalError) setGoalError(null);
                  }}
                  placeholder={goalType === "steps" ? "Step count" : `Distance in ${unit}`}
                  placeholderTextColor={Theme.textMuted}
                  keyboardType={goalType === "steps" ? "number-pad" : "decimal-pad"}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={saveGoal}
                />
                {goalType === "distance" ? (
                  <TouchableOpacity
                    style={styles.unitToggle}
                    onPress={toggleUnit}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.unitToggleText}>{unit}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.unitToggle}>
                    <Text style={styles.unitToggleText}>steps</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.goalEditorBtn}
                  onPress={saveGoal}
                  activeOpacity={0.7}
                >
                  <Icon name="check" size={18} color={Theme.accent} />
                </TouchableOpacity>
                {activeTarget !== null && (
                  <TouchableOpacity
                    style={styles.goalEditorBtn}
                    onPress={clearGoal}
                    activeOpacity={0.7}
                  >
                    <Icon name="close" size={18} color={Theme.danger} />
                  </TouchableOpacity>
                )}
              </View>
              {goalError && (
                <Text style={styles.goalErrorText}>{goalError}</Text>
              )}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionText: {
    fontSize: 16,
    color: Theme.textSecondary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 28,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: Theme.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  permissionButtonText: {
    color: Theme.bg,
    fontSize: 15,
    fontWeight: "600",
  },
  mapContainer: {
    height: 260,
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  map: {
    flex: 1,
  },
  mapErrorOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(255,82,82,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapErrorText: {
    fontSize: 12,
    color: Theme.white,
  },
  statusPill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(28,28,31,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  statusPillActive: {
    backgroundColor: "rgba(0,217,255,0.15)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Theme.textMuted,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: Theme.accent,
  },
  statusText: {
    fontSize: 12,
    color: Theme.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: Theme.accent,
  },
  offlinePill: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(28,28,31,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  offlineText: {
    fontSize: 11,
    color: Theme.accent,
    fontWeight: "500",
  },
  statsContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryStat: {
    alignItems: "center",
    marginBottom: 24,
  },
  primaryValue: {
    fontSize: 60,
    fontWeight: "200",
    color: Theme.text,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  primaryLabel: {
    fontSize: 12,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 4,
  },
  secondaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "300",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Theme.border,
  },
  tertiaryStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
  },
  tertiaryStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tertiaryValue: {
    fontSize: 15,
    fontWeight: "400",
    color: Theme.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  tertiaryLabel: {
    fontSize: 11,
    color: Theme.textMuted,
  },
  goalContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    alignItems: "center",
    minHeight: 36,
    justifyContent: "center",
  },
  setGoalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  setGoalText: {
    color: Theme.textSecondary,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(0,217,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.25)",
  },
  goalChipText: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  goalEditorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 10,
  },
  goalEditorOverlay: {
    position: "absolute",
    top: 72,
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 11,
  },
  goalEditorWrap: {
    alignItems: "center",
  },
  goalTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  goalTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  goalTypeChipActive: {
    backgroundColor: "rgba(0,217,255,0.08)",
    borderColor: "rgba(0,217,255,0.25)",
  },
  goalTypeText: {
    color: Theme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  goalTypeTextActive: {
    color: Theme.accent,
  },
  goalEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  goalEditorError: {
    borderColor: Theme.danger,
  },
  goalErrorText: {
    color: Theme.danger,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  goalInput: {
    color: Theme.text,
    fontSize: 14,
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontVariant: ["tabular-nums"],
  },
  unitToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Theme.surfaceLight,
  },
  unitToggleText: {
    color: Theme.accent,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  goalEditorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Theme.surfaceLight,
  },
  goalProgressWrap: {
    width: "100%",
  },
  goalProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  goalProgressText: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  goalProgressRemaining: {
    color: Theme.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Theme.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Theme.accent,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
    paddingHorizontal: 24,
    gap: 24,
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  startButton: {
    backgroundColor: Theme.accent,
  },
  stopButton: {
    backgroundColor: Theme.danger,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  errorContainer: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: "rgba(255,82,82,0.1)",
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: Theme.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
