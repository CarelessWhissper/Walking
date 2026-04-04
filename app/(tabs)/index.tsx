import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  StatusBar,
  LogBox,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocationTracker } from "@/hooks/useLocationTracker";
import { LocationCoords } from "@/config/locationTracker";
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
import { ShareCard, ShareCardData } from "@/components/ShareCard";
import { useShareRun } from "@/hooks/useShareRun";

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

export default function HomeScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useRasterFallback, setUseRasterFallback] = useState(false);
  const [userWeight, setUserWeight] = useState(DEFAULT_WEIGHT_KG);
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
  const { cardRef, share, isSharing } = useShareRun();

  // Build share card data from current run state
  const shareData: ShareCardData = useMemo(() => ({
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
  }), [distance, elapsedTime, pace, calories, cadence]);

  // Load user weight preference
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("userWeight");
      if (saved) setUserWeight(parseFloat(saved));
    })();
  }, []);

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
      const existingRuns = await AsyncStorage.getItem("runs");
      const runs = existingRuns ? JSON.parse(existingRuns) : [];

      const newRun = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        distance,
        duration: elapsedTime,
        pace,
        calories,
        cadence,
        stepCount,
        locations: locations.slice(-100),
      };

      runs.push(newRun);
      await AsyncStorage.setItem("runs", JSON.stringify(runs));
      Alert.alert("Run Saved", "Your run has been saved to history.");
    } catch (err) {
      console.error("Error saving run:", err);
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
            onPress={share}
            disabled={isSharing}
            activeOpacity={0.7}
          >
            <Icon
              name="share-variant"
              size={22}
              color={isSharing ? Theme.textMuted : Theme.accent}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Offscreen share card for capture */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={cardRef} data={shareData} />
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
    backgroundColor: "rgba(22,22,22,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  statusPillActive: {
    backgroundColor: "rgba(0,230,118,0.15)",
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
    backgroundColor: "rgba(22,22,22,0.85)",
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
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
});
