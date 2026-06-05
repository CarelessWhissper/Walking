import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useRouter } from "expo-router";

import { Theme } from "@/constants/theme";
import { toast } from "@/components/Toast";
import {
  SHARE_VARIANTS,
  ShareCardDark,
  ShareCardMap,
  ShareCardPhoto,
  ShareCardData,
  ShareVariant,
} from "@/components/ShareCard";
import {
  clearPendingShare,
  readPendingShare,
} from "@/components/shareState";

const NATIVE_CARD_WIDTH = 400;
const NATIVE_CARD_HEIGHT = 711;

export default function ShareScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const [data, setData] = useState<ShareCardData | null>(null);
  const [variantIdx, setVariantIdx] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<"copy" | "download" | "share" | null>(null);

  const captureRefs = useRef<Record<ShareVariant, View | null>>({
    dark: null,
    photo: null,
    map: null,
  });

  useEffect(() => {
    const pending = readPendingShare();
    if (!pending) {
      router.back();
      return;
    }
    setData(pending);
    setPhotoUri(pending.photoUri);
    return () => {
      clearPendingShare();
    };
  }, [router]);

  const variant = SHARE_VARIANTS[variantIdx];

  const enrichedData: ShareCardData | null = useMemo(() => {
    if (!data) return null;
    return { ...data, photoUri };
  }, [data, photoUri]);

  const previewScale = useMemo(() => {
    const maxWidth = screenWidth - 64;
    return Math.min(maxWidth / NATIVE_CARD_WIDTH, 0.78);
  }, [screenWidth]);

  const previewWidth = NATIVE_CARD_WIDTH * previewScale;
  const previewHeight = NATIVE_CARD_HEIGHT * previewScale;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setVariantIdx(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const pickPhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Photo access denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Photo pick failed:", err);
      toast.error("Couldn't open photos");
    }
  }, []);

  const captureCurrent = useCallback(async (): Promise<string | null> => {
    const ref = captureRefs.current[variant];
    if (!ref) return null;
    return await captureRef(ref, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      width: NATIVE_CARD_WIDTH * 2,
      height: NATIVE_CARD_HEIGHT * 2,
    });
  }, [variant]);

  const handleCopy = useCallback(async () => {
    if (busy) return;
    setBusy("copy");
    try {
      const uri = await captureCurrent();
      if (!uri) return;
      const base64 = await new File(uri).base64();
      await Clipboard.setImageAsync(base64);
      toast.info("Image copied");
    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    } finally {
      setBusy(null);
    }
  }, [busy, captureCurrent]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy("download");
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        toast.error("Storage access denied");
        return;
      }
      const uri = await captureCurrent();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      toast.info("Saved to photos");
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    } finally {
      setBusy(null);
    }
  }, [busy, captureCurrent]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy("share");
    try {
      const uri = await captureCurrent();
      if (!uri) return;
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your run",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Share failed");
    } finally {
      setBusy(null);
    }
  }, [busy, captureCurrent]);

  if (!enrichedData) {
    return <View style={styles.container} />;
  }

  const renderCardForVariant = (v: ShareVariant) => {
    const setRef = (node: View | null) => {
      captureRefs.current[v] = node;
    };
    if (v === "dark") return <ShareCardDark ref={setRef} data={enrichedData} />;
    if (v === "map") return <ShareCardMap ref={setRef} data={enrichedData} />;
    return <ShareCardPhoto ref={setRef} data={enrichedData} />;
  };

  const renderItem = ({ item }: { item: ShareVariant }) => (
    <View style={[styles.slide, { width: screenWidth }]}>
      <View
        style={{
          width: previewWidth,
          height: previewHeight,
          overflow: "hidden",
          borderRadius: 18,
        }}
      >
        <View
          style={{
            width: NATIVE_CARD_WIDTH,
            height: NATIVE_CARD_HEIGHT,
            transform: [
              { translateX: -(NATIVE_CARD_WIDTH - previewWidth) / 2 },
              { translateY: -(NATIVE_CARD_HEIGHT - previewHeight) / 2 },
              { scale: previewScale },
            ],
          }}
        >
          {renderCardForVariant(item)}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="close" size={24} color={Theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Activity</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.carouselWrap}>
        <FlatList
          data={SHARE_VARIANTS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>

      <View style={styles.dots}>
        {SHARE_VARIANTS.map((v, i) => (
          <View
            key={v}
            style={[styles.dot, variantIdx === i && styles.dotActive]}
          />
        ))}
      </View>

      {variant === "photo" && (
        <View style={styles.photoActionRow}>
          <TouchableOpacity
            style={styles.photoPickBtn}
            onPress={pickPhoto}
            activeOpacity={0.7}
          >
            <Icon
              name={photoUri ? "image-edit" : "image-plus"}
              size={18}
              color={Theme.accent}
            />
            <Text style={styles.photoPickText}>
              {photoUri ? "Change photo" : "Choose photo"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.shareToLabel}>Share to</Text>
      <View style={styles.actions}>
        <ActionBtn
          icon="content-copy"
          label="Copy"
          onPress={handleCopy}
          loading={busy === "copy"}
          disabled={busy != null}
        />
        <ActionBtn
          icon="download"
          label="Save"
          onPress={handleDownload}
          loading={busy === "download"}
          disabled={busy != null}
        />
        <ActionBtn
          icon="share-variant"
          label="Share"
          onPress={handleShare}
          loading={busy === "share"}
          disabled={busy != null}
          primary
        />
      </View>

      {/* Offscreen native-size copy of current variant for capture */}
      <View style={styles.offscreen} pointerEvents="none">
        {renderCardForVariant(variant)}
      </View>
    </SafeAreaView>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  loading,
  disabled,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.actionIconWrap,
          primary && styles.actionIconWrapPrimary,
          disabled && !loading && styles.actionIconWrapDisabled,
        ]}
      >
        <Icon
          name={loading ? "loading" : icon}
          size={22}
          color={primary ? Theme.bg : Theme.text}
        />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 8 : 0,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Theme.text,
  },
  carouselWrap: {
    flex: 1,
    maxHeight: "65%",
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.surfaceLight,
  },
  dotActive: {
    backgroundColor: Theme.accent,
    width: 20,
  },
  photoActionRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  photoPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  photoPickText: {
    color: Theme.accent,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  shareToLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionBtnPrimary: {},
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.border,
  },
  actionIconWrapPrimary: {
    backgroundColor: Theme.accent,
    borderColor: Theme.accent,
  },
  actionIconWrapDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 12,
    color: Theme.textSecondary,
    fontWeight: "500",
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: NATIVE_CARD_WIDTH,
    height: NATIVE_CARD_HEIGHT,
  },
});
