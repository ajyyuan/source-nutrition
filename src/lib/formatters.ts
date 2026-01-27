const NUTRIENT_LABELS: Record<string, string> = {
  vitamin_a_ug: "Vitamin A",
  vitamin_c_mg: "Vitamin C",
  vitamin_d_ug: "Vitamin D",
  vitamin_e_mg: "Vitamin E",
  vitamin_k_ug: "Vitamin K",
  thiamin_mg: "Thiamin",
  riboflavin_mg: "Riboflavin",
  niacin_mg: "Niacin",
  vitamin_b6_mg: "Vitamin B6",
  folate_ug: "Folate",
  vitamin_b12_ug: "Vitamin B12",
  calcium_mg: "Calcium",
  iron_mg: "Iron",
  magnesium_mg: "Magnesium",
  phosphorus_mg: "Phosphorus",
  potassium_mg: "Potassium",
  zinc_mg: "Zinc",
  selenium_ug: "Selenium",
  omega3_g: "Omega-3"
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const formatNutrientLabel = (key: string) =>
  NUTRIENT_LABELS[key] ?? toTitleCase(key.replace(/_/g, " "));

export const formatConfidence = (value: number) =>
  `Confidence: ${Math.round(value * 100)}%`;
