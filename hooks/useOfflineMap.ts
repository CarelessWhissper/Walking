import { useState, useEffect, useCallback, useRef } from "react";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { DARK_MAP_STYLE, OFFLINE_PACK_CONFIG } from "@/config/mapStyle";

interface OfflineMapState {
  isDownloading: boolean;
  progress: number; // 0-100
  hasOfflinePack: boolean;
  error: string | null;
  downloadArea: (latitude: number, longitude: number) => Promise<void>;
}

const PACK_NAME = "user-area";

/**
 * Manages offline map tile packs around the user's current location.
 * Downloads tiles for a ~2km radius at zoom levels 10-16.
 */
export function useOfflineMap(): OfflineMapState {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasOfflinePack, setHasOfflinePack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloadingRef = useRef(false);

  // Check for existing pack on mount
  useEffect(() => {
    (async () => {
      try {
        const packs = await MapLibreGL.offlineManager.getPacks();
        const existing = packs?.find(
          (p: any) => p.name === PACK_NAME
        );
        if (existing) {
          setHasOfflinePack(true);
        }
      } catch {
        // offlineManager may not be available on all platforms
      }
    })();
  }, []);

  const downloadArea = useCallback(
    async (latitude: number, longitude: number) => {
      if (downloadingRef.current) return;
      downloadingRef.current = true;
      setIsDownloading(true);
      setProgress(0);
      setError(null);

      try {
        // Remove old pack first
        try {
          await MapLibreGL.offlineManager.deletePack(PACK_NAME);
        } catch {
          // may not exist
        }

        const { radiusDegrees, minZoom, maxZoom } = OFFLINE_PACK_CONFIG;
        const bounds: [[number, number], [number, number]] = [
          [longitude - radiusDegrees, latitude - radiusDegrees],
          [longitude + radiusDegrees, latitude + radiusDegrees],
        ];

        await MapLibreGL.offlineManager.createPack(
          {
            name: PACK_NAME,
            styleURL: DARK_MAP_STYLE,
            minZoom,
            maxZoom,
            bounds,
          },
          (region: any, status: any) => {
            if (status.percentage != null) {
              const pct = Math.round(status.percentage);
              setProgress(pct);
              if (pct >= 100) {
                setHasOfflinePack(true);
                setIsDownloading(false);
                downloadingRef.current = false;
              }
            }
          },
          (region: any, errorMsg: any) => {
            setError(typeof errorMsg === "string" ? errorMsg : "Download failed");
            setIsDownloading(false);
            downloadingRef.current = false;
          },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to download tiles");
        setIsDownloading(false);
        downloadingRef.current = false;
      }
    },
    [],
  );

  return {
    isDownloading,
    progress,
    hasOfflinePack,
    error,
    downloadArea,
  };
}
