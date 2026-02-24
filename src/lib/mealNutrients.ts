/**
 * Compute meal and item nutrient totals from bundled foodProfiles (per_100g).
 * Replaces reliance on Supabase canonical_foods for nutrients.
 * Logic matches supabase/functions/_shared/nutrients.ts (Vitamin K = K1+K2 for %DV).
 */

import { DAILY_VALUES } from "./dailyValues";
import foodProfiles from "../data/foodProfiles.json";

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "vitamin_k2_ug",
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

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type NutrientVector = Record<NutrientKey, number>;

export type ItemNutrientTotals = {
  totals: NutrientVector;
  percent_dv: NutrientVector;
};

export type MealNutrientTotals = ItemNutrientTotals;

export type FoodProfile = {
  display_name: string;
  per_100g: Record<string, number>;
};

const profiles = foodProfiles as Record<string, FoodProfile>;

export const NUTRIENT_DB_VERSION = "client-bundled-v1";

function makeZeroVector(): NutrientVector {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as NutrientVector);
}

function getPer100g(canonicalId: string): NutrientVector | null {
  const profile = profiles[canonicalId];
  const raw = profile?.per_100g;
  if (!raw || typeof raw !== "object") return null;
  const out = makeZeroVector();
  NUTRIENT_KEYS.forEach((key) => {
    const v = raw[key];
    out[key] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  });
  return out;
}

/** Percent DV: Vitamin K uses K1+K2 combined; vitamin_k2_ug %dv is 0. */
function computePercentDv(totals: NutrientVector): NutrientVector {
  const dv = DAILY_VALUES as Record<string, number>;
  const percent_dv = makeZeroVector();
  NUTRIENT_KEYS.forEach((key) => {
    if (key === "vitamin_k2_ug") {
      percent_dv[key] = 0;
      return;
    }
    if (key === "vitamin_k_ug") {
      const totalK = (totals.vitamin_k_ug ?? 0) + (totals.vitamin_k2_ug ?? 0);
      percent_dv[key] = dv.vitamin_k_ug ? totalK / dv.vitamin_k_ug : 0;
      return;
    }
    const d = dv[key];
    percent_dv[key] = d && d > 0 ? (totals[key] ?? 0) / d : 0;
  });
  return percent_dv;
}

/** Compute item totals from per_100g and grams. */
export function computeItemTotalsFromPer100g(
  per100g: NutrientVector,
  grams: number
): ItemNutrientTotals {
  const safeGrams = Number.isFinite(grams) ? Math.max(grams, 0) : 0;
  const mult = safeGrams / 100;
  const totals = makeZeroVector();
  NUTRIENT_KEYS.forEach((key) => {
    totals[key] = (per100g[key] ?? 0) * mult;
  });
  return {
    totals,
    percent_dv: computePercentDv(totals)
  };
}

/** Sum percent_dv for a vector (for top contributors). */
export function sumPercentDv(percentDv: NutrientVector): number {
  return Object.values(percentDv).reduce(
    (acc, v) => acc + (Number.isFinite(v) ? Math.max(v, 0) : 0),
    0
  );
}

/** Add two nutrient vectors. */
function addVectors(a: NutrientVector, b: NutrientVector): NutrientVector {
  const out = makeZeroVector();
  NUTRIENT_KEYS.forEach((key) => {
    out[key] = (a[key] ?? 0) + (b[key] ?? 0);
  });
  return out;
}

/** Compute meal totals from items (each with canonical_id and grams). */
export function computeMealTotalsFromItems(
  items: Array<{ canonical_id: string; grams: number }>
): MealNutrientTotals {
  let acc = makeZeroVector();
  for (const item of items) {
    const per100g = getPer100g(item.canonical_id);
    if (!per100g) continue;
    const { totals } = computeItemTotalsFromPer100g(per100g, item.grams);
    acc = addVectors(acc, totals);
  }
  return {
    totals: acc,
    percent_dv: computePercentDv(acc)
  };
}

export type TopContributor = {
  canonical_id: string;
  name: string;
  score: number;
};

/** Build insights.top_contributors from items with nutrient_totals. */
export function computeTopContributors(
  items: Array<{
    canonical_id: string;
    canonical_name: string;
    nutrient_totals: ItemNutrientTotals;
  }>
): TopContributor[] {
  return items
    .map((item) => ({
      canonical_id: item.canonical_id,
      name: item.canonical_name,
      score: sumPercentDv(item.nutrient_totals.percent_dv)
    }))
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Add nutrient_totals to mapped items using bundled foodProfiles. */
export function addNutrientsFromFoodProfiles<T extends { canonical_id: string; grams: number }>(
  items: T[]
): (T & { nutrient_totals: ItemNutrientTotals })[] {
  return items.map((item) => {
    const per100g = getPer100g(item.canonical_id);
    const nutrient_totals = per100g
      ? computeItemTotalsFromPer100g(per100g, item.grams)
      : { totals: makeZeroVector(), percent_dv: makeZeroVector() };
    return { ...item, nutrient_totals };
  });
}

/** Compute meal totals and insights from items that have nutrient_totals. */
export function computeMealTotalsAndInsights(items: Array<{
  canonical_id: string;
  canonical_name: string;
  grams: number;
  nutrient_totals: ItemNutrientTotals;
}>): {
  nutrient_totals: MealNutrientTotals;
  insights: { top_contributors: TopContributor[] };
} {
  const nutrient_totals = computeMealTotalsFromItems(
    items.map((i) => ({ canonical_id: i.canonical_id, grams: i.grams }))
  );
  const top_contributors = computeTopContributors(items);
  return {
    nutrient_totals,
    insights: { top_contributors }
  };
}
