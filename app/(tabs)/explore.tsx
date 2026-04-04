import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StatusBar,
} from "react-native";
import React, { useState, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Theme } from "@/constants/theme";
import { ShareCard, ShareCardData } from "@/components/ShareCard";
import { useShareRun } from "@/hooks/useShareRun";

interface SavedRun {
  id: string;
  date: string;
  distance: number;
  duration: number;
  pace: string;
  calories?: number;
  cadence?: number;
  stepCount?: number;
  notes?: string;
  locations?: any[];
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("all");
  const [shareRunData, setShareRunData] = useState<ShareCardData | null>(null);
  const { cardRef, share, isSharing } = useShareRun();
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    avgPace: "0:00",
    totalCalories: 0,
  });

  const loadRuns = async () => {
    try {
      const savedRuns = await AsyncStorage.getItem("runs");
      if (savedRuns) {
        const parsedRuns = JSON.parse(savedRuns);
        setRuns(parsedRuns);
        calculateStats(parsedRuns);
      }
    } catch (err) {
      console.error("Error loading runs:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRuns();
    }, [])
  );

  const calculateStats = (runsData: SavedRun[]) => {
    if (runsData.length === 0) return;

    const totalDist = runsData.reduce((sum, run) => sum + run.distance, 0);
    const totalDur = runsData.reduce((sum, run) => sum + run.duration, 0);
    const totalCals = runsData.reduce((sum, run) => sum + (run.calories || 0), 0);

    const avgPaceMinPerKm = totalDist > 0 ? (totalDur / 60) / (totalDist / 1000) : 0;
    const avgMins = Math.floor(avgPaceMinPerKm);
    const avgSecs = Math.round((avgPaceMinPerKm - avgMins) * 60);

    setStats({
      totalDistance: totalDist,
      totalRuns: runsData.length,
      avgPace: `${avgMins}:${avgSecs.toString().padStart(2, "0")}`,
      totalCalories: totalCals,
    });
  };

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

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const deleteRun = (runId: string) => {
    Alert.alert("Delete Run", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updatedRuns = runs.filter((run) => run.id !== runId);
          await AsyncStorage.setItem("runs", JSON.stringify(updatedRuns));
          setRuns(updatedRuns);
          calculateStats(updatedRuns);
        },
      },
    ]);
  };

  const filterRunsByPeriod = (): SavedRun[] => {
    if (selectedPeriod === "all") return runs;
    const cutoff = new Date();
    if (selectedPeriod === "week") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return runs.filter((run) => new Date(run.date) >= cutoff);
  };

  const filteredRuns = filterRunsByPeriod();
  const periods: ("week" | "month" | "all")[] = ["week", "month", "all"];

  const handleShareRun = useCallback(async (item: SavedRun) => {
    const dist = item.distance >= 1000
      ? (item.distance / 1000).toFixed(2)
      : `0.${Math.round(item.distance).toString().padStart(3, "0")}`;

    const data: ShareCardData = {
      distance: dist,
      duration: formatTime(item.duration),
      pace: item.pace,
      date: new Date(item.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      calories: item.calories,
      cadence: item.cadence,
    };

    setShareRunData(data);
    // Wait a frame for the card to render, then capture
    requestAnimationFrame(() => {
      setTimeout(() => share(), 100);
    });
  }, [share]);

  const renderRunItem = ({ item }: { item: SavedRun }) => (
    <TouchableOpacity
      style={styles.runCard}
      onLongPress={() => deleteRun(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.runHeader}>
        <View>
          <Text style={styles.runDate}>{formatDate(item.date)}</Text>
          <Text style={styles.runTime}>
            {new Date(item.date).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleShareRun(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isSharing}
        >
          <Icon name="share-variant" size={18} color={Theme.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.runMetrics}>
        <View style={styles.runMetric}>
          <Text style={styles.runMetricValue}>{formatDistance(item.distance)}</Text>
          <Text style={styles.runMetricLabel}>dist</Text>
        </View>
        <View style={styles.runMetric}>
          <Text style={styles.runMetricValue}>{formatTime(item.duration)}</Text>
          <Text style={styles.runMetricLabel}>time</Text>
        </View>
        <View style={styles.runMetric}>
          <Text style={styles.runMetricValue}>{item.pace}</Text>
          <Text style={styles.runMetricLabel}>pace</Text>
        </View>
      </View>

      {/* Extra metrics row for calories, cadence, steps */}
      {(item.calories || item.cadence || item.stepCount) && (
        <View style={styles.runExtras}>
          {item.calories != null && item.calories > 0 && (
            <View style={styles.runExtra}>
              <Icon name="fire" size={12} color={Theme.textMuted} />
              <Text style={styles.runExtraValue}>{item.calories} kcal</Text>
            </View>
          )}
          {item.cadence != null && item.cadence > 0 && (
            <View style={styles.runExtra}>
              <Icon name="shoe-print" size={12} color={Theme.textMuted} />
              <Text style={styles.runExtraValue}>{item.cadence} spm</Text>
            </View>
          )}
          {item.stepCount != null && item.stepCount > 0 && (
            <View style={styles.runExtra}>
              <Icon name="walk" size={12} color={Theme.textMuted} />
              <Text style={styles.runExtraValue}>{item.stepCount.toLocaleString()}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.totalRuns}</Text>
          <Text style={styles.summaryLabel}>runs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatDistance(stats.totalDistance)}</Text>
          <Text style={styles.summaryLabel}>total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.avgPace}</Text>
          <Text style={styles.summaryLabel}>avg pace</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {stats.totalCalories > 0 ? stats.totalCalories.toLocaleString() : "—"}
          </Text>
          <Text style={styles.summaryLabel}>kcal</Text>
        </View>
      </View>

      {/* Period filter pills */}
      <View style={styles.filterRow}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.filterPill, selectedPeriod === period && styles.filterPillActive]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[styles.filterText, selectedPeriod === period && styles.filterTextActive]}
            >
              {period}
            </Text>
          </TouchableOpacity>
        ))}
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
          <Icon name="run-fast" size={48} color={Theme.textMuted} />
          <Text style={styles.emptyText}>No runs yet</Text>
          <Text style={styles.emptySubtext}>Your runs will appear here</Text>
        </View>
      )}

      {/* Offscreen share card for capture */}
      {shareRunData && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={cardRef} data={shareRunData} />
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
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 16) + 8 : 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Theme.text,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: Theme.surface,
    borderRadius: 16,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
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
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: Theme.border,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 16,
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  runCard: {
    backgroundColor: Theme.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  runDate: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.text,
  },
  runTime: {
    fontSize: 13,
    color: Theme.textMuted,
  },
  runMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  runMetric: {
    flex: 1,
  },
  runMetricValue: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.text,
    fontVariant: ["tabular-nums"],
  },
  runMetricLabel: {
    fontSize: 11,
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  runExtras: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    gap: 16,
  },
  runExtra: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  runExtraValue: {
    fontSize: 12,
    color: Theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.textMuted,
    marginTop: 4,
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
});
