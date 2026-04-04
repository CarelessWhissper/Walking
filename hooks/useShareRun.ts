import { useRef, useCallback, useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

/**
 * Hook that captures a ShareCard view ref as a PNG and opens the native share sheet.
 */
export function useShareRun() {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async () => {
    if (!cardRef.current || isSharing) return;

    setIsSharing(true);
    try {
      // Capture the card view as a PNG tmpfile
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your run",
        });
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  return { cardRef, share, isSharing };
}
