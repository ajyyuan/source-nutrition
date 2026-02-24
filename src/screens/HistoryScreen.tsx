import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import type { RootTabParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import { NutrientBarRow } from "../lib/NutrientBarRow";
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
  vitamin_b5_mg: number;
  vitamin_b6_mg: number;
  vitamin_b7_ug: number;
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
  photo_path?: string | null;
  nutrient_totals?: NutrientTotals | null;
  final_items?: Array<{
    name?: string;
    canonical_id?: string;
    canonical_name?: string;
    grams?: number;
    quantity?: number;
    unit?: string;
    last_precise_unit?: string;
    confidence?: number;
  }> | null;
  parsed_items?: { name?: string }[] | null;
};

const PHOTO_BUCKET = "meal-photos";

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b5_mg",
  "vitamin_b6_mg",
  "vitamin_b7_ug",
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
  vitamin_b5_mg: 0,
  vitamin_b6_mg: 0,
  vitamin_b7_ug: 0,
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
  const [mealPhotoUrls, setMealPhotoUrls] = useState<Record<string, string>>({});
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);
  const [monthMealDays, setMonthMealDays] = useState<string[]>([]);
  const [isDailyTotalsExpanded, setIsDailyTotalsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveMealTarget, setSaveMealTarget] = useState<MealHistoryItem | null>(null);
  const [saveMealName, setSaveMealName] = useState("");
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  const buildMealPhotoUrlMap = useCallback(async (meals: MealHistoryItem[]) => {
    const photoMeals = meals.filter(
      (meal) =>
        typeof meal.photo_path === "string" &&
        meal.photo_path.trim().length > 0 &&
        !meal.photo_path.startsWith("manual/")
    );
    if (!photoMeals.length) {
      return {};
    }

    const urlMap: Record<string, string> = {};
    await Promise.all(
      photoMeals.map(async (meal) => {
        const path = meal.photo_path as string;
        const { data, error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (!error && data?.signedUrl) {
          urlMap[meal.id] = data.signedUrl;
        }
      })
    );
    return urlMap;
  }, []);

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
        .select("id, created_at, photo_path, nutrient_totals, final_items, parsed_items")
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at", { ascending: false });

      if (historyError) {
        throw historyError;
      }
      const meals = (historyData as MealHistoryItem[]) ?? [];
      setDateMeals(meals);
      setMealPhotoUrls(await buildMealPhotoUrlMap(meals));
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
      setMealPhotoUrls({});
      setDateTotals({
        totals: makeEmptyVector(),
        percent_dv: makeEmptyVector()
      });
      setDateConfidence(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [buildMealPhotoUrlMap]);

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

  const handleDeleteMeal = useCallback(
    (meal: MealHistoryItem) => {
      Alert.alert(
        "Delete meal?",
        "This will remove the meal and its nutrient totals.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setIsLoadingHistory(true);
              setHistoryError(null);
              try {
                const { error } = await supabase.from("meals").delete().eq("id", meal.id);
                if (error) {
                  throw error;
                }
                const selectedKey = toLocalDayKey(selectedDate);
                setDateMeals((prev) => {
                  const next = prev.filter((entry) => entry.id !== meal.id);
                  const computed = computeTotalsFromMeals(next);
                  setDateTotals({
                    totals: computed.totals,
                    percent_dv: computed.percent_dv
                  });
                  setDateConfidence(computed.confidencePercent);
                  if (!next.length) {
                    setMonthMealDays((days) => days.filter((day) => day !== selectedKey));
                  }
                  return next;
                });
                setMealPhotoUrls((current) => {
                  if (!current[meal.id]) {
                    return current;
                  }
                  const next = { ...current };
                  delete next[meal.id];
                  return next;
                });
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Unable to delete meal.";
                setHistoryError(message);
                Alert.alert("Delete failed", message);
              } finally {
                setIsLoadingHistory(false);
              }
            }
          }
        ]
      );
    },
    [fetchMealsForDate, fetchMealsForMonth, selectedDate, viewMonth]
  );

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

  useEffect(() => {
    setIsDailyTotalsExpanded(false);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchMealsForDate(selectedDate);
      fetchMealsForMonth(viewMonth);
    }, [fetchMealsForDate, fetchMealsForMonth, selectedDate, viewMonth])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchMealsForDate(selectedDate),
        fetchMealsForMonth(viewMonth)
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMealsForDate, fetchMealsForMonth, selectedDate, viewMonth]);

  const handleSaveMeal = useCallback(
    (meal: MealHistoryItem) => {
      const items = Array.isArray(meal.final_items)
        ? meal.final_items.filter(
            (i) =>
              typeof i?.canonical_id === "string" &&
              typeof i?.canonical_name === "string" &&
              Number.isFinite(i?.grams)
          )
        : [];
      if (!items.length) {
        Alert.alert(
          "Can't save",
          "This meal has no mapped items. Edit the meal and confirm items first, then save."
        );
        return;
      }
      setSaveMealName(formatMealSummary(meal));
      setSaveMealTarget(meal);
    },
    []
  );

  const handleConfirmSaveMeal = useCallback(async () => {
    if (!saveMealTarget || !saveMealName.trim()) {
      return;
    }
    const items = Array.isArray(saveMealTarget.final_items)
      ? saveMealTarget.final_items.filter(
          (i) =>
            typeof i?.canonical_id === "string" &&
            typeof i?.canonical_name === "string" &&
            Number.isFinite(i?.grams)
        )
      : [];
    if (!items.length) {
      setSaveMealTarget(null);
      setSaveMealName("");
      return;
    }
    setIsSavingMeal(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error("You must be signed in to save meals.");
      }
      const savedItems = items.map((i) => ({
        canonical_id: i.canonical_id,
        canonical_name: i.canonical_name,
        name: typeof i.name === "string" ? i.name : i.canonical_name,
        grams: Math.max(0, Number(i.grams)),
        quantity: Number.isFinite(i?.quantity) ? Math.max(0, Number(i.quantity)) : Math.max(0, Number(i.grams)),
        unit: typeof i.unit === "string" ? i.unit : "g",
        last_precise_unit: typeof i.last_precise_unit === "string" ? i.last_precise_unit : "g",
        confidence: typeof i.confidence === "number" ? i.confidence : 0.2
      }));
      const { error: insertError } = await supabase.from("saved_meals").insert({
        user_id: auth.user.id,
        name: saveMealName.trim(),
        items: savedItems
      });
      if (insertError) throw insertError;
      setSaveMealTarget(null);
      setSaveMealName("");
      navigation.navigate("Saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save meal.";
      Alert.alert("Save failed", message);
    } finally {
      setIsSavingMeal(false);
    }
  }, [saveMealTarget, saveMealName, navigation]);

  const handleCancelSaveMeal = useCallback(() => {
    setSaveMealTarget(null);
    setSaveMealName("");
  }, []);

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
    setSelectedDate(next);
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
                      <View style={styles.historyContent}>
                        {mealPhotoUrls[meal.id] ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open meal photo"
                            onPress={() => setExpandedPhotoUrl(mealPhotoUrls[meal.id])}
                            style={({ pressed }) => [
                              styles.mealThumbWrap,
                              pressed ? styles.thumbPressed : null
                            ]}
                          >
                            <Image source={{ uri: mealPhotoUrls[meal.id] }} style={styles.mealThumb} />
                          </Pressable>
                        ) : null}
                        <View style={styles.historyDetails}>
                          <Text style={styles.item}>{formatMealTimestamp(meal.created_at)}</Text>
                          <Text
                            style={styles.mealSummary}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {formatMealSummary(meal)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Save meal"
                          onPress={() => handleSaveMeal(meal)}
                          style={({ pressed }) => [
                            styles.historyActionIcon,
                            pressed ? styles.iconButtonPressed : null
                          ]}
                        >
                          <Ionicons name="bookmark-outline" size={20} color="#111" />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Edit meal"
                          onPress={() => navigation.navigate("Capture", { mealId: meal.id })}
                          style={({ pressed }) => [
                            styles.historyActionIcon,
                            pressed ? styles.iconButtonPressed : null
                          ]}
                        >
                          <Ionicons name="create-outline" size={20} color="#111" />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete meal"
                          onPress={() => handleDeleteMeal(meal)}
                          style={({ pressed }) => [
                            styles.historyActionIcon,
                            pressed ? styles.iconButtonPressed : null
                          ]}
                        >
                          <Ionicons name="trash-outline" size={20} color="#b42318" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState message="No meals logged for this date." />
                )}
              </View>
              <View style={styles.subsection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isDailyTotalsExpanded ? "Collapse daily totals" : "Expand daily totals"
                  }
                  onPress={() => setIsDailyTotalsExpanded((value) => !value)}
                  style={({ pressed }) => [
                    styles.subsectionHeader,
                    pressed ? styles.iconButtonPressed : null
                  ]}
                >
                  <View style={styles.subsectionHeaderText}>
                    <Text style={styles.subsectionTitle}>
                      Daily nutrients (%DV)
                    </Text>
                    <Text style={styles.subsectionHint}>
                      {isDailyTotalsExpanded ? "Hide details" : "Show details"}
                    </Text>
                  </View>
                  <Ionicons
                    name={isDailyTotalsExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#555"
                  />
                </Pressable>
                {dateMeals.length ? (
                  isDailyTotalsExpanded ? (
                    NUTRIENT_KEYS.map((key) => (
                      <NutrientBarRow
                        key={key}
                        label={formatNutrientLabel(key)}
                        percentDv={dateTotals.percent_dv[key]}
                        onPress={() =>
                          (navigation.getParent() as { navigate: (a: string, b: { nutrientKey: string }) => void }).navigate(
                            "NutrientDetail",
                            { nutrientKey: key }
                          )
                        }
                      />
                    ))
                  ) : (
                    <Text style={styles.cardSubtitle}>
                      Totals are collapsed by default for this day.
                    </Text>
                  )
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
      <Modal
        visible={Boolean(expandedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPhotoUrl(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setExpandedPhotoUrl(null)} />
          <View style={styles.modalCard}>
            {expandedPhotoUrl ? (
              <Image
                source={{ uri: expandedPhotoUrl }}
                style={styles.expandedImage}
                resizeMode="contain"
              />
            ) : null}
            <AppButton
              title="Close"
              onPress={() => setExpandedPhotoUrl(null)}
              variant="secondary"
              fullWidth={false}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(saveMealTarget)}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSaveMeal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={handleCancelSaveMeal} />
          <View style={styles.modalCardLight}>
            <Text style={styles.modalTitle}>Save meal</Text>
            <Text style={styles.modalSubtitle}>Name this saved meal to reuse later.</Text>
            <TextInput
              style={styles.saveMealInput}
              placeholder="e.g. Breakfast usual"
              placeholderTextColor="#888"
              value={saveMealName}
              onChangeText={setSaveMealName}
              editable={!isSavingMeal}
              autoCapitalize="words"
            />
            <View style={styles.modalActions}>
              <AppButton
                title="Cancel"
                onPress={handleCancelSaveMeal}
                variant="secondary"
                fullWidth={false}
              />
              <AppButton
                title={isSavingMeal ? "Saving…" : "Save"}
                onPress={handleConfirmSaveMeal}
                variant="primary"
                fullWidth={false}
                disabled={!saveMealName.trim() || isSavingMeal}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  historyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0
  },
  historyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  mealThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#e4e7ec"
  },
  mealThumbWrap: {
    borderRadius: 10,
    overflow: "hidden"
  },
  thumbPressed: {
    opacity: 0.8
  },
  historyDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  mealSummary: {
    fontSize: 14,
    color: "#555"
  },
  historyActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e4"
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
    backgroundColor: "#f3f3f3",
    position: "relative"
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
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#555",
    position: "absolute",
    bottom: 6
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
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  subsectionHeaderText: {
    gap: 2
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111"
  },
  subsectionHint: {
    fontSize: 12,
    color: "#666"
  },
  item: {
    fontSize: 13,
    color: "#333"
  },
  nutrientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  nutrientBandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  nutrientBandBadgeText: {
    fontSize: 12,
    fontWeight: "600"
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    borderRadius: 16,
    backgroundColor: "#111",
    padding: 14,
    gap: 10
  },
  modalCardLight: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
    gap: 8
  },
  expandedImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#000"
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12
  },
  saveMealInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#fff",
    marginBottom: 16
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end"
  }
});
