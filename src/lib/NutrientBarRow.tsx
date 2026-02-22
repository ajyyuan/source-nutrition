import { Pressable, StyleSheet, Text, View } from "react-native";

import { getNutrientBandTone } from "./nutrientBands";

type Props = {
  label: string;
  percentDv: number;
  /** When set, the row is tappable and opens the nutrient detail screen. */
  onPress?: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function NutrientBarRow({ label, percentDv, onPress }: Props) {
  const normalizedPercent = Number.isFinite(percentDv) ? percentDv : 0;
  const fillPercent = clamp(normalizedPercent, 0, 1);
  const tone = getNutrientBandTone(normalizedPercent);
  const percentLabel = `${Math.round(normalizedPercent * 100)}%`;

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueLabel}>{percentLabel}</Text>
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
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${percentLabel}. Tap for details.`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    gap: 6
  },
  rowPressed: {
    opacity: 0.7
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
