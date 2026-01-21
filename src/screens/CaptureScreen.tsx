import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function CaptureScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Capture</Text>
      <Text style={styles.subtitle}>Camera flow comes next.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "#666"
  }
});
