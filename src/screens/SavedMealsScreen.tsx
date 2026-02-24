import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import type { RootTabParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import { AppButton } from "../lib/AppButton";
import { EmptyState } from "../lib/EmptyState";
import {
  addNutrientsFromFoodProfiles,
  computeMealTotalsAndInsights,
  NUTRIENT_DB_VERSION
} from "../lib/mealNutrients";

type Props = BottomTabScreenProps<RootTabParamList, "Saved">;

export type SavedMealItem = {
  canonical_id: string;
  canonical_name: string;
  name?: string;
  grams: number;
  quantity?: number;
  unit?: string;
  last_precise_unit?: string;
  confidence?: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  items: SavedMealItem[];
  created_at: string;
};

function formatItemSummary(items: SavedMealItem[]): string {
  if (!items.length) return "No items";
  const names = items
    .map((i) => i.canonical_name || i.name || "")
    .filter(Boolean);
  if (!names.length) return "No items";
  const preview = names.slice(0, 2).join(", ");
  if (names.length <= 2) return preview;
  return `${preview} +${names.length - 2} more`;
}

export function SavedMealsScreen({ navigation }: Props) {
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const fetchSavedMeals = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSavedMeals([]);
        return;
      }
      const { data, error: fetchError } = await supabase
        .from("saved_meals")
        .select("id, name, items, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }
      const rows = (data ?? []).map((row) => ({
        id: row.id,
        name: String(row.name ?? ""),
        items: Array.isArray(row.items) ? row.items : [],
        created_at: String(row.created_at ?? "")
      }));
      setSavedMeals(rows);
      setError(null);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load saved meals.";
      setError(message);
      setSavedMeals([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSavedMeals();
    }, [fetchSavedMeals])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSavedMeals();
  }, [fetchSavedMeals]);

  const handleLogSavedMeal = useCallback(
    async (saved: SavedMeal) => {
      if (!saved.items.length) {
        Alert.alert("Empty meal", "This saved meal has no items.");
        return;
      }
      setLoggingId(saved.id);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          throw new Error("You must be signed in to log a meal.");
        }
        const { data: insertedMeal, error: insertError } = await supabase
          .from("meals")
          .insert({
            user_id: auth.user.id,
            photo_path: null
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        const mealId = insertedMeal.id;

        const itemsWithGrams = saved.items
          .filter(
            (i) =>
              typeof i.canonical_id === "string" &&
              typeof i.canonical_name === "string" &&
              Number.isFinite(i.grams)
          )
          .map((i) => ({
            canonical_id: i.canonical_id,
            canonical_name: i.canonical_name,
            name: i.canonical_name,
            grams: Math.max(0, Number(i.grams)),
            quantity: Number.isFinite(i.quantity) ? Math.max(0, i.quantity!) : Math.max(0, Number(i.grams)),
            unit: typeof i.unit === "string" ? i.unit : "g",
            last_precise_unit: typeof i.last_precise_unit === "string" ? i.last_precise_unit : (typeof i.unit === "string" ? i.unit : "g"),
            confidence: typeof i.confidence === "number" ? i.confidence : 0.2
          }));

        if (!itemsWithGrams.length) {
          throw new Error("No valid items to log.");
        }

        const hydrated = addNutrientsFromFoodProfiles(itemsWithGrams);
        const { nutrient_totals, insights } = computeMealTotalsAndInsights(hydrated);
        const finalItems = hydrated.map((item) => ({
          name: item.canonical_name,
          canonical_id: item.canonical_id,
          canonical_name: item.canonical_name,
          grams: item.grams,
          quantity: item.grams,
          unit: "g",
          last_precise_unit: "g",
          confidence: item.confidence ?? 0.2
        }));

        const { error: updateError } = await supabase
          .from("meals")
          .update({
            final_items: finalItems,
            nutrient_totals: nutrient_totals,
            nutrient_db_version: NUTRIENT_DB_VERSION,
            insights
          })
          .eq("id", mealId);

        if (updateError) throw updateError;

        navigation.navigate("Capture", { mealId });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to log meal.";
        Alert.alert("Log failed", message);
      } finally {
        setLoggingId(null);
      }
    },
    [navigation]
  );

  const handleDeleteSavedMeal = useCallback(
    (saved: SavedMeal) => {
      Alert.alert(
        "Delete saved meal?",
        `"${saved.name}" will be removed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error: deleteError } = await supabase
                  .from("saved_meals")
                  .delete()
                  .eq("id", saved.id);
                if (deleteError) throw deleteError;
                setSavedMeals((prev) => prev.filter((m) => m.id !== saved.id));
              } catch (e) {
                const message =
                  e instanceof Error ? e.message : "Failed to delete.";
                Alert.alert("Delete failed", message);
              }
            }
          }
        ]
      );
    },
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#111"
          />
        }
      >
        <Text style={styles.title}>Saved meals</Text>
        <Text style={styles.subtitle}>
          Log a saved meal to add it to today's history. You can edit amounts after logging.
        </Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {isLoading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : !savedMeals.length ? (
          <EmptyState
            message="No saved meals yet. Save a meal from History or Capture to reuse it."
            label="Saved"
          />
        ) : (
          <View style={styles.list}>
            {savedMeals.map((saved) => (
              <View key={saved.id} style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.mealName}>{saved.name}</Text>
                  <Text style={styles.mealSummary} numberOfLines={1}>
                    {formatItemSummary(saved.items)} ({saved.items.length} item{saved.items.length !== 1 ? "s" : ""})
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <AppButton
                    title={loggingId === saved.id ? "Logging…" : "Log"}
                    onPress={() => handleLogSavedMeal(saved)}
                    variant="primary"
                    fullWidth={false}
                    disabled={loggingId !== null}
                  />
                  <AppButton
                    title="Delete"
                    onPress={() => handleDeleteSavedMeal(saved)}
                    variant="ghost"
                    fullWidth={false}
                    disabled={loggingId !== null}
                  />
                </View>
              </View>
            ))}
          </View>
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
  scrollContent: {
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8
  },
  list: {
    gap: 10
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#f6f6f6",
    borderWidth: 1,
    borderColor: "#eee"
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  mealName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111"
  },
  mealSummary: {
    fontSize: 13,
    color: "#555"
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  errorBanner: {
    backgroundColor: "#fce8e6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#b42318"
  },
  spinner: {
    marginTop: 12
  }
});
