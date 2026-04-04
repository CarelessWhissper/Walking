import React, { forwardRef } from "react";
import { StyleSheet, View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

export interface ShareCardData {
  distance: string;
  duration: string;
  pace: string;
  date: string;
  calories?: number;
  cadence?: number;
}

/**
 * A Strava-style share card rendered at a fixed size for screenshot capture.
 * Rendered offscreen, captured by ViewShot, then shared.
 */
export const ShareCard = forwardRef<View, { data: ShareCardData }>(
  function ShareCard({ data }, ref) {
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <LinearGradient
          colors={["#111", "#0A0A0A", "#050505"]}
          style={styles.gradient}
        >
          {/* Top accent line */}
          <View style={styles.accentLine} />

          {/* Date */}
          <Text style={styles.date}>{data.date}</Text>

          {/* Hero distance */}
          <View style={styles.heroSection}>
            <Text style={styles.heroValue}>{data.distance}</Text>
            <Text style={styles.heroUnit}>kilometers</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data.duration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data.pace}</Text>
              <Text style={styles.statLabel}>Pace /km</Text>
            </View>
            {data.calories != null && data.calories > 0 && (
              <>
                <View style={styles.statSeparator} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.calories}</Text>
                  <Text style={styles.statLabel}>Calories</Text>
                </View>
              </>
            )}
          </View>

          {data.cadence != null && data.cadence > 0 && (
            <View style={styles.cadenceRow}>
              <Icon name="shoe-print" size={13} color="#444" />
              <Text style={styles.cadenceText}>{data.cadence} spm</Text>
            </View>
          )}

          {/* Footer branding */}
          <View style={styles.footer}>
            <View style={styles.brand}>
              <Icon name="run" size={16} color="#00E676" />
              <Text style={styles.brandText}>track</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: 400,
    backgroundColor: "#0A0A0A",
    borderRadius: 0,
    overflow: "hidden",
  },
  gradient: {
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 28,
  },
  accentLine: {
    width: 48,
    height: 3,
    backgroundColor: "#00E676",
    borderRadius: 2,
    marginBottom: 28,
  },
  date: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  heroSection: {
    marginBottom: 28,
  },
  heroValue: {
    fontSize: 72,
    fontWeight: "100",
    color: "#F5F5F5",
    letterSpacing: 2,
    lineHeight: 80,
  },
  heroUnit: {
    fontSize: 16,
    color: "#555",
    fontWeight: "400",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E1E1E",
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "300",
    color: "#F5F5F5",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#555",
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statSeparator: {
    width: 1,
    height: 36,
    backgroundColor: "#1E1E1E",
    marginHorizontal: 16,
  },
  cadenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  cadenceText: {
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandText: {
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
