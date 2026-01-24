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

export type DailyValue = Record<NutrientKey, number>;

export type CanonicalFoodNutrients = {
  canonical_id: string;
  canonical_name: string;
  per_100g: NutrientVector;
  source: "stub" | "usda";
};

export const NUTRIENT_DB_VERSION = "v0.2-usda-100g";

export const DAILY_VALUES: DailyValue = {
  vitamin_a_ug: 900,
  vitamin_c_mg: 90,
  vitamin_d_ug: 20,
  vitamin_e_mg: 15,
  vitamin_k_ug: 120,
  thiamin_mg: 1.2,
  riboflavin_mg: 1.3,
  niacin_mg: 16,
  vitamin_b6_mg: 1.7,
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

// Values are per 100g and sourced from USDA FoodData Central (via MyFoodData).
// Any nutrient missing from the source is set to 0 for now.
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
    per_100g: {
      vitamin_a_ug: 3,
      vitamin_c_mg: 4.6,
      vitamin_d_ug: 0,
      vitamin_e_mg: 0.18,
      vitamin_k_ug: 2.2,
      thiamin_mg: 0.02,
      riboflavin_mg: 0.03,
      niacin_mg: 0.09,
      vitamin_b6_mg: 0.04,
      folate_ug: 3,
      vitamin_b12_ug: 0,
      calcium_mg: 6,
      iron_mg: 0.12,
      magnesium_mg: 5,
      phosphorus_mg: 11,
      potassium_mg: 107,
      zinc_mg: 0.04,
      selenium_ug: 0,
      omega3_g: 0.009
    },
    source: "usda"
  },
  "spinach-raw": {
    canonical_id: "spinach-raw",
    canonical_name: "Spinach, raw",
    per_100g: {
      vitamin_a_ug: 469,
      vitamin_c_mg: 28.1,
      vitamin_d_ug: 0,
      vitamin_e_mg: 2,
      vitamin_k_ug: 482.9,
      thiamin_mg: 0.08,
      riboflavin_mg: 0.19,
      niacin_mg: 0.72,
      vitamin_b6_mg: 0.2,
      folate_ug: 194,
      vitamin_b12_ug: 0,
      calcium_mg: 99,
      iron_mg: 2.7,
      magnesium_mg: 79,
      phosphorus_mg: 49,
      potassium_mg: 558,
      zinc_mg: 0.53,
      selenium_ug: 1,
      omega3_g: 0.138
    },
    source: "usda"
  },
  "salmon-cooked": {
    canonical_id: "salmon-cooked",
    canonical_name: "Salmon, cooked",
    per_100g: {
      vitamin_a_ug: 13,
      vitamin_c_mg: 0,
      vitamin_d_ug: 0,
      vitamin_e_mg: 0,
      vitamin_k_ug: 0,
      thiamin_mg: 0.28,
      riboflavin_mg: 0.49,
      niacin_mg: 10.1,
      vitamin_b6_mg: 0.94,
      folate_ug: 29,
      vitamin_b12_ug: 3.1,
      calcium_mg: 15,
      iron_mg: 1,
      magnesium_mg: 37,
      phosphorus_mg: 256,
      potassium_mg: 628,
      zinc_mg: 0.82,
      selenium_ug: 46.8,
      omega3_g: 2.208
    },
    source: "usda"
  },
  "egg-whole": {
    canonical_id: "egg-whole",
    canonical_name: "Egg, whole",
    per_100g: {
      vitamin_a_ug: 149,
      vitamin_c_mg: 0,
      vitamin_d_ug: 2.2,
      vitamin_e_mg: 1,
      vitamin_k_ug: 0.3,
      thiamin_mg: 0.07,
      riboflavin_mg: 0.51,
      niacin_mg: 0.06,
      vitamin_b6_mg: 0.12,
      folate_ug: 44,
      vitamin_b12_ug: 1.1,
      calcium_mg: 50,
      iron_mg: 1.2,
      magnesium_mg: 10,
      phosphorus_mg: 172,
      potassium_mg: 126,
      zinc_mg: 1.1,
      selenium_ug: 30.8,
      omega3_g: 0.035
    },
    source: "usda"
  }
};

export const listCanonicalFoods = (): CanonicalFoodNutrients[] =>
  Object.values(CANONICAL_NUTRIENTS);

export const getNutrientsForCanonicalId = (
  canonicalId: string
): CanonicalFoodNutrients | null =>
  CANONICAL_NUTRIENTS[canonicalId] ?? null;

export type MealItemInput = {
  canonical_id: string;
  grams: number;
};

export type MealNutrientTotals = {
  totals: NutrientVector;
  percent_dv: NutrientVector;
};

const addVectors = (base: NutrientVector, delta: NutrientVector): NutrientVector => ({
  vitamin_a_ug: base.vitamin_a_ug + delta.vitamin_a_ug,
  vitamin_c_mg: base.vitamin_c_mg + delta.vitamin_c_mg,
  vitamin_d_ug: base.vitamin_d_ug + delta.vitamin_d_ug,
  vitamin_e_mg: base.vitamin_e_mg + delta.vitamin_e_mg,
  vitamin_k_ug: base.vitamin_k_ug + delta.vitamin_k_ug,
  thiamin_mg: base.thiamin_mg + delta.thiamin_mg,
  riboflavin_mg: base.riboflavin_mg + delta.riboflavin_mg,
  niacin_mg: base.niacin_mg + delta.niacin_mg,
  vitamin_b6_mg: base.vitamin_b6_mg + delta.vitamin_b6_mg,
  folate_ug: base.folate_ug + delta.folate_ug,
  vitamin_b12_ug: base.vitamin_b12_ug + delta.vitamin_b12_ug,
  calcium_mg: base.calcium_mg + delta.calcium_mg,
  iron_mg: base.iron_mg + delta.iron_mg,
  magnesium_mg: base.magnesium_mg + delta.magnesium_mg,
  phosphorus_mg: base.phosphorus_mg + delta.phosphorus_mg,
  potassium_mg: base.potassium_mg + delta.potassium_mg,
  zinc_mg: base.zinc_mg + delta.zinc_mg,
  selenium_ug: base.selenium_ug + delta.selenium_ug,
  omega3_g: base.omega3_g + delta.omega3_g
});

const scaleVector = (per100g: NutrientVector, grams: number): NutrientVector => {
  const multiplier = grams / 100;
  return {
    vitamin_a_ug: per100g.vitamin_a_ug * multiplier,
    vitamin_c_mg: per100g.vitamin_c_mg * multiplier,
    vitamin_d_ug: per100g.vitamin_d_ug * multiplier,
    vitamin_e_mg: per100g.vitamin_e_mg * multiplier,
    vitamin_k_ug: per100g.vitamin_k_ug * multiplier,
    thiamin_mg: per100g.thiamin_mg * multiplier,
    riboflavin_mg: per100g.riboflavin_mg * multiplier,
    niacin_mg: per100g.niacin_mg * multiplier,
    vitamin_b6_mg: per100g.vitamin_b6_mg * multiplier,
    folate_ug: per100g.folate_ug * multiplier,
    vitamin_b12_ug: per100g.vitamin_b12_ug * multiplier,
    calcium_mg: per100g.calcium_mg * multiplier,
    iron_mg: per100g.iron_mg * multiplier,
    magnesium_mg: per100g.magnesium_mg * multiplier,
    phosphorus_mg: per100g.phosphorus_mg * multiplier,
    potassium_mg: per100g.potassium_mg * multiplier,
    zinc_mg: per100g.zinc_mg * multiplier,
    selenium_ug: per100g.selenium_ug * multiplier,
    omega3_g: per100g.omega3_g * multiplier
  };
};

const computePercentDv = (totals: NutrientVector): NutrientVector => ({
  vitamin_a_ug: DAILY_VALUES.vitamin_a_ug
    ? totals.vitamin_a_ug / DAILY_VALUES.vitamin_a_ug
    : 0,
  vitamin_c_mg: DAILY_VALUES.vitamin_c_mg
    ? totals.vitamin_c_mg / DAILY_VALUES.vitamin_c_mg
    : 0,
  vitamin_d_ug: DAILY_VALUES.vitamin_d_ug
    ? totals.vitamin_d_ug / DAILY_VALUES.vitamin_d_ug
    : 0,
  vitamin_e_mg: DAILY_VALUES.vitamin_e_mg
    ? totals.vitamin_e_mg / DAILY_VALUES.vitamin_e_mg
    : 0,
  vitamin_k_ug: DAILY_VALUES.vitamin_k_ug
    ? totals.vitamin_k_ug / DAILY_VALUES.vitamin_k_ug
    : 0,
  thiamin_mg: DAILY_VALUES.thiamin_mg ? totals.thiamin_mg / DAILY_VALUES.thiamin_mg : 0,
  riboflavin_mg: DAILY_VALUES.riboflavin_mg
    ? totals.riboflavin_mg / DAILY_VALUES.riboflavin_mg
    : 0,
  niacin_mg: DAILY_VALUES.niacin_mg ? totals.niacin_mg / DAILY_VALUES.niacin_mg : 0,
  vitamin_b6_mg: DAILY_VALUES.vitamin_b6_mg
    ? totals.vitamin_b6_mg / DAILY_VALUES.vitamin_b6_mg
    : 0,
  folate_ug: DAILY_VALUES.folate_ug ? totals.folate_ug / DAILY_VALUES.folate_ug : 0,
  vitamin_b12_ug: DAILY_VALUES.vitamin_b12_ug
    ? totals.vitamin_b12_ug / DAILY_VALUES.vitamin_b12_ug
    : 0,
  calcium_mg: DAILY_VALUES.calcium_mg ? totals.calcium_mg / DAILY_VALUES.calcium_mg : 0,
  iron_mg: DAILY_VALUES.iron_mg ? totals.iron_mg / DAILY_VALUES.iron_mg : 0,
  magnesium_mg: DAILY_VALUES.magnesium_mg
    ? totals.magnesium_mg / DAILY_VALUES.magnesium_mg
    : 0,
  phosphorus_mg: DAILY_VALUES.phosphorus_mg
    ? totals.phosphorus_mg / DAILY_VALUES.phosphorus_mg
    : 0,
  potassium_mg: DAILY_VALUES.potassium_mg
    ? totals.potassium_mg / DAILY_VALUES.potassium_mg
    : 0,
  zinc_mg: DAILY_VALUES.zinc_mg ? totals.zinc_mg / DAILY_VALUES.zinc_mg : 0,
  selenium_ug: DAILY_VALUES.selenium_ug ? totals.selenium_ug / DAILY_VALUES.selenium_ug : 0,
  omega3_g: DAILY_VALUES.omega3_g ? totals.omega3_g / DAILY_VALUES.omega3_g : 0
});

export const computeMealTotals = (items: MealItemInput[]): MealNutrientTotals => {
  const totals = items.reduce((acc, item) => {
    const grams = Number.isFinite(item.grams) ? Math.max(item.grams, 0) : 0;
    const entry = getNutrientsForCanonicalId(item.canonical_id) ?? CANONICAL_NUTRIENTS["food-unknown"];
    return addVectors(acc, scaleVector(entry.per_100g, grams));
  }, makeZeroVector());

  return {
    totals,
    percent_dv: computePercentDv(totals)
  };
};
