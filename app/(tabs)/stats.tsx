import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
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
import {
  DistanceUnit,
  formatDistanceIn,
  distanceValueIn,
  loadDistanceUnit,
} from "@/config/format";

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

function heatColor(distance: number): string | null {
  if (distance <= 0) return null; // rest day — outlined, not filled
  if (distance < 2000) return "rgba(0,217,255,0.25)";
  if (distance < 5000) return "rgba(0,217,255,0.45)";
  if (distance < 10000) return "rgba(0,217,255,0.7)";
  return Theme.accent;
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const WEEKDAY_LABELS: Record<number, string> = { 1: "M", 3: "W", 5: "F" };

export default function StatsScreen() {
  const [records, setRecords] = useState<Records | null>(null);
  const [streaks, setStreaks] = useState({ current: 0, longest: 0 });
  const [heatmap, setHeatmap] = useState<HeatCell[][]>([]);
  const [hasRuns, setHasRuns] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [selectedDay, setSelectedDay] = useState<HeatCell | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [runs, savedUnit]: [SavedRun[], DistanceUnit] = await Promise.all([
          loadRuns(),
          loadDistanceUnit(),
        ]);
        setHasRuns(runs.length > 0);
        setRecords(computeRecords(runs));
        setStreaks(computeStreaks(runs));
        setHeatmap(buildHeatmap(runs, HEAT_WEEKS));
        setUnit(savedUnit);
        setSelectedDay(null);
      })();
    }, []),
  );

  // Totals over the heatmap window for the section header (A3)
  const windowRuns = heatmap.flat().reduce((sum, c) => sum + c.count, 0);
  const windowDist = heatmap.flat().reduce((sum, c) => sum + c.distance, 0);

  // Bucket labels; 2/5/10 km ≈ the familiar 1.2/3.1/6.2 mi
  const buckets =
    unit === "mi"
      ? ["rest", "<1.2 mi", "<3.1", "<6.2", "6.2 mi+"]
      : ["rest", "<2 km", "<5", "<10", "10 km+"];

  const monthLabelFor = (wi: number): string => {
    if (heatmap.length === 0) return "";
    const month = heatmap[wi][0].date.getMonth();
    if (wi === 0) return "";
    const prevMonth = heatmap[wi - 1][0].date.getMonth();
    return month !== prevMonth ? MONTH_INITIALS[month] : "";
  };

  const toggleDay = (cell: HeatCell) => {
    setSelectedDay((prev) => (prev?.key === cell.key ? null : cell));
  };

  const readoutLabel = selectedDay
    ? `${selectedDay.date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })} · ${
        selectedDay.count > 0
          ? `${formatDistanceIn(selectedDay.distance, unit)} · ${selectedDay.count} ${selectedDay.count === 1 ? "run" : "runs"}`
          : "rest day"
      }`
    : " ";

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
              Records and streaks appear after your first run.
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

            {/* Personal records — split PRs as comparable rows, longest pair 2-up (A7) */}
            <Text style={styles.sectionTitle}>Personal Records</Text>
            <View style={styles.recordRows}>
              <RecordRow
                icon="speedometer"
                label="Fastest 1K"
                value={
                  records?.fastest1k != null
                    ? formatDuration(records.fastest1k)
                    : null
                }
                nudge="run 1 km to set this"
              />
              <RecordRow
                icon="speedometer-medium"
                label="Fastest 5K"
                value={
                  records?.fastest5k != null
                    ? formatLongDuration(records.fastest5k)
                    : null
                }
                nudge="run 5 km to set this"
              />
              <RecordRow
                icon="speedometer-slow"
                label="Fastest 10K"
                value={
                  records?.fastest10k != null
                    ? formatLongDuration(records.fastest10k)
                    : null
                }
                nudge="run 10 km to set this"
              />
            </View>
            <View style={styles.recordPair}>
              <RecordCard
                icon="map-marker-distance"
                label="Longest run"
                value={
                  (records?.longestDistance ?? 0) > 0
                    ? formatDistanceIn(records!.longestDistance, unit)
                    : "—"
                }
              />
              <RecordCard
                icon="clock-outline"
                label="Longest time"
                value={formatLongDuration(records?.longestDuration ?? 0)}
              />
            </View>

            {/* Activity heatmap with axes and a readout (A3, B6) */}
            <View style={styles.heatHeader}>
              <Text style={styles.sectionTitle}>Last {HEAT_WEEKS} weeks</Text>
              <Text style={styles.heatTotals}>
                {windowRuns} {windowRuns === 1 ? "run" : "runs"} ·{" "}
                {distanceValueIn(windowDist, unit)} {unit}
              </Text>
            </View>

            {/* Month initials row */}
            <View style={styles.monthRow}>
              <View style={styles.weekdayGutter} />
              {heatmap.map((_, wi) => (
                <Text key={wi} style={styles.monthLabel}>
                  {monthLabelFor(wi)}
                </Text>
              ))}
            </View>

            <View style={styles.heatBody}>
              {/* Weekday initials gutter (M/W/F) */}
              <View style={[styles.weekdayGutter, styles.weekdayColumn]}>
                {Array.from({ length: 7 }, (_, day) => (
                  <View key={day} style={styles.weekdayCell}>
                    <Text style={styles.weekdayLabel}>
                      {WEEKDAY_LABELS[day] ?? ""}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.heatmap}>
                {heatmap.map((week, wi) => (
                  <View key={wi} style={styles.heatWeek}>
                    {week.map((cell) => {
                      const fill = heatColor(cell.distance);
                      const selected = selectedDay?.key === cell.key;
                      return (
                        <Pressable
                          key={cell.key}
                          onPress={() => toggleDay(cell)}
                          style={[
                            styles.heatCell,
                            fill
                              ? { backgroundColor: fill }
                              : styles.heatCellRest,
                            selected && styles.heatCellSelected,
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* Fixed readout line — nothing navigates, nothing opens (B6) */}
            <Text style={styles.heatReadout}>{readoutLabel}</Text>

            {/* Legend that names its buckets */}
            <View style={styles.legend}>
              <View style={[styles.legendCell, styles.heatCellRest]} />
              <Text style={styles.legendText}>{buckets[0]}</Text>
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.25)" },
                ]}
              />
              <Text style={styles.legendText}>{buckets[1]}</Text>
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.45)" },
                ]}
              />
              <Text style={styles.legendText}>{buckets[2]}</Text>
              <View
                style={[
                  styles.legendCell,
                  { backgroundColor: "rgba(0,217,255,0.7)" },
                ]}
              />
              <Text style={styles.legendText}>{buckets[3]}</Text>
              <View
                style={[styles.legendCell, { backgroundColor: Theme.accent }]}
              />
              <Text style={styles.legendText}>{buckets[4]}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordRow({
  icon,
  label,
  value,
  nudge,
}: {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  value: string | null;
  nudge: string;
}) {
  return (
    <View style={styles.recordRow}>
      <Icon
        name={icon}
        size={16}
        color={value != null ? Theme.accent : Theme.textMuted}
      />
      <Text style={styles.recordRowLabel}>{label}</Text>
      {value != null ? (
        <Text style={styles.recordRowValue}>{value}</Text>
      ) : (
        <Text style={styles.recordNudge}>{nudge}</Text>
      )}
    </View>
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
  recordRows: {
    backgroundColor: Theme.surface,
    borderRadius: 14,
    marginBottom: 10,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recordRowLabel: {
    flex: 1,
    fontSize: 13,
    color: Theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recordRowValue: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  recordNudge: {
    fontSize: 9,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  recordPair: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  recordCard: {
    flex: 1,
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
  heatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  heatTotals: {
    fontSize: 11,
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  monthRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  monthLabel: {
    flex: 1,
    fontSize: 9,
    color: Theme.textMuted,
    textAlign: "center",
  },
  heatBody: {
    flexDirection: "row",
    gap: 4,
  },
  weekdayGutter: {
    width: 12,
  },
  weekdayColumn: {
    gap: 4,
  },
  weekdayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: "center",
  },
  weekdayLabel: {
    fontSize: 9,
    color: Theme.textMuted,
  },
  heatmap: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
  },
  heatWeek: { gap: 4, flex: 1 },
  heatCell: { width: "100%", aspectRatio: 1, borderRadius: 3 },
  heatCellRest: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Theme.border,
  },
  heatCellSelected: {
    borderWidth: 1,
    borderColor: Theme.accent,
  },
  heatReadout: {
    marginTop: 10,
    minHeight: 16,
    fontSize: 12,
    color: Theme.textSecondary,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
  legendText: {
    fontSize: 10,
    color: Theme.textMuted,
    marginRight: 6,
    marginLeft: 2,
  },
});
