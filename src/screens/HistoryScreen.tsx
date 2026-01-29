import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import type { RootTabParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import { AppButton } from "../lib/AppButton";
import { EmptyState } from "../lib/EmptyState";
import { formatNutrientLabel } from "../lib/formatters";

type Props = BottomTabScreenProps<RootTabParamList, "History">;

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

type MealHistoryItem = {
  id: string;
  created_at: string;
  nutrient_totals?: NutrientTotals | null;
  final_items?: { name?: string }[] | null;
  parsed_items?: { name?: string }[] | null;
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

const getDayRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

const toLocalDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthRange = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

const computeTotalsFromMeals = (meals: MealHistoryItem[]) => {
  const totals = makeEmptyVector();
  const percentDv = makeEmptyVector();
  let confidenceSum = 0;
  let confidenceCount = 0;
  meals.forEach((meal) => {
    const entry = meal?.nutrient_totals;
    if (!entry?.totals || !entry?.percent_dv) {
      return;
    }
    const confidence = computeAverageConfidence(meal?.final_items as FinalItem[]);
    confidenceSum += confidence.sum;
    confidenceCount += confidence.count;
    NUTRIENT_KEYS.forEach((key) => {
      totals[key] += Number(entry.totals[key] ?? 0);
      percentDv[key] += Number(entry.percent_dv[key] ?? 0);
    });
  });
  return {
    totals,
    percent_dv: percentDv,
    confidencePercent: confidenceCount
      ? Math.round((confidenceSum / confidenceCount) * 100)
      : null
  };
};

export function HistoryScreen({ navigation }: Props) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(1);
    return now;
  });
  const [dateMeals, setDateMeals] = useState<MealHistoryItem[]>([]);
  const [dateTotals, setDateTotals] = useState<NutrientTotals>({
    totals: makeEmptyVector(),
    percent_dv: makeEmptyVector()
  });
  const [dateConfidence, setDateConfidence] = useState<number | null>(null);
  const [monthMealDays, setMonthMealDays] = useState<string[]>([]);

  const fetchMealsForDate = useCallback(async (date: Date) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error("Sign in to view meal history.");
      }
      const range = getDayRange(date);
      const { data: historyData, error: historyError } = await supabase
        .from("meals")
        .select("id, created_at, nutrient_totals, final_items, parsed_items")
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at", { ascending: false });

      if (historyError) {
        throw historyError;
      }
      const meals = (historyData as MealHistoryItem[]) ?? [];
      setDateMeals(meals);
      const computed = computeTotalsFromMeals(meals);
      setDateTotals({
        totals: computed.totals,
        percent_dv: computed.percent_dv
      });
      setDateConfidence(computed.confidencePercent);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load meal history.";
      setHistoryError(message);
      setDateMeals([]);
      setDateTotals({
        totals: makeEmptyVector(),
        percent_dv: makeEmptyVector()
      });
      setDateConfidence(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchMealsForMonth = useCallback(async (month: Date) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error("Sign in to view meal history.");
      }
      const range = getMonthRange(month);
      const { data, error } = await supabase
        .from("meals")
        .select("created_at")
        .gte("created_at", range.start)
        .lt("created_at", range.end);

      if (error) {
        throw error;
      }
      const dayKeys = new Set<string>();
      (data ?? []).forEach((meal) => {
        if (meal?.created_at) {
          dayKeys.add(toLocalDayKey(new Date(meal.created_at)));
        }
      });
      setMonthMealDays(Array.from(dayKeys));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load meal history.";
      setHistoryError(message);
      setMonthMealDays([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchMealsForDate(selectedDate);
    if (
      selectedDate.getFullYear() !== viewMonth.getFullYear() ||
      selectedDate.getMonth() !== viewMonth.getMonth()
    ) {
      const nextMonth = new Date(selectedDate);
      nextMonth.setDate(1);
      setViewMonth(nextMonth);
    }
  }, [fetchMealsForDate, selectedDate, viewMonth]);

  useEffect(() => {
    fetchMealsForMonth(viewMonth);
  }, [fetchMealsForMonth, viewMonth]);

  const formatMealTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };
  const formatMealSummary = (meal: MealHistoryItem) => {
    const sourceItems = Array.isArray(meal.final_items) && meal.final_items.length
      ? meal.final_items
      : Array.isArray(meal.parsed_items)
        ? meal.parsed_items
        : [];
    const names = sourceItems
      .map((item) => (typeof item?.name === "string" ? item.name : ""))
      .filter(Boolean);
    if (!names.length) {
      return "No items";
    }
    const preview = names.slice(0, 2).join(", ");
    if (names.length <= 2) {
      return preview;
    }
    return `${preview} +${names.length - 2} more`;
  };
  const formatMonthTitle = (month: Date) =>
    month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const changeMonth = (offset: number) => {
    const next = new Date(viewMonth);
    next.setMonth(next.getMonth() + offset);
    next.setDate(1);
    setViewMonth(next);
  };
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const buildCalendarDays = (month: Date) => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const leadingBlanks = first.getDay();
    const daysInMonth = last.getDate();
    const cells: Array<{ key: string; date: Date | null }> = [];
    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ key: `blank-${i}`, date: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      cells.push({ key: date.toISOString(), date });
    }
    const remainder = cells.length % 7;
    if (remainder) {
      const blanks = 7 - remainder;
      for (let i = 0; i < blanks; i += 1) {
        cells.push({ key: `blank-trail-${i}`, date: null });
      }
    }
    return cells;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>History</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calendar</Text>
          <Text style={styles.cardSubtitle}>Select a day to view meals and totals.</Text>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => changeMonth(-1)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.iconButtonPressed : null
              ]}
            >
              <Ionicons name="chevron-back" size={18} color="#111" />
            </Pressable>
            <Text style={styles.monthTitle}>{formatMonthTitle(viewMonth)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => changeMonth(1)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.iconButtonPressed : null
              ]}
            >
              <Ionicons name="chevron-forward" size={18} color="#111" />
            </Pressable>
          </View>
          <View style={styles.weekHeader}>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekLabel}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {buildCalendarDays(viewMonth).map((cell) => {
              if (!cell.date) {
                return <View key={cell.key} style={styles.calendarCell} />;
              }
              const dayKey = toLocalDayKey(cell.date);
              const isSelected = dayKey === toLocalDayKey(selectedDate);
              const isToday = isSameDay(cell.date, new Date());
              const hasMeals = monthMealDays.includes(dayKey);
              return (
                <View key={cell.key} style={styles.calendarCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${cell.date.toDateString()}`}
                    onPress={() => setSelectedDate(cell.date)}
                    style={({ pressed }) => [
                      styles.dayButton,
                      isSelected ? styles.dayButtonSelected : null,
                      isToday && !isSelected ? styles.dayButtonToday : null,
                      pressed && !isSelected ? styles.dayButtonPressed : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        isSelected ? styles.dayLabelSelected : null,
                        isToday && !isSelected ? styles.dayLabelToday : null
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                    {hasMeals ? <View style={styles.mealDot} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={styles.dateActions}>
            <AppButton
              title="Today"
              onPress={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setSelectedDate(today);
              }}
              variant="secondary"
              fullWidth={false}
            />
          </View>
          {historyError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{historyError}</Text>
            </View>
          ) : null}
          {dateConfidence !== null ? (
            <Text style={styles.cardSubtitle}>Avg confidence: {dateConfidence}%</Text>
          ) : null}
          {isLoadingHistory ? <ActivityIndicator style={styles.spinner} /> : null}
          {!isLoadingHistory && !historyError ? (
            <>
              <View style={styles.list}>
                {dateMeals.length ? (
                  dateMeals.map((meal) => (
                    <View key={meal.id} style={styles.historyRow}>
                      <View style={styles.historyDetails}>
                        <Text style={styles.item}>{formatMealTimestamp(meal.created_at)}</Text>
                        <Text style={styles.cardSubtitle}>{formatMealSummary(meal)}</Text>
                      </View>
                      <AppButton
                        title="Edit"
                        onPress={() => navigation.navigate("Capture", { mealId: meal.id })}
                        variant="secondary"
                        fullWidth={false}
                      />
                    </View>
                  ))
                ) : (
                  <EmptyState message="No meals logged for this date." />
                )}
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Daily totals (%DV)</Text>
                {dateMeals.length ? (
                  NUTRIENT_KEYS.map((key) => (
                    <Text key={key} style={styles.item}>
                      {formatNutrientLabel(key)} · {Math.round(dateTotals.percent_dv[key] * 100)}%
                    </Text>
                  ))
                ) : (
                  <EmptyState message="No totals available for this date." />
                )}
              </View>
            </>
          ) : null}
        </View>
        <Text style={styles.disclaimer}>
          Estimates only. Source provides informational nutrition data and is not medical advice.
        </Text>
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
  card: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f6f6f6",
    gap: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
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
    gap: 6,
    paddingTop: 4
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6
  },
  historyDetails: {
    flex: 1,
    gap: 2
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e4"
  },
  iconButtonPressed: {
    backgroundColor: "#f0f0f0"
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#111"
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 3
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#666"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarCell: {
    width: "14.2857%",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 3,
    marginBottom: 6
  },
  dayButton: {
    width: "100%",
    minHeight: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f3f3"
  },
  dayButtonPressed: {
    backgroundColor: "#ededed"
  },
  dayButtonSelected: {
    backgroundColor: "#111"
  },
  dayButtonToday: {
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#fff"
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222"
  },
  dayLabelSelected: {
    color: "#fff"
  },
  dayLabelToday: {
    color: "#111"
  },
  mealDot: {
    marginTop: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#555"
  },
  dateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  subsection: {
    gap: 6,
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e7e7e7"
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
    marginTop: 4
  },
  disclaimer: {
    fontSize: 12,
    color: "#777",
    textAlign: "center"
  }
});
