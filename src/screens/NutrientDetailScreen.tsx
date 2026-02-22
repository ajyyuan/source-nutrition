import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable } from "react-native";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { formatNutrientLabel } from "../lib/formatters";
import { NUTRIENT_INFO } from "../lib/nutrientInfo";
import topFoodsByNutrient from "../data/topFoodsByNutrient.json";

type Props = NativeStackScreenProps<RootStackParamList, "NutrientDetail">;

export function NutrientDetailScreen({ navigation, route }: Props) {
  const { nutrientKey } = route.params;
  const label = formatNutrientLabel(nutrientKey);
  const info = NUTRIENT_INFO[nutrientKey];
  const topFoods = (topFoodsByNutrient as Record<string, Array<{ name: string; value: number }>>)[
    nutrientKey
  ] ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.title}>{label}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {info ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What it does</Text>
              <Text style={styles.body}>{info.description}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>If you don’t get enough</Text>
              <Text style={styles.body}>{info.deficiency}</Text>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.body}>No description available for this nutrient.</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foods high in {label}</Text>
          <Text style={styles.hint}>Per 100 g (from our database)</Text>
          {topFoods.length > 0 ? (
            <View style={styles.foodList}>
              {topFoods.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.foodRow}>
                  <Text style={styles.foodName}>{item.name}</Text>
                  <Text style={styles.foodValue}>{formatValue(nutrientKey, item.value)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>No high-source foods in our database for this nutrient.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatValue(nutrientKey: string, value: number): string {
  if (nutrientKey === "omega3_g") {
    return value >= 1 ? `${value.toFixed(1)} g` : `${(value * 1000).toFixed(0)} mg`;
  }
  if (nutrientKey.endsWith("_ug")) {
    return `${value.toFixed(1)} µg`;
  }
  if (nutrientKey.endsWith("_mg")) {
    return value >= 1 ? `${value.toFixed(1)} mg` : `${(value * 1000).toFixed(0)} µg`;
  }
  if (nutrientKey.endsWith("_g")) {
    return `${value.toFixed(2)} g`;
  }
  return String(value);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  backButton: {
    padding: 8,
    marginRight: 8
  },
  backButtonPressed: {
    opacity: 0.6
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111"
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 8
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333"
  },
  foodList: {
    gap: 6
  },
  foodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8
  },
  foodName: {
    fontSize: 14,
    color: "#333",
    flex: 1
  },
  foodValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111",
    marginLeft: 12
  }
});
