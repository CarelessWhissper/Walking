import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
} from "@maplibre/maplibre-react-native";
import { Theme } from "@/constants/theme";
import { DARK_MAP_STYLE } from "@/config/mapStyle";
import { getRun, SavedRun } from "@/config/runs";
import { formatPaceFromSeconds } from "@/config/locationTracker";
import {
  DistanceUnit,
  formatDistanceIn,
  formatPaceIn,
  loadDistanceUnit,
  paceUnitLabel,
} from "@/config/format";

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<SavedRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<DistanceUnit>("km");

  useEffect(() => {
    (async () => {
      const [loaded, savedUnit] = await Promise.all([
        id ? getRun(id) : Promise.resolve(null),
        loadDistanceUnit(),
      ]);
      setRun(loaded);
      setUnit(savedUnit);
      setLoading(false);
    })();
  }, [id]);

  const route = useMemo(() => run?.locations ?? [], [run]);

  const bounds = useMemo(() => {
    if (route.length < 2) return null;
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const p of route) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [route]);

  const routeGeoJSON = useMemo(() => {
    if (route.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [route]);

  // Bars scale to the run's own range (±10% padding) so the shape of the run
  // appears — negative split, fade, hills (A8).
  const splits = run?.splits ?? [];
  const maxSplit = splits.length > 0 ? Math.max(...splits) : 0;
  const fastestSplit = splits.length > 0 ? Math.min(...splits) : 0;
  const splitPad = Math.max((maxSplit - fastestSplit) * 0.1, 1);
  const splitFloor = fastestSplit - splitPad;
  const splitRange = maxSplit + splitPad - splitFloor;

  const dateLabel = run
    ? new Date(run.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const timeLabel = run
    ? new Date(run.date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevron-left" size={28} color={Theme.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerDate}>{dateLabel}</Text>
          <Text style={styles.headerTime}>{timeLabel}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : !run ? (
        <View style={styles.center}>
          <Icon name="run-fast" size={48} color={Theme.textMuted} />
          <Text style={styles.muted}>Run not found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Route map */}
          <View style={styles.mapCard}>
            {routeGeoJSON ? (
              <MapView
                style={styles.map}
                mapStyle={DARK_MAP_STYLE as any}
                attributionEnabled={false}
                logoEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                {bounds && (
                  <Camera
                    bounds={{
                      ...bounds,
                      paddingTop: 40,
                      paddingBottom: 40,
                      paddingLeft: 40,
                      paddingRight: 40,
                    }}
                    animationDuration={0}
                  />
                )}
                <ShapeSource id="detailRoute" shape={routeGeoJSON}>
                  <LineLayer
                    id="detailRouteLine"
                    style={{
                      lineColor: Theme.accent,
                      lineWidth: 4,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                </ShapeSource>
              </MapView>
            ) : (
              <View style={[styles.map, styles.mapEmpty]}>
                <Icon name="map-marker-off" size={32} color={Theme.textMuted} />
                <Text style={styles.muted}>No route recorded</Text>
              </View>
            )}
          </View>

          {/* Hero distance */}
          <View style={styles.hero}>
            <Text style={styles.heroValue}>
              {formatDistanceIn(run.distance, unit)}
            </Text>
            <Text style={styles.heroLabel}>distance</Text>
          </View>

          {/* Stat grid */}
          <View style={styles.statGrid}>
            <Stat label="Duration" value={formatTime(run.duration)} />
            <Stat
              label={`Pace ${paceUnitLabel(unit)}`}
              value={formatPaceIn(run.duration, run.distance, unit)}
            />
            {run.calories != null && run.calories > 0 && (
              <Stat label="Calories" value={`${run.calories}`} />
            )}
            {run.cadence != null && run.cadence > 0 && (
              <Stat label="Cadence" value={`${run.cadence} spm`} />
            )}
            {run.stepCount != null && run.stepCount > 0 && (
              <Stat label="Steps" value={run.stepCount.toLocaleString()} />
            )}
          </View>

          {/* Splits */}
          {splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.sectionTitle}>Splits · per km</Text>
              {splits.map((seconds, i) => {
                const width =
                  splitRange > 0
                    ? ((seconds - splitFloor) / splitRange) * 100
                    : 50;
                const isFastest = seconds === fastestSplit && splits.length > 1;
                return (
                  <View key={i} style={styles.splitRow}>
                    <Text style={styles.splitKm}>{i + 1}</Text>
                    <View style={styles.splitBarTrack}>
                      <View
                        style={[
                          styles.splitBar,
                          { width: `${Math.min(Math.max(width, 4), 100)}%` },
                          isFastest && styles.splitBarFastest,
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.splitPace,
                        isFastest && styles.splitPaceFastest,
                      ]}
                    >
                      {formatPaceFromSeconds(seconds)}
                    </Text>
                  </View>
                );
              })}
              {splits.length > 1 && (
                <View style={styles.splitRangeRow}>
                  <Text style={styles.splitRangeText}>
                    fastest {formatPaceFromSeconds(fastestSplit)}
                  </Text>
                  <Text style={styles.splitRangeText}>
                    slowest {formatPaceFromSeconds(maxSplit)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: { flex: 1, alignItems: "center" },
  headerDate: { color: Theme.text, fontSize: 15, fontWeight: "600" },
  headerTime: { color: Theme.textMuted, fontSize: 12, marginTop: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  muted: { color: Theme.textMuted, fontSize: 14 },
  scroll: { paddingBottom: 32 },
  mapCard: {
    height: 240,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  map: { flex: 1 },
  mapEmpty: { justifyContent: "center", alignItems: "center", gap: 8 },
  hero: { alignItems: "center", marginTop: 24, marginBottom: 8 },
  heroValue: {
    fontSize: 44,
    fontWeight: "200",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  heroLabel: {
    fontSize: 12,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: Theme.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "500",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 10,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  splitsSection: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: {
    fontSize: 13,
    color: Theme.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  splitKm: {
    width: 20,
    fontSize: 13,
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  splitBarTrack: {
    flex: 1,
    height: 22,
    backgroundColor: Theme.surface,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "center",
  },
  splitBar: {
    height: "100%",
    backgroundColor: Theme.surfaceLight,
    borderRadius: 6,
  },
  splitBarFastest: { backgroundColor: "rgba(0,217,255,0.35)" },
  splitPace: {
    width: 52,
    fontSize: 13,
    color: Theme.text,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  splitPaceFastest: { color: Theme.accent, fontWeight: "600" },
  splitRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 32,
  },
  splitRangeText: {
    fontSize: 11,
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
});
