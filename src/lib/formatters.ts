const NUTRIENT_LABELS: Record<string, string> = {
  vitamin_a_ug: "Vitamin A",
  vitamin_c_mg: "Vitamin C",
  vitamin_d_ug: "Vitamin D",
  vitamin_e_mg: "Vitamin E",
  vitamin_k_ug: "Vitamin K",
  thiamin_mg: "Vitamin B1 (Thiamin)",
  riboflavin_mg: "Vitamin B2 (Riboflavin)",
  niacin_mg: "Vitamin B3 (Niacin)",
  vitamin_b5_mg: "Vitamin B5 (Pantothenic Acid)",
  vitamin_b6_mg: "Vitamin B6",
  vitamin_b7_ug: "Vitamin B7 (Biotin)",
  folate_ug: "Vitamin B9 (Folate)",
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

/** Value to show for a nutrient (combines K1+K2 for Vitamin K). */
export function getDisplayNutrientValue(
  nutrientKey: string,
  per100g: Record<string, number>
): number {
  if (nutrientKey === "vitamin_k_ug") {
    const k1 = per100g?.vitamin_k_ug;
    const k2 = per100g?.vitamin_k2_ug;
    const a = typeof k1 === "number" && Number.isFinite(k1) ? k1 : 0;
    const b = typeof k2 === "number" && Number.isFinite(k2) ? k2 : 0;
    return a + b;
  }
  const v = per100g?.[nutrientKey];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Total to show for a nutrient (combines K1+K2 for Vitamin K). */
export function getDisplayNutrientTotal(
  nutrientKey: string,
  totals: Record<string, number>
): number {
  if (nutrientKey === "vitamin_k_ug") {
    const k1 = totals?.vitamin_k_ug;
    const k2 = totals?.vitamin_k2_ug;
    const a = typeof k1 === "number" && Number.isFinite(k1) ? k1 : 0;
    const b = typeof k2 === "number" && Number.isFinite(k2) ? k2 : 0;
    return a + b;
  }
  const v = totals?.[nutrientKey];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Format a nutrient value for display (per 100 g). */
export function formatNutrientValue(nutrientKey: string, value: number): string {
  if (nutrientKey === "omega3_g") {
    return value >= 1 ? `${value.toFixed(1)} g` : `${(value * 1000).toFixed(0)} mg`;
  }
  if (nutrientKey.endsWith("_ug")) {
    return `${value.toFixed(1)} µg`;
  }
  if (nutrientKey.endsWith("_mg")) {
    return value >= 1 ? `${value.toFixed(1)} mg` : `${(value * 1000).toFixed(0)} µg`;
  }
  if (nutrientKey.endsWith("_g")) {
    return `${value.toFixed(2)} g`;
  }
  return String(value);
}
