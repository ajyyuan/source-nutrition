/**
 * FDA Daily Values (DV) for labeling — used for %DV on food screens and elsewhere.
 * Keep in sync with supabase/functions/_shared/nutrients.ts DAILY_VALUES.
 */

export type NutrientKey = keyof typeof DAILY_VALUES;

export const DAILY_VALUES: Record<string, number> = {
  vitamin_a_ug: 900,
  vitamin_c_mg: 90,
  vitamin_d_ug: 20,
  vitamin_e_mg: 15,
  vitamin_k_ug: 120,
  thiamin_mg: 1.2,
  riboflavin_mg: 1.3,
  niacin_mg: 16,
  vitamin_b5_mg: 5,
  vitamin_b6_mg: 1.7,
  vitamin_b7_ug: 30,
  folate_ug: 400,
  vitamin_b12_ug: 2.4,
  calcium_mg: 1300,
  iron_mg: 18,
  magnesium_mg: 420,
  phosphorus_mg: 1250,
  potassium_mg: 4700,
  zinc_mg: 11,
  selenium_ug: 55,
  omega3_g: 1.6
};

/** Percent of daily value (0–1+) for a given amount. */
export function percentDv(nutrientKey: string, amount: number): number {
  const dv = DAILY_VALUES[nutrientKey];
  if (!dv || dv <= 0 || !Number.isFinite(amount)) return 0;
  return amount / dv;
}
