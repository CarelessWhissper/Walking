import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Linking,
  LogBox,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useLocationTracker } from "@/hooks/useLocationTracker";
import {
  LocationCoords,
  computeSplits,
  downsampleRoute,
} from "@/config/locationTracker";
import { loadRuns, saveRuns, SavedRun } from "@/config/runs";
import { detectPRDetails, PRDetail } from "@/config/records";
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
import {
  DistanceUnit,
  METERS_PER_MILE,
  distanceValueIn,
  formatDistanceIn,
  formatPaceIn,
  paceUnitLabel,
  speedValueIn,
  speedUnitLabel,
} from "@/config/format";

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

type GoalType = "distance" | "steps" | "timed";

// Accepts plain minutes ("30", "12.5") or clock formats ("mm:ss", "hh:mm:ss").
// Returns whole seconds, or NaN when the input can't be parsed.
const parseTimeInput = (raw: string): number => {
  const trimmed = raw.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => parseInt(p, 10));
    if (parts.length > 3 || parts.some(isNaN)) return NaN;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const mins = parseFloat(trimmed.replace(",", "."));
  return isNaN(mins) ? NaN : Math.round(mins * 60);
};

const formatTimeInputValue = (seconds: number): string => {
  if (seconds % 60 === 0) return (seconds / 60).toString();
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
};

// Hold-to-stop tuning (B1). 900 ms tested well against accidental presses;
// 1500 ms feels punitive.
const HOLD_TO_STOP_MS = 900;
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MAP_HEIGHT_FULL = 260;
const MAP_HEIGHT_RUN = 120;
const MAP_COLLAPSE_AFTER_MS = 15000;

interface GoalOutcome {
  title: string;
  detail: string;
  reached: boolean;
}

interface RunSummary {
  timeLabel: string;
  distanceMeters: number;
  duration: number;
  calories: number;
  prs: PRDetail[];
  goal: GoalOutcome | null;
}

export default function HomeScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useRasterFallback, setUseRasterFallback] = useState(false);
  const [userWeight, setUserWeight] = useState(DEFAULT_WEIGHT_KG);
  const [targetMeters, setTargetMeters] = useState<number | null>(null);
  const [targetSteps, setTargetSteps] = useState<number | null>(null);
  const [targetSeconds, setTargetSeconds] = useState<number | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("distance");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [lastRun, setLastRun] = useState<SavedRun | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const goalReachedRef = useRef(false);
  const timeUpRef = useRef(false);
  const holdCommittedRef = useRef(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const mapHeight = useRef(new Animated.Value(MAP_HEIGHT_FULL)).current;
  const cameraRef = useRef<CameraRef>(null);

  const {
    isTracking,
    locations,
    distance,
    elapsedTime,
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
    distance: distanceValueIn(distance, unit),
    duration: (() => {
      const hrs = Math.floor(elapsedTime / 3600);
      const mins = Math.floor((elapsedTime % 3600) / 60);
      const secs = elapsedTime % 60;
      if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    })(),
    pace: formatPaceIn(elapsedTime, distance, unit),
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
    unit,
  }), [distance, elapsedTime, calories, cadence, locations, unit]);

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
      const [savedTarget, savedSteps, savedSeconds, savedType, savedUnit] = await Promise.all([
        AsyncStorage.getItem("targetMeters"),
        AsyncStorage.getItem("targetSteps"),
        AsyncStorage.getItem("targetTimeSeconds"),
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
      if (savedSeconds) {
        const parsed = parseInt(savedSeconds, 10);
        if (!isNaN(parsed) && parsed > 0) setTargetSeconds(parsed);
      }
      if (savedType === "distance" || savedType === "steps" || savedType === "timed") {
        setGoalType(savedType);
      }
      if (savedUnit === "km" || savedUnit === "mi") setUnit(savedUnit);
    })();
  }, []);

  // Active goal based on selected type ("timed" tracks distance against a time limit,
  // so it needs both a distance and a duration to be considered set)
  const activeTarget =
    goalType === "steps"
      ? targetSteps
      : goalType === "timed"
        ? (targetSeconds ? targetMeters : null)
        : targetMeters;
  const activeCurrent = goalType === "steps" ? stepCount : distance;

  // Notify once when goal is reached
  useEffect(() => {
    if (!isTracking) {
      goalReachedRef.current = false;
      timeUpRef.current = false;
      return;
    }
    if (activeTarget && activeCurrent >= activeTarget && !goalReachedRef.current) {
      goalReachedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const label = goalType === "steps"
        ? `${activeTarget.toLocaleString()} step`
        : formatDistanceIn(activeTarget, unit);
      if (goalType === "timed" && targetSeconds) {
        if (elapsedTime <= targetSeconds) {
          const spare = targetSeconds - elapsedTime;
          toast.success(
            "Goal reached!",
            `${label} done with ${formatTime(spare)} to spare.`,
          );
        } else {
          toast.success(
            "Goal distance reached",
            `${formatTime(elapsedTime - targetSeconds)} over your time limit.`,
          );
        }
      } else {
        toast.success("Goal reached!", `You hit your ${label} target.`);
      }
    }
  }, [isTracking, activeCurrent, activeTarget, goalType, unit, targetSeconds, elapsedTime]);

  // Notify once when the time limit expires before the distance is done
  useEffect(() => {
    if (!isTracking || goalType !== "timed" || !activeTarget || !targetSeconds) return;
    if (elapsedTime >= targetSeconds && activeCurrent < activeTarget && !timeUpRef.current) {
      timeUpRef.current = true;
      const remaining = activeTarget - activeCurrent;
      toast.info(
        "Time's up",
        `${formatDistanceIn(remaining, unit)} left of your goal — keep going!`,
      );
    }
  }, [isTracking, goalType, elapsedTime, targetSeconds, activeCurrent, activeTarget, unit]);

  const goalProgress = activeTarget && activeTarget > 0
    ? Math.min(activeCurrent / activeTarget, 1)
    : 0;
  const goalReached = goalProgress >= 1;

  const formatTargetStr = (): string => {
    if (!activeTarget) return "";
    return goalType === "steps"
      ? `${activeTarget.toLocaleString()} steps`
      : `${distanceValueIn(activeTarget, unit)} ${unit}`;
  };

  const goalCurrentStr = (): string => {
    if (!activeTarget) return "";
    return goalType === "steps"
      ? `${Math.min(stepCount, activeTarget).toLocaleString()} / ${activeTarget.toLocaleString()} steps`
      : `${distanceValueIn(Math.min(distance, activeTarget), unit)} / ${formatTargetStr()}`;
  };

  const goalRightLabel = (): string => {
    if (!activeTarget) return "";
    if (goalReached) return "goal reached";
    const remaining = Math.max(activeTarget - activeCurrent, 0);
    const remainingStr = goalType === "steps"
      ? `${Math.ceil(remaining).toLocaleString()} steps`
      : formatDistanceIn(remaining, unit);
    if (goalType === "timed" && targetSeconds) {
      return elapsedTime >= targetSeconds
        ? `${remainingStr} left · time's up`
        : `${remainingStr} in ${formatTime(targetSeconds - elapsedTime)}`;
    }
    return `${remainingStr} left`;
  };

  // Where the time budget says you should be, as a % of the distance target (B3)
  const expectedPct =
    goalType === "timed" && targetSeconds && targetSeconds > 0
      ? Math.min(elapsedTime / targetSeconds, 1) * 100
      : null;

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
    if (type === "timed") {
      setTimeInput(targetSeconds ? formatTimeInputValue(targetSeconds) : "");
    }
  }, [targetMeters, targetSteps, targetSeconds, unit]);

  const openGoalEditor = useCallback(() => {
    prefillGoalInput(goalType);
    setIsEditingGoal(true);
    // Quick-value chips come from the user's own history (B7)
    loadRuns().then((runs) => setLastRun(runs[runs.length - 1] ?? null));
  }, [prefillGoalInput, goalType]);

  const switchGoalType = useCallback(async (next: GoalType) => {
    if (next === goalType) return;
    setGoalType(next);
    prefillGoalInput(next);
    await AsyncStorage.setItem("goalType", next);
  }, [goalType, prefillGoalInput]);

  // Inline validity — confirm is disabled instead of accept-then-error (B7).
  // An empty distance/steps input stays valid: it means "clear the goal".
  const goalInputValid = (() => {
    const trimmed = goalInput.trim();
    if (!trimmed) return true;
    if (goalType === "steps") {
      const parsed = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
      return !isNaN(parsed) && parsed > 0;
    }
    const parsed = parseFloat(trimmed.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) return false;
    if (goalType === "timed") {
      const seconds = parseTimeInput(timeInput);
      return !isNaN(seconds) && seconds > 0;
    }
    return true;
  })();
  const timeInputInvalid =
    goalType === "timed" &&
    goalInput.trim().length > 0 &&
    (() => {
      const seconds = parseTimeInput(timeInput);
      return isNaN(seconds) || seconds <= 0;
    })();

  const saveGoal = useCallback(async () => {
    if (!goalInputValid) return;
    const trimmed = goalInput.trim();
    if (!trimmed) {
      if (goalType === "steps") {
        await AsyncStorage.removeItem("targetSteps");
        setTargetSteps(null);
      } else if (goalType === "timed") {
        await AsyncStorage.multiRemove(["targetMeters", "targetTimeSeconds"]);
        setTargetMeters(null);
        setTargetSeconds(null);
      } else {
        await AsyncStorage.removeItem("targetMeters");
        setTargetMeters(null);
      }
      setIsEditingGoal(false);
      Keyboard.dismiss();
      return;
    }
    if (goalType === "steps") {
      const parsed = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
      setTargetSteps(parsed);
      await AsyncStorage.setItem("targetSteps", parsed.toString());
      await AsyncStorage.setItem("goalType", "steps");
    } else {
      const parsed = parseFloat(trimmed.replace(",", "."));
      const meters = unit === "km" ? parsed * 1000 : parsed * METERS_PER_MILE;
      if (goalType === "timed") {
        const seconds = parseTimeInput(timeInput);
        setTargetSeconds(seconds);
        await AsyncStorage.setItem("targetTimeSeconds", seconds.toString());
      }
      setTargetMeters(meters);
      await AsyncStorage.setItem("targetMeters", meters.toString());
      await AsyncStorage.setItem("distanceUnit", unit);
      await AsyncStorage.setItem("goalType", goalType);
    }
    setIsEditingGoal(false);
    Keyboard.dismiss();
  }, [goalInput, timeInput, unit, goalType, goalInputValid]);

  const cancelGoalEdit = useCallback(() => {
    setIsEditingGoal(false);
    Keyboard.dismiss();
  }, []);

  const clearGoal = useCallback(async () => {
    if (goalType === "steps") {
      setTargetSteps(null);
      await AsyncStorage.removeItem("targetSteps");
    } else if (goalType === "timed") {
      setTargetMeters(null);
      setTargetSeconds(null);
      await AsyncStorage.multiRemove(["targetMeters", "targetTimeSeconds"]);
    } else {
      setTargetMeters(null);
      await AsyncStorage.removeItem("targetMeters");
    }
    setIsEditingGoal(false);
    Keyboard.dismiss();
  }, [goalType]);

  const setUnitTo = useCallback(async (next: DistanceUnit) => {
    if (next === unit) return;
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

  const quickGoalValues = (): { label: string; value: string }[] => {
    if (goalType === "steps") {
      const values = [
        { label: "5 000", value: "5000" },
        { label: "8 000", value: "8000" },
        { label: "10 000", value: "10000" },
      ];
      if (lastRun?.stepCount) {
        values.push({
          label: `last · ${lastRun.stepCount.toLocaleString()}`,
          value: String(lastRun.stepCount),
        });
      }
      return values;
    }
    const values = ["3.00", "5.00", "10.00"].map((v) => ({ label: v, value: v }));
    if (lastRun?.distance) {
      const v = distanceValueIn(lastRun.distance, unit);
      values.push({ label: `last · ${v}`, value: v });
    }
    return values;
  };

  const requestPermission = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setPermissionGranted(res.status === "granted");
    setPermBlocked(res.status !== "granted" && res.canAskAgain === false);
    return res.status === "granted";
  }, []);

  useEffect(() => {
    (async () => {
      const granted = await requestPermission();
      if (granted && !hasOfflinePack) {
        // Auto-cache tiles around current location
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced });
          downloadArea(loc.coords.latitude, loc.coords.longitude);
        } catch {
          // silent fail - online tiles still work
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRun = useCallback(async (): Promise<PRDetail[] | null> => {
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
        pace: formatPaceIn(elapsedTime, distance, "km"),
        calories,
        cadence,
        stepCount,
        splits: splits.map((s) => s.seconds),
        locations: route,
      };

      await saveRuns([...priorRuns, newRun]);

      const prs = detectPRDetails(newRun, priorRuns);
      if (prs.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return prs;
    } catch (err) {
      console.error("Error saving run:", err);
      toast.error("Couldn't save run", "Try again in a moment.");
      return null;
    }
  }, [distance, elapsedTime, calories, cadence, stepCount, locations]);

  const buildGoalOutcome = useCallback((): GoalOutcome | null => {
    if (!activeTarget) return null;
    const targetStr = formatTargetStr();
    if (activeCurrent >= activeTarget) {
      let detail: string;
      if (goalType === "timed" && targetSeconds) {
        detail =
          elapsedTime <= targetSeconds
            ? `${formatTime(targetSeconds - elapsedTime)} to spare`
            : `${formatTime(elapsedTime - targetSeconds)} over the time limit`;
      } else if (goalType === "steps") {
        detail = `+${Math.round(activeCurrent - activeTarget).toLocaleString()} over target`;
      } else {
        detail = `+${formatDistanceIn(activeCurrent - activeTarget, unit)} over target`;
      }
      return { title: `Goal reached — ${targetStr}`, detail, reached: true };
    }
    const left = activeTarget - activeCurrent;
    const leftStr =
      goalType === "steps"
        ? `${Math.ceil(left).toLocaleString()} steps short`
        : `${formatDistanceIn(left, unit)} short`;
    return { title: `Goal — ${targetStr}`, detail: leftStr, reached: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTarget, activeCurrent, goalType, targetSeconds, elapsedTime, unit]);

  const handleStopTracking = useCallback(async () => {
    const goalOutcome = buildGoalOutcome();
    await stopTracking();
    if (locations.length < 10) {
      toast.info("Too short to save", "Keep running a little longer next time.");
      return;
    }
    const prs = await saveRun();
    if (prs == null) return;
    setSummary({
      timeLabel: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      distanceMeters: distance,
      duration: elapsedTime,
      calories,
      prs,
      goal: goalOutcome,
    });
  }, [stopTracking, saveRun, buildGoalOutcome, locations.length, distance, elapsedTime, calories]);

  // --- Hold to stop (B1) ---
  const onStopPressIn = useCallback(() => {
    setIsHolding(true);
    holdCommittedRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_TO_STOP_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        holdCommittedRef.current = true;
        setIsHolding(false);
        holdProgress.setValue(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        handleStopTracking();
      }
    });
  }, [holdProgress, handleStopTracking]);

  const onStopPressOut = useCallback(() => {
    if (!holdCommittedRef.current) {
      holdProgress.stopAnimation(() => holdProgress.setValue(0));
      setIsHolding(false);
    }
  }, [holdProgress]);

  // --- 3-2-1 start countdown (B4) ---
  useEffect(() => {
    if (countdown == null) return;
    if (countdown === 0) {
      setCountdown(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      startTracking();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const timer = setTimeout(
      () => setCountdown((c) => (c != null ? c - 1 : null)),
      1000,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const onMainButtonPress = useCallback(() => {
    if (countdown != null) {
      setCountdown(null); // cancel
      return;
    }
    setCountdown(3);
  }, [countdown]);

  // --- Run-mode map collapse (B5): shrink once per run, tap to restore ---
  useEffect(() => {
    if (isTracking) {
      const timer = setTimeout(() => setMapCollapsed(true), MAP_COLLAPSE_AFTER_MS);
      return () => clearTimeout(timer);
    }
    setMapCollapsed(false);
  }, [isTracking]);

  useEffect(() => {
    Animated.timing(mapHeight, {
      toValue: mapCollapsed ? MAP_HEIGHT_RUN : MAP_HEIGHT_FULL,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [mapCollapsed, mapHeight]);

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
          {permBlocked ? (
            <>
              <Text style={styles.permissionText}>
                Location is turned off for track. Enable it in Android settings
                to record runs.
              </Text>
              <Text style={styles.permissionPrivacy}>
                Your route is stored on this phone only. No account, no upload.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.permissionButtonText}>Open settings</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.permissionText}>
                Location access needed to track runs
              </Text>
              <Text style={styles.permissionPrivacy}>
                Your route is stored on this phone only. No account, no upload.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>Enable Location</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* Map — collapses to a strip mid-run so the numbers get the space (B5) */}
      <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
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

        {/* Tap the collapsed strip to restore the full map */}
        {mapCollapsed && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMapCollapsed(false)}
          />
        )}

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
        {hasOfflinePack && !isDownloading && !mapCollapsed && (
          <View style={styles.offlinePill}>
            <Icon name="check-circle" size={12} color={Theme.accent} />
            <Text style={styles.offlineText}>offline ready</Text>
          </View>
        )}
      </Animated.View>

      {/* Stats — two-tier grid that reads at arm's length (A1) */}
      <View style={styles.statsContainer}>
        {countdown != null ? (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownValue}>{countdown}</Text>
            <Text style={styles.countdownLabel}>starting</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroTier}>
              <View style={styles.heroStat}>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatTime(elapsedTime)}
                </Text>
                <Text style={styles.heroLabel}>duration</Text>
              </View>
              <View style={styles.heroStat}>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {distanceValueIn(distance, unit)}
                </Text>
                <Text style={styles.heroLabel}>{unit}</Text>
              </View>
            </View>

            <View style={styles.secondTier}>
              <View style={styles.secondStat}>
                <Text style={styles.secondValue}>
                  {formatPaceIn(elapsedTime, distance, unit)}
                </Text>
                <Text style={styles.secondLabel}>pace {paceUnitLabel(unit)}</Text>
              </View>
              <View style={styles.secondStat}>
                <Text style={styles.secondValue}>
                  {speedValueIn(distance, elapsedTime, unit).toFixed(1)}
                </Text>
                <Text style={styles.secondLabel}>{speedUnitLabel(unit)}</Text>
              </View>
            </View>

            <View style={styles.derivedRow}>
              <Text style={styles.derivedItem}>
                {cadence > 0 ? (
                  <Text style={styles.derivedValue}>{cadence}</Text>
                ) : (
                  <Text style={styles.derivedDash}>—</Text>
                )}
                <Text style={styles.derivedUnit}> spm</Text>
              </Text>
              <Text style={styles.derivedItem}>
                {calories > 0 ? (
                  <Text style={styles.derivedValue}>{calories}</Text>
                ) : (
                  <Text style={styles.derivedDash}>—</Text>
                )}
                <Text style={styles.derivedUnit}> kcal</Text>
              </Text>
              <Text style={styles.derivedItem}>
                {stepCount > 0 ? (
                  <Text style={styles.derivedValue}>{stepCount.toLocaleString()}</Text>
                ) : (
                  <Text style={styles.derivedDash}>—</Text>
                )}
                <Text style={styles.derivedUnit}> steps</Text>
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Goal — one rail, all states (B3) */}
      <View style={styles.goalContainer}>
        {isEditingGoal ? null : activeTarget ? (
          <Pressable
            style={styles.goalRail}
            onPress={!isTracking ? openGoalEditor : undefined}
            disabled={isTracking}
          >
            <View style={styles.goalRailLabels}>
              <Text
                style={[
                  styles.goalRailText,
                  goalReached && isTracking && styles.goalRailTextReached,
                ]}
              >
                {goalCurrentStr()}
              </Text>
              {isTracking ? (
                <Text
                  style={[
                    styles.goalRailRight,
                    goalReached && styles.goalRailTextReached,
                  ]}
                >
                  {goalRightLabel()}
                </Text>
              ) : (
                <View style={styles.goalEditHint}>
                  <Icon name="pencil" size={11} color={Theme.textMuted} />
                  <Text style={styles.goalEditHintText}>edit</Text>
                </View>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${goalProgress * 100}%` },
                ]}
              />
              {expectedPct != null && isTracking && !goalReached && (
                <View style={[styles.paceMarker, { left: `${expectedPct}%` }]} />
              )}
            </View>
          </Pressable>
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

        {isTracking ? (
          // Hold to stop — the gesture is the confirmation (B1)
          <View style={styles.holdWrap}>
            <Svg
              width={RING_RADIUS * 2 + 8}
              height={RING_RADIUS * 2 + 8}
              style={styles.holdRing}
            >
              <AnimatedCircle
                cx={RING_RADIUS + 4}
                cy={RING_RADIUS + 4}
                r={RING_RADIUS}
                stroke={Theme.danger}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeDashoffset={holdProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [RING_CIRCUMFERENCE, 0],
                })}
                rotation={-90}
                originX={RING_RADIUS + 4}
                originY={RING_RADIUS + 4}
              />
            </Svg>
            <Pressable
              style={[styles.mainButton, styles.stopButton]}
              onPressIn={onStopPressIn}
              onPressOut={onStopPressOut}
            >
              {isHolding ? (
                <Text style={styles.holdText}>hold</Text>
              ) : (
                <Icon name="stop" size={32} color={Theme.white} />
              )}
            </Pressable>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.mainButton, styles.startButton]}
            onPress={onMainButtonPress}
            activeOpacity={0.8}
          >
            <Icon
              name={countdown != null ? "close" : "play"}
              size={32}
              color={Theme.bg}
            />
          </TouchableOpacity>
        )}

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

      {/* Hold hint */}
      <Text style={styles.holdHint}>{isHolding ? "keep holding to end" : " "}</Text>

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
                {(["distance", "steps", "timed"] as GoalType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.goalTypeChip, goalType === type && styles.goalTypeChipActive]}
                    onPress={() => switchGoalType(type)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={type === "steps" ? "walk" : type === "timed" ? "timer-outline" : "map-marker-distance"}
                      size={13}
                      color={goalType === type ? Theme.accent : Theme.textMuted}
                    />
                    <Text style={[styles.goalTypeText, goalType === type && styles.goalTypeTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                style={[
                  styles.goalEditor,
                  !goalInputValid && !timeInputInvalid && styles.goalEditorError,
                ]}
              >
                <TextInput
                  style={styles.goalInput}
                  value={goalInput}
                  onChangeText={setGoalInput}
                  placeholder={goalType === "steps" ? "Step count" : `Distance in ${unit}`}
                  placeholderTextColor={Theme.textMuted}
                  keyboardType={goalType === "steps" ? "number-pad" : "decimal-pad"}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={saveGoal}
                />
                {goalType === "steps" ? (
                  <View style={styles.unitTag}>
                    <Text style={styles.unitTagText}>steps</Text>
                  </View>
                ) : (
                  // Segmented control — it changes the meaning of the number beside it (B7)
                  <View style={styles.unitSegment}>
                    {(["km", "mi"] as DistanceUnit[]).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitSegmentBtn,
                          unit === u && styles.unitSegmentBtnActive,
                        ]}
                        onPress={() => setUnitTo(u)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.unitSegmentText,
                            unit === u && styles.unitSegmentTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.goalEditorBtn,
                    !goalInputValid && styles.goalEditorBtnDisabled,
                  ]}
                  onPress={saveGoal}
                  disabled={!goalInputValid}
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
              {goalType === "timed" && (
                <>
                  <View
                    style={[
                      styles.goalEditor,
                      styles.goalTimeRow,
                      timeInputInvalid && styles.goalEditorError,
                    ]}
                  >
                    <Icon name="timer-outline" size={16} color={Theme.textMuted} style={styles.goalTimeIcon} />
                    <TextInput
                      style={[styles.goalInput, styles.goalTimeInput]}
                      value={timeInput}
                      onChangeText={setTimeInput}
                      placeholder="Time — minutes or mm:ss"
                      placeholderTextColor={Theme.textMuted}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                      onSubmitEditing={saveGoal}
                    />
                  </View>
                  <Text style={styles.goalTimeHint}>
                    30 = 30 min · 1:05:00 = 1 h 5 min
                  </Text>
                </>
              )}
              {/* Quick values from the user's own history (B7) */}
              <View style={styles.quickRow}>
                {quickGoalValues().map((q) => (
                  <TouchableOpacity
                    key={q.label}
                    style={styles.quickChip}
                    onPress={() => setGoalInput(q.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickChipText}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </>
      )}

      {/* Post-run summary — a moment, not a form (B1) */}
      <Modal
        visible={summary != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSummary(null)}
      >
        <View style={styles.summaryBackdrop}>
          {summary && (
            <View style={styles.summarySheet}>
              <Text style={styles.summaryKicker}>
                run saved · today {summary.timeLabel}
              </Text>
              <Text style={styles.summaryHero}>
                {formatDistanceIn(summary.distanceMeters, unit)}
              </Text>
              <View style={styles.summaryStatsRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>
                    {formatTime(summary.duration)}
                  </Text>
                  <Text style={styles.summaryStatLabel}>time</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>
                    {formatPaceIn(summary.duration, summary.distanceMeters, unit)}
                  </Text>
                  <Text style={styles.summaryStatLabel}>pace</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>
                    {summary.calories > 0 ? summary.calories : "—"}
                  </Text>
                  <Text style={styles.summaryStatLabel}>kcal</Text>
                </View>
              </View>

              {summary.prs.map((pr) => (
                <View key={pr.label} style={styles.summaryPrRow}>
                  <Icon name="trophy" size={16} color={Theme.accent} />
                  <View style={styles.summaryPrText}>
                    <Text style={styles.summaryPrTitle}>
                      {pr.label} —{" "}
                      {pr.kind === "distance"
                        ? formatDistanceIn(pr.value, unit)
                        : formatTime(Math.round(pr.value))}
                    </Text>
                    {pr.previous != null && (
                      <Text style={styles.summaryPrPrev}>
                        previous{" "}
                        {pr.kind === "distance"
                          ? formatDistanceIn(pr.previous, unit)
                          : formatTime(Math.round(pr.previous))}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              {summary.goal && (
                <View
                  style={[
                    styles.summaryGoalRow,
                    summary.goal.reached && styles.summaryGoalRowReached,
                  ]}
                >
                  <Icon
                    name={summary.goal.reached ? "flag-checkered" : "flag-outline"}
                    size={16}
                    color={summary.goal.reached ? Theme.accent : Theme.textMuted}
                  />
                  <View style={styles.summaryPrText}>
                    <Text style={styles.summaryPrTitle}>{summary.goal.title}</Text>
                    <Text style={styles.summaryPrPrev}>{summary.goal.detail}</Text>
                  </View>
                </View>
              )}

              <View style={styles.summaryActions}>
                <TouchableOpacity
                  style={styles.summaryShareBtn}
                  onPress={() => {
                    setSummary(null);
                    openShare();
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name="share-variant" size={16} color={Theme.text} />
                  <Text style={styles.summaryShareText}>share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.summaryDoneBtn}
                  onPress={() => setSummary(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.summaryDoneText}>done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
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
    marginBottom: 8,
    lineHeight: 24,
  },
  permissionPrivacy: {
    fontSize: 13,
    color: Theme.textMuted,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
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
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    overflow: "hidden",
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
  countdownWrap: {
    alignItems: "center",
  },
  countdownValue: {
    fontSize: 96,
    fontWeight: "200",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  countdownLabel: {
    fontSize: 12,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 4,
  },
  heroTier: {
    flexDirection: "row",
    marginBottom: 22,
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
  },
  heroValue: {
    fontSize: 52,
    fontWeight: "200",
    color: Theme.text,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  heroLabel: {
    fontSize: 12,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 4,
  },
  secondTier: {
    flexDirection: "row",
    marginBottom: 18,
  },
  secondStat: {
    flex: 1,
    alignItems: "center",
  },
  secondValue: {
    fontSize: 26,
    fontWeight: "300",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  secondLabel: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 3,
  },
  derivedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
  },
  derivedItem: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  derivedValue: {
    color: Theme.text,
    fontSize: 13,
  },
  derivedDash: {
    color: Theme.textMuted,
    fontSize: 13,
  },
  derivedUnit: {
    color: Theme.textMuted,
    fontSize: 13,
  },
  goalContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    alignItems: "center",
    minHeight: 44,
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
  goalRail: {
    width: "100%",
  },
  goalRailLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  goalRailText: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  goalRailTextReached: {
    color: Theme.accent,
  },
  goalRailRight: {
    color: Theme.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  goalEditHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goalEditHintText: {
    color: Theme.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Theme.border,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Theme.accent,
    borderRadius: 2,
  },
  paceMarker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: Theme.textSecondary,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 2,
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
  holdWrap: {
    width: RING_RADIUS * 2 + 8,
    height: RING_RADIUS * 2 + 8,
    justifyContent: "center",
    alignItems: "center",
  },
  holdRing: {
    position: "absolute",
  },
  holdText: {
    color: Theme.white,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  holdHint: {
    textAlign: "center",
    fontSize: 11,
    color: Theme.textMuted,
    letterSpacing: 0.5,
    minHeight: 14,
    marginBottom: 8,
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
  goalInput: {
    color: Theme.text,
    fontSize: 14,
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontVariant: ["tabular-nums"],
  },
  unitTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Theme.surfaceLight,
  },
  unitTagText: {
    color: Theme.accent,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  unitSegment: {
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: Theme.surfaceLight,
    padding: 2,
  },
  unitSegmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  unitSegmentBtnActive: {
    backgroundColor: "rgba(0,217,255,0.15)",
  },
  unitSegmentText: {
    color: Theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  unitSegmentTextActive: {
    color: Theme.accent,
  },
  goalEditorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Theme.surfaceLight,
  },
  goalEditorBtnDisabled: {
    opacity: 0.35,
  },
  goalTimeRow: {
    marginTop: 8,
    alignSelf: "stretch",
  },
  goalTimeIcon: {
    marginLeft: 8,
  },
  goalTimeInput: {
    flex: 1,
  },
  goalTimeHint: {
    fontSize: 10,
    color: Theme.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  quickChipText: {
    color: Theme.textSecondary,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  summaryBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 24,
  },
  summarySheet: {
    backgroundColor: Theme.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 24,
  },
  summaryKicker: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  summaryHero: {
    fontSize: 44,
    fontWeight: "200",
    color: Theme.text,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 16,
    fontVariant: ["tabular-nums"],
  },
  summaryStatsRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: "400",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  summaryStatLabel: {
    fontSize: 10,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 3,
  },
  summaryPrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,217,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  summaryGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  summaryGoalRowReached: {
    backgroundColor: "rgba(0,217,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.25)",
  },
  summaryPrText: {
    flex: 1,
  },
  summaryPrTitle: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  summaryPrPrev: {
    color: Theme.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  summaryActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  summaryShareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surfaceLight,
  },
  summaryShareText: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryDoneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: Theme.accent,
  },
  summaryDoneText: {
    color: Theme.bg,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
