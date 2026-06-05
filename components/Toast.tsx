import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Theme } from "@/constants/theme";

export type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastState = Required<Pick<ToastInput, "title" | "variant" | "duration">> & {
  id: number;
  message?: string;
};

type Listener = (t: ToastState | null) => void;

const listeners = new Set<Listener>();
let nextId = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function emit(t: ToastState | null) {
  listeners.forEach((l) => l(t));
}

export const toast = {
  show(input: ToastInput) {
    nextId++;
    const next: ToastState = {
      id: nextId,
      title: input.title,
      message: input.message,
      variant: input.variant ?? "info",
      duration: input.duration ?? 2800,
    };
    if (dismissTimer) clearTimeout(dismissTimer);
    emit(next);
    dismissTimer = setTimeout(() => toast.hide(), next.duration);
  },
  success(title: string, message?: string) {
    this.show({ title, message, variant: "success" });
  },
  error(title: string, message?: string) {
    this.show({ title, message, variant: "error" });
  },
  info(title: string, message?: string) {
    this.show({ title, message, variant: "info" });
  },
  hide() {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    emit(null);
  },
};

const VARIANT_META: Record<ToastVariant, { icon: keyof typeof Icon.glyphMap; color: string; tint: string }> = {
  success: { icon: "check-circle", color: Theme.accent, tint: "rgba(0,217,255,0.12)" },
  error: { icon: "alert-circle", color: Theme.danger, tint: "rgba(255,82,82,0.12)" },
  info: { icon: "information", color: Theme.text, tint: "rgba(255,255,255,0.06)" },
};

export function ToastHost() {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const listener: Listener = (t) => {
      if (t) {
        setCurrent(t);
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -80,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setCurrent(null);
        });
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [opacity, translateY]);

  useEffect(() => {
    if (!current) return;
    translateY.setValue(-40);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [current, opacity, translateY]);

  if (!current) return null;

  const meta = VARIANT_META[current.variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        { top: insets.top + 8, transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable
        onPress={() => toast.hide()}
        style={[styles.card, { backgroundColor: meta.tint, borderColor: meta.color + "55" }]}
        android_ripple={{ color: meta.color + "22" }}
      >
        <Icon name={meta.icon} size={20} color={meta.color} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          {current.message ? (
            <Text style={styles.message} numberOfLines={2}>
              {current.message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 220,
    maxWidth: 480,
    width: "100%",
    backgroundColor: Theme.surface,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: {
    marginRight: 10,
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: Theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  message: {
    color: Theme.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
