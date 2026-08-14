import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Theme } from "@/constants/theme";
import { buildRoutePath, ROUTE_VB } from "@/config/routePath";

interface RouteTraceProps {
  locations?: { latitude: number; longitude: number }[];
  size?: number;
  style?: ViewStyle;
}

/**
 * Small bounds-fit route thumbnail on a surfaceLight tile. Runs without route
 * data keep the tile (uniform row heights) and show a muted marker-off glyph.
 */
export function RouteTrace({ locations, size = 56, style }: RouteTraceProps) {
  const path = useMemo(() => buildRoutePath(locations), [locations]);

  return (
    <View style={[styles.tile, { width: size, height: size }, style]}>
      {path ? (
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${ROUTE_VB} ${ROUTE_VB}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d={path}
            stroke={Theme.accent}
            // 1.5px at tile scale — the viewBox is 1000 units across
            strokeWidth={(1.5 * ROUTE_VB) / size}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <Icon name="map-marker-off" size={18} color={Theme.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 10,
    backgroundColor: Theme.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});
