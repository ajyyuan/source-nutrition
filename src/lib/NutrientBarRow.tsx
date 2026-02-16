import { StyleSheet, Text, View } from "react-native";

import { getNutrientBandTone } from "./nutrientBands";
import type { TrackingMode } from "./trackingMode";

type Props = {
  label: string;
  percentDv: number;
  trackingMode: TrackingMode;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function NutrientBarRow({ label, percentDv, trackingMode }: Props) {
  const normalizedPercent = Number.isFinite(percentDv) ? percentDv : 0;
  const fillPercent = clamp(normalizedPercent, 0, 1);
  const tone = getNutrientBandTone(normalizedPercent);
  const preciseLabel = trackingMode === "precise" ? `${Math.round(normalizedPercent * 100)}%` : null;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {preciseLabel ? <Text style={styles.valueLabel}>{preciseLabel}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: tone.backgroundColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(fillPercent * 100)}%`,
              backgroundColor: tone.textColor
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  label: {
    fontSize: 13,
    color: "#333",
    flex: 1
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111"
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e4e7ec",
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 0
  }
});
