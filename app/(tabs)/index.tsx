import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
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

// Ignore specific MapLibre warnings
LogBox.ignoreLogs([
  "Request failed due to a permanent error: Canceled",
  "Mbgl-HttpRequest",
]);

const { width } = Dimensions.get("window");

// Types for MapLibre GeoJSON
interface RouteGeoJSON {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

export default function HomeScreen() {
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
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

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Location permission is needed to track your runs.",
          [{ text: "OK" }],
        );
      }
    })();
  }, []);

  const saveRun = useCallback(async () => {
    if (locations.length < 10) return; // Don't save very short runs

    try {
      const existingRuns = await AsyncStorage.getItem("runs");
      const runs = existingRuns ? JSON.parse(existingRuns) : [];

      const newRun = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        distance: distance,
        duration: elapsedTime,
        pace: pace,
        locations: locations.slice(-100), // Save last 100 points for map preview
      };

      runs.push(newRun);
      await AsyncStorage.setItem("runs", JSON.stringify(runs));

      // Optional: Show confirmation
      Alert.alert("Run Saved", "Your run has been saved to history.");
    } catch (error) {
      console.error("Error saving run:", error);
    }
  }, [distance, elapsedTime, pace, locations]);

  const handleStopTracking = useCallback(async () => {
    await stopTracking();
    await saveRun();
  }, [stopTracking, saveRun]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Convert locations to GeoJSON format for MapLibre
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

  // Follow user location when tracking using Camera ref
  useEffect(() => {
    if (isTracking && locations.length > 0 && cameraRef.current) {
      const lastLoc = locations[locations.length - 1];
      cameraRef.current.setCamera({
        centerCoordinate: [lastLoc.longitude, lastLoc.latitude],
        zoomLevel: 16,
        animationDuration: 1000,
        // animationMode is now optional, defaults to CameraMode.None
      });
    }
  }, [locations, isTracking]);

  const routeData = routeGeoJSON();

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerContainer}>
          <Icon name="map-marker-off" size={64} color="#E74C3C" />
          <Text style={styles.permissionText}>
            Location permission is required to track runs.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              const { status } =
                await Location.requestForegroundPermissionsAsync();
              setPermissionGranted(status === "granted");
            }}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Icon name="run" size={32} color="#2C3E50" />
          <Text style={styles.headerTitle}>tracker</Text>
          <TouchableOpacity
            onPress={() => setShowDebug(!showDebug)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={showDebug ? "code-braces" : "code-braces"}
              size={24}
              color="#95A5A6"
            />
          </TouchableOpacity>
        </View>

        {/* Map with v10+ API */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            mapStyle="https://demotiles.maplibre.org/style.json" // styleURL is now mapStyle
            attributionEnabled={false}
            logoEnabled={false}
            onDidFinishLoadingMap={() => {
              console.log("Map loaded successfully");
              setMapError(null);
            }}
          >
            {/* Camera for controlling view - with explicit animation settings */}
            <Camera
              ref={cameraRef}
              followUserLocation={isTracking}
              followZoomLevel={16}
              animationDuration={1000}
              animationMode="easeTo" // Explicitly set animation mode
              minZoomLevel={5}
              maxZoomLevel={20}
            />

            {/* User location dot */}
            <UserLocation visible={true} showsUserHeadingIndicator={true} />

            {/* Running route */}
            {routeData && (
              <ShapeSource id="routeSource" shape={routeData}>
                <LineLayer
                  id="routeLine"
                  style={{
                    lineColor: "#E74C3C",
                    lineWidth: 4,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              </ShapeSource>
            )}
          </MapView>

          {/* Map error overlay */}
          {mapError && (
            <View style={styles.mapErrorOverlay}>
              <Icon name="map-outline" size={20} color="#E74C3C" />
              <Text style={styles.mapErrorText}>{mapError}</Text>
            </View>
          )}

          {/* Status indicator */}
          <View style={styles.mapStatus}>
            <View
              style={[
                styles.statusDot,
                isTracking ? styles.activeDot : styles.inactiveDot,
              ]}
            />
            <Text style={styles.statusText}>
              {isTracking ? "recording" : "paused"}
            </Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Icon name="clock-outline" size={20} color="#7F8C8D" />
            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="map-marker-distance" size={20} color="#7F8C8D" />
            <Text style={styles.statValue}>{formattedDistance || "0m"}</Text>
            <Text style={styles.statLabel}>distance</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="speedometer" size={20} color="#7F8C8D" />
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>pace</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="lightning-bolt" size={20} color="#7F8C8D" />
            <Text style={styles.statValue}>{averageSpeed.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
        </View>

        {/* Additional Info */}
        <View style={styles.infoRow}>
          <Icon name="map-marker-path" size={16} color="#95A5A6" />
          <Text style={styles.infoText}>
            {locations.length} point{locations.length !== 1 ? "s" : ""} recorded
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetTracking}
            activeOpacity={0.7}
            disabled={isTracking}
          >
            <Icon
              name="refresh"
              size={20}
              color={isTracking ? "#BDC3C7" : "#7F8C8D"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.mainButton,
              isTracking ? styles.stopButton : styles.startButton,
            ]}
            onPress={isTracking ? handleStopTracking : startTracking}
            activeOpacity={0.7}
          >
            <Icon
              name={isTracking ? "stop" : "play"}
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.mainButtonText}>
              {isTracking ? "stop" : "start"}
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonPlaceholder} />
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={16} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Debug Section */}
        {showDebug && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>debug info</Text>

            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>tracking active:</Text>
              <Text style={styles.debugValue}>{isTracking.toString()}</Text>
            </View>

            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>raw distance (m):</Text>
              <Text style={styles.debugValue}>{distance.toFixed(2)}</Text>
            </View>

            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>raw time (s):</Text>
              <Text style={styles.debugValue}>{elapsedTime}</Text>
            </View>

            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>points recorded:</Text>
              <Text style={styles.debugValue}>{locations.length}</Text>
            </View>

            {locations.length > 0 && (
              <>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>last point:</Text>
                  <Text style={styles.debugValue}>
                    {locations[locations.length - 1].latitude.toFixed(4)},
                    {locations[locations.length - 1].longitude.toFixed(4)}
                  </Text>
                </View>

                {locations[locations.length - 1].speed != null && (
                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>current speed:</Text>
                    <Text style={styles.debugValue}>
                      {(
                        (locations[locations.length - 1].speed ?? 0) * 3.6
                      ).toFixed(1)}
                      km/h
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    padding: 16,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: 1,
    color: "#2C3E50",
    textTransform: "lowercase",
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  map: {
    flex: 1,
  },
  mapErrorOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FADBD8",
  },
  mapErrorText: {
    fontSize: 12,
    color: "#E74C3C",
    marginLeft: 4,
  },
  mapStatus: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeDot: {
    backgroundColor: "#E74C3C",
  },
  inactiveDot: {
    backgroundColor: "#95A5A6",
  },
  statusText: {
    fontSize: 12,
    color: "#7F8C8D",
    textTransform: "lowercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: (width - 48) / 2,
    backgroundColor: "#F8F9F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "300",
    color: "#2C3E50",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#95A5A6",
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 14,
    color: "#7F8C8D",
    marginLeft: 8,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPlaceholder: {
    width: 60,
    height: 60,
  },
  mainButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    flexDirection: "row",
    backgroundColor: "#2C3E50",
  },
  startButton: {
    backgroundColor: "#2C3E50",
  },
  stopButton: {
    backgroundColor: "#E74C3C",
  },
  resetButton: {
    backgroundColor: "#F8F9F9",
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  mainButtonText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 16,
    fontWeight: "400",
    textTransform: "lowercase",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF1F0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FADBD8",
  },
  errorText: {
    color: "#E74C3C",
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
    flexWrap: "wrap",
  },
  debugContainer: {
    backgroundColor: "#F8F9F9",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2C3E50",
    marginBottom: 12,
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  debugLabel: {
    fontSize: 13,
    color: "#7F8C8D",
  },
  debugValue: {
    fontSize: 13,
    color: "#2C3E50",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: "#2C3E50",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: "#2C3E50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
});
