import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { PropsWithChildren } from "react";

export type TrackingMode = "estimate" | "precise";

type TrackingModeContextValue = {
  trackingMode: TrackingMode;
  isTrackingModeReady: boolean;
  setTrackingMode: (mode: TrackingMode) => void;
};

const STORAGE_KEY = "source_tracking_mode_preference";

const TrackingModeContext = createContext<TrackingModeContextValue | null>(null);

const normalizeTrackingMode = (value: string | null): TrackingMode =>
  value === "precise" ? "precise" : "estimate";

export function TrackingModeProvider({ children }: PropsWithChildren) {
  const [trackingMode, setTrackingModeState] = useState<TrackingMode>("estimate");
  const [isTrackingModeReady, setIsTrackingModeReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedValue) => {
        if (!isMounted) {
          return;
        }
        setTrackingModeState(normalizeTrackingMode(storedValue));
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setIsTrackingModeReady(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setTrackingMode = useCallback((mode: TrackingMode) => {
    setTrackingModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {
      // Non-blocking persistence; fallback is in-memory for this session.
    });
  }, []);

  const value = useMemo(
    () => ({
      trackingMode,
      isTrackingModeReady,
      setTrackingMode
    }),
    [isTrackingModeReady, setTrackingMode, trackingMode]
  );

  return <TrackingModeContext.Provider value={value}>{children}</TrackingModeContext.Provider>;
}

export function useTrackingMode() {
  const context = useContext(TrackingModeContext);
  if (!context) {
    throw new Error("useTrackingMode must be used within TrackingModeProvider.");
  }
  return context;
}
