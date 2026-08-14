import { confirm } from "@/components/ConfirmSheet";
import { RouteTrace } from "@/components/RouteTrace";
import { ShareCardData } from "@/components/ShareCard";
import { setPendingShare } from "@/components/shareState";
import { toast } from "@/components/Toast";
import { Theme } from "@/constants/theme";
import {
  DistanceUnit,
  distanceValueIn,
  formatDistanceIn,
  formatPaceIn,
  loadDistanceUnit,
  paceUnitLabel,
} from "@/config/format";
import { SavedRun, loadRuns, saveRuns } from "@/config/runs";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

type Period = "week" | "month" | "all";

export default function HistoryScreen() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("all");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [menuFor, setMenuFor] = useState<SavedRun | null>(null);
  const router = useRouter();

  const refreshRuns = async () => {
    const [parsedRuns, savedUnit] = await Promise.all([
      loadRuns(),
      loadDistanceUnit(),
    ]);
    setRuns(parsedRuns);
    setUnit(savedUnit);
  };

  useFocusEffect(
    useCallback(() => {
      refreshRuns();
    }, []),
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const deleteRun = async (run: SavedRun) => {
    setMenuFor(null);
    const ok = await confirm({
      title: "Delete this run?",
      message: "This permanently removes the run from your history.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const updatedRuns = runs.filter((r) => r.id !== run.id);
    await saveRuns(updatedRuns);
    setRuns(updatedRuns);
    toast.info("Run deleted");
  };

  const filterRunsByPeriod = (): SavedRun[] => {
    if (selectedPeriod === "all") return runs;
    const cutoff = new Date();
    if (selectedPeriod === "week") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return runs.filter((run) => new Date(run.date) >= cutoff);
  };

  const filteredRuns = filterRunsByPeriod();
  const periods: Period[] = ["week", "month", "all"];

  // Summary over the *filtered* set, labeled with its window (A5)
  const totalDist = filteredRuns.reduce((sum, run) => sum + run.distance, 0);
  const totalDur = filteredRuns.reduce((sum, run) => sum + run.duration, 0);
  const totalCals = filteredRuns.reduce(
    (sum, run) => sum + (run.calories || 0),
    0,
  );
  const avgPace = formatPaceIn(totalDur, totalDist, unit);
  const periodLabel =
    selectedPeriod === "week"
      ? "this week"
      : selectedPeriod === "month"
        ? "this month"
        : "all time";

  const handleShareRun = useCallback(
    (item: SavedRun) => {
      setMenuFor(null);
      const normalizedLocations = Array.isArray(item.locations)
        ? item.locations
            .map((l: any) => ({
              latitude: l?.latitude ?? l?.lat,
              longitude: l?.longitude ?? l?.lng ?? l?.lon,
            }))
            .filter(
              (l) =>
                typeof l.latitude === "number" &&
                typeof l.longitude === "number",
            )
        : undefined;

      const data: ShareCardData = {
        distance: distanceValueIn(item.distance, unit),
        duration: formatTime(item.duration),
        pace: formatPaceIn(item.duration, item.distance, unit),
        date: new Date(item.date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        calories: item.calories,
        cadence: item.cadence,
        locations: normalizedLocations,
        unit,
      };

      setPendingShare(data);
      router.push("/share");
    },
    [router, unit],
  );

  const renderSwipeDelete = (item: SavedRun) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => deleteRun(item)}
      activeOpacity={0.8}
    >
      <Icon name="trash-can-outline" size={20} color={Theme.white} />
    </TouchableOpacity>
  );

  // Metric with the unit as a muted suffix so the numbers align as numbers (A2)
  const Metric = ({ value, suffix }: { value: string; suffix?: string }) => (
    <Text style={styles.runMetricValue}>
      {value}
      {suffix ? <Text style={styles.runMetricSuffix}> {suffix}</Text> : null}
    </Text>
  );

  const renderRunItem = ({ item }: { item: SavedRun }) => {
    const distParts = formatDistanceIn(item.distance, unit).split(" ");
    const extras = [
      item.calories != null && item.calories > 0 ? `${item.calories} kcal` : null,
      item.cadence != null && item.cadence > 0 ? `${item.cadence} spm` : null,
      item.stepCount != null && item.stepCount > 0
        ? `${item.stepCount.toLocaleString()} steps`
        : null,
    ].filter(Boolean);

    return (
      <ReanimatedSwipeable
        renderRightActions={() => renderSwipeDelete(item)}
        overshootRight={false}
        containerStyle={styles.swipeContainer}
      >
        <TouchableOpacity
          style={styles.runCard}
          onPress={() =>
            router.push({ pathname: "/run/[id]", params: { id: item.id } })
          }
          onLongPress={() => deleteRun(item)}
          activeOpacity={0.7}
        >
          <RouteTrace locations={item.locations} size={56} />

          <View style={styles.runContent}>
            <View style={styles.runHeader}>
              <Text style={styles.runDate}>
                {formatDate(item.date)}
                <Text style={styles.runTime}>
                  {"  ·  "}
                  {new Date(item.date).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Text>
              <TouchableOpacity
                onPress={() => setMenuFor(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="dots-horizontal" size={18} color={Theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.runMetrics}>
              <Metric value={distParts[0]} suffix={distParts[1]} />
              <Metric value={formatTime(item.duration)} />
              <Metric
                value={formatPaceIn(item.duration, item.distance, unit)}
                suffix={paceUnitLabel(unit)}
              />
            </View>

            {extras.length > 0 && (
              <Text style={styles.runExtrasLine}>{extras.join("  ·  ")}</Text>
            )}
          </View>
        </TouchableOpacity>
      </ReanimatedSwipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Period filter pills — filter first, then a summary that names its window (A5) */}
      <View style={styles.filterRow}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.filterPill,
              selectedPeriod === period && styles.filterPillActive,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.filterText,
                selectedPeriod === period && styles.filterTextActive,
              ]}
            >
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary stats over the filtered window */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryPeriodLabel}>
          {periodLabel} · {filteredRuns.length}{" "}
          {filteredRuns.length === 1 ? "run" : "runs"}
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {distanceValueIn(totalDist, unit)}
            </Text>
            <Text style={styles.summaryLabel}>{unit}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgPace}</Text>
            <Text style={styles.summaryLabel}>avg pace</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {totalCals > 0 ? totalCals.toLocaleString() : "—"}
            </Text>
            <Text style={styles.summaryLabel}>kcal</Text>
          </View>
        </View>
      </View>

      {/* Runs */}
      {filteredRuns.length > 0 ? (
        <FlatList
          data={filteredRuns}
          renderItem={renderRunItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          {/* Ghost run card so the shape of the eventual content is visible (A6) */}
          <View style={styles.ghostCard}>
            <View style={styles.ghostTile} />
            <View style={styles.ghostContent}>
              <View style={[styles.ghostLine, { width: 90 }]} />
              <View style={styles.ghostMetrics}>
                <View style={[styles.ghostLine, styles.ghostNumber]} />
                <View style={[styles.ghostLine, styles.ghostNumber]} />
                <View style={[styles.ghostLine, styles.ghostNumber]} />
              </View>
            </View>
          </View>
          <Text style={styles.emptyText}>
            {runs.length === 0
              ? "Your first run starts on the Track tab"
              : `No runs ${periodLabel}`}
          </Text>
        </View>
      )}

      {/* Card overflow menu (B2) */}
      <Modal
        visible={menuFor != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuFor(null)}>
          <View style={styles.menuSheet}>
            {menuFor && (
              <Text style={styles.menuTitle}>
                {formatDate(menuFor.date)} ·{" "}
                {formatDistanceIn(menuFor.distance, unit)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuFor && handleShareRun(menuFor)}
              activeOpacity={0.7}
            >
              <Icon name="share-variant" size={18} color={Theme.text} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuFor && deleteRun(menuFor)}
              activeOpacity={0.7}
            >
              <Icon name="trash-can-outline" size={18} color={Theme.danger} />
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 16) + 8 : 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Theme.text,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Theme.surface,
  },
  filterPillActive: {
    backgroundColor: Theme.accent,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textSecondary,
    textTransform: "capitalize",
  },
  filterTextActive: {
    color: Theme.bg,
  },
  summaryCard: {
    marginHorizontal: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Theme.surface,
    borderRadius: 16,
    marginBottom: 20,
  },
  summaryPeriodLabel: {
    fontSize: 10,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontVariant: ["tabular-nums"],
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  swipeContainer: {
    marginBottom: 10,
  },
  swipeDelete: {
    width: 64,
    marginLeft: 10,
    borderRadius: 14,
    backgroundColor: Theme.dangerDim,
    justifyContent: "center",
    alignItems: "center",
  },
  runCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Theme.surface,
    borderRadius: 14,
    padding: 14,
  },
  runContent: {
    flex: 1,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  runDate: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.text,
  },
  runTime: {
    fontSize: 12,
    fontWeight: "400",
    color: Theme.textMuted,
  },
  runMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  runMetricValue: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  runMetricSuffix: {
    fontSize: 11,
    fontWeight: "400",
    color: Theme.textMuted,
  },
  runExtrasLine: {
    marginTop: 8,
    fontSize: 11,
    color: Theme.textSecondary,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  ghostCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    alignSelf: "stretch",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Theme.border,
  },
  ghostTile: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Theme.border,
  },
  ghostContent: {
    flex: 1,
    gap: 12,
  },
  ghostLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.surfaceLight,
  },
  ghostMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ghostNumber: {
    width: 48,
    height: 14,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.textSecondary,
    marginTop: 20,
    textAlign: "center",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    padding: 16,
  },
  menuSheet: {
    backgroundColor: Theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Theme.border,
    paddingVertical: 8,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 12,
    color: Theme.textMuted,
    paddingHorizontal: 18,
    paddingVertical: 10,
    letterSpacing: 0.3,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: Theme.text,
    fontWeight: "500",
  },
  menuItemDanger: {
    color: Theme.danger,
  },
});
