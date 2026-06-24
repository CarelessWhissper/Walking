import React, { forwardRef, useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Theme } from "@/constants/theme";

export interface ShareCardData {
  distance: string;
  duration: string;
  pace: string;
  date: string;
  calories?: number;
  cadence?: number;
  locations?: { latitude: number; longitude: number }[];
  photoUri?: string;
}

export type ShareVariant = "overlay" | "dark" | "photo" | "map";

export const SHARE_VARIANTS: ShareVariant[] = ["overlay", "dark", "map", "photo"];

const CARD_WIDTH = 400;
const CARD_HEIGHT = 711;

interface CardProps {
  data: ShareCardData;
}

export const ShareCardOverlay = forwardRef<View, CardProps>(
  function ShareCardOverlay({ data }, ref) {
    const path = useMemo(() => buildRoutePath(data.locations), [data.locations]);
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <View style={styles.overlayInner}>
          <View style={styles.overlayAccentLine} />

          <View style={styles.overlayHero}>
            <Text style={styles.overlayHeroValue}>{data.distance}</Text>
            <Text style={styles.overlayHeroUnit}>Kilometers</Text>
          </View>

          <View style={styles.overlayStats}>
            <View style={styles.overlayStat}>
              <Text style={styles.overlayStatValue}>{data.pace}</Text>
              <Text style={styles.overlayStatLabel}>Pace /km</Text>
            </View>
            <View style={styles.overlayStat}>
              <Text style={styles.overlayStatValue}>{data.duration}</Text>
              <Text style={styles.overlayStatLabel}>Time</Text>
            </View>
            {data.calories != null && data.calories > 0 && (
              <View style={styles.overlayStat}>
                <Text style={styles.overlayStatValue}>{data.calories}</Text>
                <Text style={styles.overlayStatLabel}>Kcal</Text>
              </View>
            )}
          </View>

          <View style={styles.overlayRoute}>
            {path ? (
              <Svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${MAP_VB} ${MAP_VB}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <Path
                  d={path}
                  stroke={Theme.accent}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            ) : null}
          </View>

          <View style={styles.overlayFooter}>
            <Text style={styles.overlayToday}>
              Today&apos;s <Text style={styles.overlayTodayAccent}>Run</Text>
            </Text>
            <Text style={styles.overlayDate}>{data.date}</Text>
          </View>
        </View>
      </View>
    );
  },
);

export const ShareCardDark = forwardRef<View, CardProps>(
  function ShareCardDark({ data }, ref) {
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <LinearGradient
          colors={["#1A1A1D", "#121214", "#0C0C0E"]}
          style={styles.darkGradient}
        >
          <View style={styles.darkInner}>
            <View style={styles.accentLine} />
            <Text style={styles.date}>{data.date}</Text>

            <View style={styles.darkHero}>
              <Text style={styles.heroValue}>{data.distance}</Text>
              <Text style={styles.heroUnit}>kilometers</Text>
            </View>

            <View style={styles.divider} />

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

            <Text style={styles.todayBrand}>
              Today&apos;s <Text style={styles.todayBrandAccent}>Run</Text>
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  },
);

export const ShareCardPhoto = forwardRef<View, CardProps>(
  function ShareCardPhoto({ data }, ref) {
    const hasPhoto = !!data.photoUri;
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {hasPhoto ? (
          <Image
            source={{ uri: data.photoUri! }}
            style={styles.photoBackground}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photoBackground, styles.photoPlaceholder]}>
            <Icon name="image-plus" size={48} color="#444" />
            <Text style={styles.photoPlaceholderText}>
              Tap below to add a photo
            </Text>
          </View>
        )}

        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.85)"]}
          locations={[0, 0.5, 1]}
          style={styles.photoOverlay}
        >
          <View style={styles.photoTop}>
            <Text style={styles.photoDate}>{data.date}</Text>
          </View>

          <View style={styles.photoBottom}>
            <View style={styles.photoStatBlock}>
              <Text style={styles.photoStatLabel}>Distance</Text>
              <Text style={styles.photoStatValue}>{data.distance} km</Text>
            </View>
            <View style={styles.photoStatsRow}>
              <View style={styles.photoStatBlock}>
                <Text style={styles.photoStatLabel}>Pace</Text>
                <Text style={styles.photoStatValueSm}>{data.pace} /km</Text>
              </View>
              <View style={styles.photoStatBlock}>
                <Text style={styles.photoStatLabel}>Time</Text>
                <Text style={styles.photoStatValueSm}>{data.duration}</Text>
              </View>
              {data.calories != null && data.calories > 0 && (
                <View style={styles.photoStatBlock}>
                  <Text style={styles.photoStatLabel}>kcal</Text>
                  <Text style={styles.photoStatValueSm}>{data.calories}</Text>
                </View>
              )}
            </View>

            <Text style={styles.photoToday}>
              Today&apos;s <Text style={styles.photoTodayAccent}>Run</Text>
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  },
);

export const ShareCardMap = forwardRef<View, CardProps>(
  function ShareCardMap({ data }, ref) {
    const path = useMemo(() => buildRoutePath(data.locations), [data.locations]);
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <View style={styles.mapBg}>
          <View style={styles.mapTop}>
            <View style={styles.accentLine} />
            <Text style={styles.date}>{data.date}</Text>
          </View>

          <View style={styles.mapSvgContainer}>
            {path ? (
              <Svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${MAP_VB} ${MAP_VB}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <Path
                  d={path}
                  stroke={Theme.accent}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            ) : (
              <View style={styles.mapEmpty}>
                <Icon name="map-outline" size={36} color="#333" />
                <Text style={styles.mapEmptyText}>No route data</Text>
              </View>
            )}
          </View>

          <View style={styles.mapStats}>
            <View style={styles.mapStatRow}>
              <Text style={styles.mapStatLabel}>Distance</Text>
              <Text style={styles.mapStatValue}>{data.distance} km</Text>
            </View>
            <View style={styles.mapStatRow}>
              <Text style={styles.mapStatLabel}>Time</Text>
              <Text style={styles.mapStatValue}>{data.duration}</Text>
            </View>
            <View style={styles.mapStatRow}>
              <Text style={styles.mapStatLabel}>Pace</Text>
              <Text style={styles.mapStatValue}>{data.pace} /km</Text>
            </View>
            {data.calories != null && data.calories > 0 && (
              <View style={styles.mapStatRow}>
                <Text style={styles.mapStatLabel}>Calories</Text>
                <Text style={styles.mapStatValue}>{data.calories} kcal</Text>
              </View>
            )}
          </View>

          <Text style={[styles.todayBrand, styles.todayBrandMap]}>
            Today&apos;s <Text style={styles.todayBrandAccent}>Run</Text>
          </Text>
        </View>
      </View>
    );
  },
);

const MAP_VB = 1000;
const MAP_PAD = 40;

function buildRoutePath(
  locations: { latitude: number; longitude: number }[] | undefined,
): string | null {
  if (!locations || locations.length < 2) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const l of locations) {
    if (l.latitude < minLat) minLat = l.latitude;
    if (l.latitude > maxLat) maxLat = l.latitude;
    if (l.longitude < minLon) minLon = l.longitude;
    if (l.longitude > maxLon) maxLon = l.longitude;
  }

  const latRange = Math.max(maxLat - minLat, 1e-6);
  const lonRange = Math.max(maxLon - minLon, 1e-6);
  const range = Math.max(latRange, lonRange);

  // Center the smaller axis within the square viewBox
  const latOffset = (range - latRange) / 2;
  const lonOffset = (range - lonRange) / 2;
  const usable = MAP_VB - MAP_PAD * 2;

  const points = locations.map((l) => {
    const nx = (l.longitude - minLon + lonOffset) / range;
    const ny = (l.latitude - minLat + latOffset) / range;
    const x = MAP_PAD + nx * usable;
    // Invert Y so north is up
    const y = MAP_PAD + (1 - ny) * usable;
    return [x, y] as [number, number];
  });

  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    // Transparent frame so captureRef preserves the alpha channel.
    // Each variant paints its own fill (gradient / photo / map panel);
    // the overlay variant stays see-through for a true transparent PNG.
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  // Overlay variant (transparent, Strava-style)
  overlayInner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 30,
  },
  overlayAccentLine: {
    width: 48,
    height: 4,
    backgroundColor: Theme.accent,
    borderRadius: 2,
    marginBottom: 22,
  },
  overlayHero: {
    marginBottom: 4,
  },
  overlayHeroValue: {
    fontSize: 88,
    fontWeight: "200",
    color: "#FFFFFF",
    letterSpacing: -1,
    lineHeight: 92,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  overlayHeroUnit: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 6,
  },
  overlayStats: {
    flexDirection: "row",
    gap: 32,
    marginTop: 26,
  },
  overlayStat: {
    gap: 3,
  },
  overlayStatValue: {
    fontSize: 28,
    fontWeight: "300",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 6,
  },
  overlayStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 4,
  },
  overlayRoute: {
    flex: 1,
    marginVertical: 20,
  },
  overlayFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayToday: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 4,
  },
  overlayTodayAccent: {
    color: Theme.accent,
    fontWeight: "800",
  },
  overlayDate: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 4,
  },
  // Dark variant
  darkGradient: {
    flex: 1,
  },
  darkInner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  accentLine: {
    width: 48,
    height: 3,
    backgroundColor: Theme.accent,
    borderRadius: 2,
    marginBottom: 24,
  },
  date: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  darkHero: {
    marginTop: 8,
  },
  heroValue: {
    fontSize: 80,
    fontWeight: "100",
    color: "#F5F5F5",
    letterSpacing: 2,
    lineHeight: 88,
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
    backgroundColor: "#242428",
    marginVertical: 24,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "#242428",
    marginHorizontal: 16,
  },
  cadenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  cadenceText: {
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
  },
  todayBrand: {
    alignSelf: "flex-end",
    marginTop: 16,
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  todayBrandAccent: {
    color: Theme.accent,
    fontWeight: "800",
  },
  todayBrandMap: {
    alignSelf: "flex-start",
  },
  // Photo variant
  photoBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1A1A1D",
  },
  photoPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  photoPlaceholderText: {
    color: "#666",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  photoOverlay: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  photoTop: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  photoDate: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  photoBottom: {
    gap: 16,
  },
  photoStatBlock: {
    gap: 2,
  },
  photoStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  photoStatValue: {
    fontSize: 52,
    fontWeight: "200",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 6,
  },
  photoStatValueSm: {
    fontSize: 22,
    fontWeight: "400",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 6,
  },
  photoStatsRow: {
    flexDirection: "row",
    gap: 24,
    flexWrap: "wrap",
  },
  photoToday: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 5,
  },
  photoTodayAccent: {
    color: Theme.accent,
    fontWeight: "800",
  },
  // Map variant
  mapBg: {
    flex: 1,
    backgroundColor: Theme.bg,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
  },
  mapTop: {
    marginBottom: 8,
  },
  mapSvgContainer: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "#18181B",
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    alignSelf: "stretch",
  },
  mapEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  mapEmptyText: {
    color: "#444",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mapStats: {
    gap: 10,
    marginBottom: 8,
  },
  mapStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  mapStatLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  mapStatValue: {
    fontSize: 20,
    fontWeight: "300",
    color: "#F5F5F5",
    fontVariant: ["tabular-nums"],
  },
});
