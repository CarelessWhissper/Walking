import { useState, useEffect, useRef, useCallback } from "react";
import { Accelerometer } from "expo-sensors";

interface CadenceState {
  cadence: number; // steps per minute
  stepCount: number;
}

/**
 * Detects running cadence from accelerometer data.
 * Uses peak detection on acceleration magnitude to count steps.
 */
export function useCadenceTracker(isActive: boolean): CadenceState {
  const [cadence, setCadence] = useState(0);
  const [stepCount, setStepCount] = useState(0);

  const stepTimestampsRef = useRef<number[]>([]);
  const lastMagnitudeRef = useRef(0);
  const risingRef = useRef(false);
  const stepCountRef = useRef(0);

  // Reset when tracking starts/stops
  useEffect(() => {
    if (!isActive) {
      setCadence(0);
      setStepCount(0);
      stepTimestampsRef.current = [];
      stepCountRef.current = 0;
      lastMagnitudeRef.current = 0;
      risingRef.current = false;
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    // Set accelerometer update interval (~50Hz)
    Accelerometer.setUpdateInterval(20);

    const STEP_THRESHOLD = 1.15; // magnitude threshold for step peak
    const MIN_STEP_INTERVAL = 250; // minimum ms between steps (~240 spm max)
    const CADENCE_WINDOW = 10000; // 10-second rolling window for cadence calc

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      const timestamps = stepTimestampsRef.current;

      // Peak detection: magnitude was rising and now falling, and crossed threshold
      if (risingRef.current && magnitude < lastMagnitudeRef.current && lastMagnitudeRef.current > STEP_THRESHOLD) {
        const lastStepTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;

        if (now - lastStepTime > MIN_STEP_INTERVAL) {
          timestamps.push(now);
          stepCountRef.current += 1;
          setStepCount(stepCountRef.current);

          // Remove timestamps older than the cadence window
          const cutoff = now - CADENCE_WINDOW;
          while (timestamps.length > 0 && timestamps[0] < cutoff) {
            timestamps.shift();
          }

          // Calculate cadence from recent steps
          if (timestamps.length >= 2) {
            const windowDuration = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
            if (windowDuration > 0) {
              const stepsInWindow = timestamps.length - 1;
              const spm = Math.round((stepsInWindow / windowDuration) * 60);
              setCadence(Math.min(spm, 240)); // cap at 240 spm
            }
          }
        }
      }

      risingRef.current = magnitude > lastMagnitudeRef.current;
      lastMagnitudeRef.current = magnitude;
    });

    return () => {
      subscription.remove();
    };
  }, [isActive]);

  return { cadence, stepCount };
}
