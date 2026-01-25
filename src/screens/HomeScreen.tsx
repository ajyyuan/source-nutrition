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

type FinalItem = {
  confidence?: number;
};

type Contributor = {
  canonical_id: string;
  name: string;
  score: number;
};

type MealInsights = {
  top_contributors?: Contributor[];
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

const computeAverageConfidence = (items: unknown): { sum: number; count: number } => {
  if (!Array.isArray(items)) {
    return { sum: 0, count: 0 };
  }
  return items.reduce(
    (acc, item) => {
      const value = typeof item?.confidence === "number" ? item.confidence : NaN;
      if (Number.isFinite(value) && value >= 0 && value <= 1) {
        return { sum: acc.sum + value, count: acc.count + 1 };
      }
      return acc;
    },
    { sum: 0, count: 0 }
  );
};

const computeShortfalls = (percentDv: NutrientVector) =>
  NUTRIENT_KEYS.map((key) => ({
    key,
    value: Number(percentDv[key] ?? 0)
  }))
    .filter((entry) => entry.value < 0.5)
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

const formatNutrientLabel = (key: string) => key.replace(/_/g, " ");

export function HomeScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [todayConfidence, setTodayConfidence] = useState<number | null>(null);
  const [todayTotals, setTodayTotals] = useState<NutrientTotals>({
    totals: makeEmptyVector(),
    percent_dv: makeEmptyVector()
  });
  const [weekTotals, setWeekTotals] = useState<NutrientTotals>({
    totals: makeEmptyVector(),
    percent_dv: makeEmptyVector()
  });
  const [weekDaysWithMeals, setWeekDaysWithMeals] = useState(0);
  const [weekConfidence, setWeekConfidence] = useState<number | null>(null);
  const [todayContributors, setTodayContributors] = useState<Contributor[]>([]);
  const [weekContributors, setWeekContributors] = useState<Contributor[]>([]);

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
    setTodayConfidence(null);
    setTodayContributors([]);
    setTodayTotals({
      totals: makeEmptyVector(),
      percent_dv: makeEmptyVector()
    });
    setWeekTotals({
      totals: makeEmptyVector(),
      percent_dv: makeEmptyVector()
    });
    setWeekDaysWithMeals(0);
    setWeekConfidence(null);
    setWeekContributors([]);
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
        .select("id, created_at, nutrient_totals, final_items, insights")
        .gte("created_at", todayRange.start)
        .lt("created_at", todayRange.end);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const totals = makeEmptyVector();
        const percentDv = makeEmptyVector();
        let confidenceSum = 0;
        let confidenceCount = 0;
        const contributorScores = new Map<string, Contributor>();

        data.forEach((meal) => {
          const entry = meal?.nutrient_totals as NutrientTotals | null;
          if (!entry?.totals || !entry?.percent_dv) {
            return;
          }
          const confidence = computeAverageConfidence(meal?.final_items as FinalItem[]);
          confidenceSum += confidence.sum;
          confidenceCount += confidence.count;
          const insights = meal?.insights as MealInsights | null;
          insights?.top_contributors?.forEach((item) => {
            if (!item || typeof item.canonical_id !== "string") {
              return;
            }
            const score = Number(item.score ?? 0);
            if (!Number.isFinite(score) || score <= 0) {
              return;
            }
            const existing = contributorScores.get(item.canonical_id);
            if (existing) {
              existing.score += score;
            } else {
              contributorScores.set(item.canonical_id, {
                canonical_id: item.canonical_id,
                name: typeof item.name === "string" ? item.name : item.canonical_id,
                score
              });
            }
          });
          NUTRIENT_KEYS.forEach((key) => {
            totals[key] += Number(entry.totals[key] ?? 0);
            percentDv[key] += Number(entry.percent_dv[key] ?? 0);
          });
        });

        setMealCount(data.length);
        setTodayConfidence(
          confidenceCount ? Math.round((confidenceSum / confidenceCount) * 100) : null
        );
        setTodayContributors(
          Array.from(contributorScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
        );
        setTodayTotals({
          totals,
          percent_dv: percentDv
        });
      } else {
        setMealCount(0);
        setTodayConfidence(null);
        setTodayContributors([]);
        setTodayTotals({
          totals: makeEmptyVector(),
          percent_dv: makeEmptyVector()
        });
      }

      const { data: weekData, error: weekError } = await supabase
        .from("meals")
        .select("id, created_at, nutrient_totals, final_items, insights")
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
      let weekConfidenceSum = 0;
      let weekConfidenceCount = 0;
      const weekContributorScores = new Map<string, Contributor>();
      const daysWithMeals = new Set<string>();

      weekData.forEach((meal) => {
        const entry = meal?.nutrient_totals as NutrientTotals | null;
        if (!entry?.totals || !entry?.percent_dv) {
          return;
        }
        const confidence = computeAverageConfidence(meal?.final_items as FinalItem[]);
        weekConfidenceSum += confidence.sum;
        weekConfidenceCount += confidence.count;
        const insights = meal?.insights as MealInsights | null;
        insights?.top_contributors?.forEach((item) => {
          if (!item || typeof item.canonical_id !== "string") {
            return;
          }
          const score = Number(item.score ?? 0);
          if (!Number.isFinite(score) || score <= 0) {
            return;
          }
          const existing = weekContributorScores.get(item.canonical_id);
          if (existing) {
            existing.score += score;
          } else {
            weekContributorScores.set(item.canonical_id, {
              canonical_id: item.canonical_id,
              name: typeof item.name === "string" ? item.name : item.canonical_id,
              score
            });
          }
        });
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
      setWeekConfidence(
        weekConfidenceCount ? Math.round((weekConfidenceSum / weekConfidenceCount) * 100) : null
      );
      setWeekContributors(
        Array.from(weekContributorScores.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
      );
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

  const todayShortfalls = computeShortfalls(todayTotals.percent_dv);
  const weekShortfalls = computeShortfalls(weekTotals.percent_dv);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Intake</Text>
        <Text style={styles.subtitle}>Today</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily totals (estimated)</Text>
          <Text style={styles.cardSubtitle}>
            {mealCount ? `${mealCount} meal${mealCount === 1 ? "" : "s"} logged` : "No meals yet"}
          </Text>
          {todayConfidence !== null ? (
            <Text style={styles.cardSubtitle}>Avg confidence: {todayConfidence}%</Text>
          ) : null}
          {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {!isLoading && !loadError ? (
            <>
              <View style={styles.list}>
                {mealCount ? (
                  NUTRIENT_KEYS.map((key) => (
                    <Text key={key} style={styles.item}>
                      {formatNutrientLabel(key)} · {Math.round(todayTotals.percent_dv[key] * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>
                    No meals logged today. Capture a meal to see totals.
                  </Text>
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Top contributors</Text>
                {todayContributors.length ? (
                  todayContributors.map((item) => (
                    <Text key={item.canonical_id} style={styles.insightItem}>
                      {item.name} · Total %DV sum {Math.round(item.score * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>No contributors yet.</Text>
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Likely shortfalls</Text>
                {todayShortfalls.length ? (
                  todayShortfalls.map((entry) => (
                    <Text key={entry.key} style={styles.insightItem}>
                      {formatNutrientLabel(entry.key)} · {Math.round(entry.value * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>No shortfalls detected.</Text>
                )}
              </View>
            </>
          ) : null}
          <Button title="Refresh totals" onPress={loadToday} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-day rolling average (estimated)</Text>
          <Text style={styles.cardSubtitle}>
            {weekDaysWithMeals
              ? `${weekDaysWithMeals} day${weekDaysWithMeals === 1 ? "" : "s"} with meals`
              : "No meals yet"}
          </Text>
          {weekConfidence !== null ? (
            <Text style={styles.cardSubtitle}>Avg confidence: {weekConfidence}%</Text>
          ) : null}
          {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {!isLoading && !loadError ? (
            <>
              <View style={styles.list}>
                {weekDaysWithMeals ? (
                  NUTRIENT_KEYS.map((key) => (
                    <Text key={key} style={styles.item}>
                      {formatNutrientLabel(key)} · {Math.round(weekTotals.percent_dv[key] * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>
                    No meals in the last 7 days. Capture a meal to start tracking.
                  </Text>
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Top contributors</Text>
                {weekContributors.length ? (
                  weekContributors.map((item) => (
                    <Text key={item.canonical_id} style={styles.insightItem}>
                      {item.name} · Total %DV sum {Math.round(item.score * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>No contributors yet.</Text>
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Likely shortfalls</Text>
                {weekShortfalls.length ? (
                  weekShortfalls.map((entry) => (
                    <Text key={entry.key} style={styles.insightItem}>
                      {formatNutrientLabel(entry.key)} · {Math.round(entry.value * 100)}%
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyState}>No shortfalls detected.</Text>
                )}
              </View>
            </>
          ) : null}
        </View>
        <Text style={styles.disclaimer}>
          Estimates only. Intake provides informational nutrition data and is not medical advice.
        </Text>
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
  subsection: {
    gap: 4,
    marginTop: 8
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111"
  },
  item: {
    fontSize: 13,
    color: "#333"
  },
  insightItem: {
    fontSize: 13,
    color: "#333"
  },
  emptyState: {
    fontSize: 13,
    color: "#666"
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
  },
  disclaimer: {
    fontSize: 12,
    color: "#777",
    textAlign: "center"
  }
});
