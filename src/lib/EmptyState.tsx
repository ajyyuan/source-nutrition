import { StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  message: string;
  label?: string;
};

export function EmptyState({ message, label = "Empty" }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ededed",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#6b6b6b"
  },
  message: {
    fontSize: 13,
    color: "#444"
  }
});
