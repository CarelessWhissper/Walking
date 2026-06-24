import React, { useCallback, useState } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Theme } from "@/constants/theme";
import { SavedRun, loadRuns } from "@/config/runs";
import { computeRecords, Records } from "@/config/records";
import { buildHeatmap, computeStreaks, HeatCell } from "@/config/stats";

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDistance(meters: number): string {
  if (meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatLongDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const HEAT_WEEKS = 16;

function heatColor(distance: number): string {
  if (distance <= 0) return Theme.surface;
  if (distance < 2000) return "rgba(0,217,255,0.25)";
  if (distance < 5000) return "rgba(0,217,255,0.45)";
  if (distance < 10000) return "rgba(0,217,255,0.7)";
  return Theme.accent;
}

export default function StatsScreen() {
  const [records, setRecords] = useState<Records | null>(null);
  const [streaks, setStreaks] = useState({ current: 0, longest: 0 });
  const [heatmap, setHeatmap] = useState<HeatCell[][]>([]);
  const [hasRuns, setHasRuns] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const runs: SavedRun[] = await loadRuns();
        setHasRuns(runs.length > 0);
        setRecords(computeRecords(runs));
        setStreaks(computeStreaks(runs));
        setHeatmap(buildHeatmap(runs, HEAT_WEEKS));
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {!hasRuns ? (
          <View style={styles.empty}>
            <Icon name="trophy-outline" size={48} color={Theme.textMuted} />
            <Text style={styles.emptyText}>No data yet</Text>
            <Text style={styles.emptySub}>
              Finish a run to start building records and streaks.
            </Text>
          </View>
        ) : (
          <>
            {/* Streaks */}
            <View style={styles.streakRow}>
              <View style={styles.streakCard}>
                <Icon name="fire" size={22} color={Theme.accent} />
                <Text style={styles.streakValue}>{streaks.current}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>
              <View style={styles.streakCard}>
                <Icon name="trophy" size={20} color={Theme.textSecondary} />
                <Text style={styles.streakValue}>{streaks.longest}</Text>
                <Text style={styles.streakLabel}>longest streak</Text>
              </View>
            </View>

            {/* Personal records */}
            <Text style={styles.sectionTitle}>Personal Records</Text>
            <View style={styles.recordGrid}>
              <RecordCard
                icon="speedometer"
                label="Fastest 1K"
                value={formatDuration(records?.fastest1k ?? null)}
              />
              <RecordCard
                icon="speedometer-medium"
                label="Fastest 5K"
                value={formatLongDuration(records?.fastest5k ?? 0)}
              />
              <RecordCard
                icon="speedometer-slow"
                label="Fastest 10K"
                value={formatLongDuration(records?.fastest10k ?? 0)}
              />
              <RecordCard
                icon="map-marker-distance"
                label="Longest run"
                value={formatDistance(records?.longestDistance ?? 0)}
              />
              <RecordCard
                icon="clock-outline"
                label="Longest time"
                value={formatLongDuration(records?.longestDuration ?? 0)}
              />
            </View>

            {/* Activity heatmap */}
            <Text style={styles.sectionTitle}>Last {HEAT_WEEKS} weeks</Text>
            <View style={styles.heatmap}>
              {heatmap.map((week, wi) => (
                <View key={wi} style={styles.heatWeek}>
                  {week.map((cell) => (
                    <View
                      key={cell.key}
                      style={[
                        styles.heatCell,
                        { backgroundColor: heatColor(cell.distance) },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <Text style={styles.legendText}>less</Text>
              <View
                style={[styles.legendCell, { backgroundColor: Theme.surface }]}
              />
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.25)" },
                ]}
              />
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.45)" },
                ]}
              />
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.7)" },
                ]}
              />
              <View
                style={[styles.legendCell, { backgroundColor: Theme.accent }]}
              />
              <Text style={styles.legendText}>more</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.recordCard}>
      <Icon name={icon} size={18} color={Theme.accent} />
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 16) + 8 : 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", color: Theme.text },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.textSecondary,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: Theme.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  streakRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  streakCard: {
    flex: 1,
    backgroundColor: Theme.surface,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    gap: 4,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: "200",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  streakLabel: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 13,
    color: Theme.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  recordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  recordCard: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: Theme.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 6,
  },
  recordValue: {
    fontSize: 18,
    fontWeight: "500",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  recordLabel: {
    fontSize: 10,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  heatmap: { flexDirection: "row", gap: 4, justifyContent: "space-between" },
  heatWeek: { gap: 4, flex: 1 },
  heatCell: { width: "100%", aspectRatio: 1, borderRadius: 3 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, color: Theme.textMuted, marginHorizontal: 4 },
});
