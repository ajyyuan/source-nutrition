export type NutrientKey =
  | "vitamin_a_ug"
  | "vitamin_c_mg"
  | "vitamin_d_ug"
  | "vitamin_e_mg"
  | "vitamin_k_ug"
  | "thiamin_mg"
  | "riboflavin_mg"
  | "niacin_mg"
  | "vitamin_b6_mg"
  | "folate_ug"
  | "vitamin_b12_ug"
  | "calcium_mg"
  | "iron_mg"
  | "magnesium_mg"
  | "phosphorus_mg"
  | "potassium_mg"
  | "zinc_mg"
  | "selenium_ug"
  | "omega3_g";

export type NutrientVector = Record<NutrientKey, number>;

export type CanonicalFoodNutrients = {
  canonical_id: string;
  canonical_name: string;
  per_100g: NutrientVector;
  source: "stub";
};

export const NUTRIENT_DB_VERSION = "v0.1-stub";

const makeZeroVector = (): NutrientVector => ({
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

const CANONICAL_NUTRIENTS: Record<string, CanonicalFoodNutrients> = {
  "food-unknown": {
    canonical_id: "food-unknown",
    canonical_name: "Unknown food",
    per_100g: makeZeroVector(),
    source: "stub"
  },
  "apple-raw": {
    canonical_id: "apple-raw",
    canonical_name: "Apple, raw",
    per_100g: makeZeroVector(),
    source: "stub"
  },
  "spinach-raw": {
    canonical_id: "spinach-raw",
    canonical_name: "Spinach, raw",
    per_100g: makeZeroVector(),
    source: "stub"
  },
  "salmon-cooked": {
    canonical_id: "salmon-cooked",
    canonical_name: "Salmon, cooked",
    per_100g: makeZeroVector(),
    source: "stub"
  },
  "egg-whole": {
    canonical_id: "egg-whole",
    canonical_name: "Egg, whole",
    per_100g: makeZeroVector(),
    source: "stub"
  }
};

export const listCanonicalFoods = (): CanonicalFoodNutrients[] =>
  Object.values(CANONICAL_NUTRIENTS);

export const getNutrientsForCanonicalId = (
  canonicalId: string
): CanonicalFoodNutrients | null =>
  CANONICAL_NUTRIENTS[canonicalId] ?? null;
