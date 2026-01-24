import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

type NutrientVector = {
  vitamin_a_ug: number;
  vitamin_c_mg: number;
  vitamin_d_ug: number;
  vitamin_e_mg: number;
  vitamin_k_ug: number;
  thiamin_mg: number;
  riboflavin_mg: number;
  niacin_mg: number;
  vitamin_b6_mg: number;
  folate_ug: number;
  vitamin_b12_ug: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  phosphorus_mg: number;
  potassium_mg: number;
  zinc_mg: number;
  selenium_ug: number;
  omega3_g: number;
};

type NutrientTotals = {
  totals: NutrientVector;
  percent_dv: NutrientVector;
};

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b6_mg",
  "folate_ug",
  "vitamin_b12_ug",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "phosphorus_mg",
  "potassium_mg",
  "zinc_mg",
  "selenium_ug",
  "omega3_g"
] as const;

const makeEmptyVector = (): NutrientVector => ({
  vitamin_a_ug: 0,
  vitamin_c_mg: 0,
  vitamin_d_ug: 0,
  vitamin_e_mg: 0,
  vitamin_k_ug: 0,
  thiamin_mg: 0,
  riboflavin_mg: 0,
  niacin_mg: 0,
  vitamin_b6_mg: 0,
  folate_ug: 0,
  vitamin_b12_ug: 0,
  calcium_mg: 0,
  iron_mg: 0,
  magnesium_mg: 0,
  phosphorus_mg: 0,
  potassium_mg: 0,
  zinc_mg: 0,
  selenium_ug: 0,
  omega3_g: 0
});

export function HomeScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [todayTotals, setTodayTotals] = useState<NutrientTotals>({
    totals: makeEmptyVector(),
    percent_dv: makeEmptyVector()
  });
  const [weekTotals, setWeekTotals] = useState<NutrientTotals>({
    totals: makeEmptyVector(),
    percent_dv: makeEmptyVector()
  });
  const [weekDaysWithMeals, setWeekDaysWithMeals] = useState(0);

  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }, []);

  const weekRange = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }, []);

  const resetTotals = useCallback(() => {
    setMealCount(0);
    setTodayTotals({
      totals: makeEmptyVector(),
      percent_dv: makeEmptyVector()
    });
    setWeekTotals({
      totals: makeEmptyVector(),
      percent_dv: makeEmptyVector()
    });
    setWeekDaysWithMeals(0);
  }, []);

  const loadToday = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    resetTotals();

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error("Sign in to view today’s totals.");
      }

      const { data, error } = await supabase
        .from("meals")
        .select("id, created_at, nutrient_totals")
        .gte("created_at", todayRange.start)
        .lt("created_at", todayRange.end);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const totals = makeEmptyVector();
        const percentDv = makeEmptyVector();

        data.forEach((meal) => {
          const entry = meal?.nutrient_totals as NutrientTotals | null;
          if (!entry?.totals || !entry?.percent_dv) {
            return;
          }
          NUTRIENT_KEYS.forEach((key) => {
            totals[key] += Number(entry.totals[key] ?? 0);
            percentDv[key] += Number(entry.percent_dv[key] ?? 0);
          });
        });

        setMealCount(data.length);
        setTodayTotals({
          totals,
          percent_dv: percentDv
        });
      } else {
        setMealCount(0);
        setTodayTotals({
          totals: makeEmptyVector(),
          percent_dv: makeEmptyVector()
        });
      }

      const { data: weekData, error: weekError } = await supabase
        .from("meals")
        .select("id, created_at, nutrient_totals")
        .gte("created_at", weekRange.start)
        .lt("created_at", weekRange.end);

      if (weekError) {
        throw weekError;
      }

      if (!weekData || weekData.length === 0) {
        setWeekTotals({
          totals: makeEmptyVector(),
          percent_dv: makeEmptyVector()
        });
        setWeekDaysWithMeals(0);
        return;
      }

      const weekTotalsAccumulator = makeEmptyVector();
      const weekPercentAccumulator = makeEmptyVector();
      const daysWithMeals = new Set<string>();

      weekData.forEach((meal) => {
        const entry = meal?.nutrient_totals as NutrientTotals | null;
        if (!entry?.totals || !entry?.percent_dv) {
          return;
        }
        if (meal.created_at) {
          const dayKey = new Date(meal.created_at).toISOString().slice(0, 10);
          daysWithMeals.add(dayKey);
        }
        NUTRIENT_KEYS.forEach((key) => {
          weekTotalsAccumulator[key] += Number(entry.totals[key] ?? 0);
          weekPercentAccumulator[key] += Number(entry.percent_dv[key] ?? 0);
        });
      });

      const divisor = Math.max(daysWithMeals.size, 1);
      const averagedTotals = makeEmptyVector();
      const averagedPercent = makeEmptyVector();
      NUTRIENT_KEYS.forEach((key) => {
        averagedTotals[key] = weekTotalsAccumulator[key] / divisor;
        averagedPercent[key] = weekPercentAccumulator[key] / divisor;
      });

      setWeekDaysWithMeals(daysWithMeals.size);
      setWeekTotals({
        totals: averagedTotals,
        percent_dv: averagedPercent
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load today’s totals.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [resetTotals, todayRange.end, todayRange.start, weekRange.end, weekRange.start]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Intake</Text>
        <Text style={styles.subtitle}>Today</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily totals</Text>
          <Text style={styles.cardSubtitle}>
            {mealCount ? `${mealCount} meal${mealCount === 1 ? "" : "s"} logged` : "No meals yet"}
          </Text>
          {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {!isLoading && !loadError ? (
            <View style={styles.list}>
              {NUTRIENT_KEYS.map((key) => (
                <Text key={key} style={styles.item}>
                  {key.replace(/_/g, " ")} · {Math.round(todayTotals.percent_dv[key] * 100)}%
                </Text>
              ))}
            </View>
          ) : null}
          <Button title="Refresh totals" onPress={loadToday} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-day rolling average</Text>
          <Text style={styles.cardSubtitle}>
            {weekDaysWithMeals
              ? `${weekDaysWithMeals} day${weekDaysWithMeals === 1 ? "" : "s"} with meals`
              : "No meals yet"}
          </Text>
          {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {!isLoading && !loadError ? (
            <View style={styles.list}>
              {NUTRIENT_KEYS.map((key) => (
                <Text key={key} style={styles.item}>
                  {key.replace(/_/g, " ")} · {Math.round(weekTotals.percent_dv[key] * 100)}%
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Button title="Capture meal photo" onPress={() => navigation.navigate("Capture")} />
          <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
        </View>
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
    alignItems: "center",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12
  },
  card: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f6f6f6",
    gap: 8,
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111"
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#555"
  },
  list: {
    gap: 6
  },
  item: {
    fontSize: 13,
    color: "#333"
  },
  error: {
    fontSize: 13,
    color: "#b42318"
  },
  spinner: {
    marginTop: 4
  },
  actions: {
    width: "100%",
    gap: 12
  }
});
