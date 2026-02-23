import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable } from "react-native";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { formatNutrientLabel, formatNutrientValue } from "../lib/formatters";
import { NUTRIENT_INFO } from "../lib/nutrientInfo";
import foodProfiles from "../data/foodProfiles.json";

type Props = NativeStackScreenProps<RootStackParamList, "FoodDetail">;

const NUTRIENT_KEYS = Object.keys(NUTRIENT_INFO) as string[];

type FoodProfile = {
  display_name: string;
  per_100g: Record<string, number>;
};

const profiles = foodProfiles as Record<string, FoodProfile>;

export function FoodDetailScreen({ navigation, route }: Props) {
  const { canonicalId } = route.params;
  const profile = profiles[canonicalId];

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
        <Text style={styles.title} numberOfLines={2}>
          {profile?.display_name ?? canonicalId}
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!profile ? (
          <View style={styles.section}>
            <Text style={styles.body}>Food not found in database.</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Micronutrients per 100 g</Text>
              <Text style={styles.hint}>From our canonical food database</Text>
              <View style={styles.nutrientList}>
                {NUTRIENT_KEYS.map((key) => {
                  const value = profile.per_100g?.[key];
                  const num = typeof value === "number" && Number.isFinite(value) ? value : null;
                  return (
                    <View key={key} style={styles.nutrientRow}>
                      <Text style={styles.nutrientName}>{formatNutrientLabel(key)}</Text>
                      <Text style={styles.nutrientValue}>
                        {num !== null ? formatNutrientValue(key, num) : "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
    color: "#111",
    flex: 1
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
    marginBottom: 12
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333"
  },
  nutrientList: {
    gap: 2
  },
  nutrientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 6
  },
  nutrientName: {
    fontSize: 14,
    color: "#333",
    flex: 1
  },
  nutrientValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111",
    marginLeft: 12
  }
});
