import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Theme } from "@/constants/theme";

type ConfirmInput = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type Resolver = (value: boolean) => void;

let setStateExternal: ((s: ConfirmInput | null) => void) | null = null;
let pendingResolver: Resolver | null = null;

export function confirm(input: ConfirmInput): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!setStateExternal) {
      resolve(false);
      return;
    }
    // If something is already open, reject it as cancelled.
    if (pendingResolver) {
      pendingResolver(false);
      pendingResolver = null;
    }
    pendingResolver = resolve;
    setStateExternal(input);
  });
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmInput | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    setStateExternal = setState;
    return () => {
      setStateExternal = null;
    };
  }, []);

  useEffect(() => {
    if (state) {
      opacity.setValue(0);
      scale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [state, opacity, scale]);

  const close = (result: boolean) => {
    const resolver = pendingResolver;
    pendingResolver = null;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setState(null);
      resolver?.(result);
    });
  };

  return (
    <Modal
      visible={!!state}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => close(false)}
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={styles.backdropPressable} onPress={() => close(false)} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.title}>{state?.title}</Text>
          {state?.message ? (
            <Text style={styles.message}>{state.message}</Text>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => close(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>
                {state?.cancelText ?? "Cancel"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                state?.destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
              onPress={() => close(true)}
              activeOpacity={0.8}
            >
              <Text
                style={
                  state?.destructive ? styles.destructiveText : styles.confirmText
                }
              >
                {state?.confirmText ?? "Confirm"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Theme.surface,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.text,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: Theme.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: Theme.surfaceLight,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cancelText: {
    color: Theme.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: Theme.accent,
  },
  confirmText: {
    color: Theme.bg,
    fontSize: 14,
    fontWeight: "600",
  },
  destructiveButton: {
    backgroundColor: Theme.danger,
  },
  destructiveText: {
    color: Theme.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
