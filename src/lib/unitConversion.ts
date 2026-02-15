export type QuantityUnit = "g" | "oz" | "lb" | "ml" | "fl oz" | "cup" | "tbsp" | "tsp";

export const QUANTITY_UNITS: QuantityUnit[] = [
  "g",
  "oz",
  "lb",
  "ml",
  "fl oz",
  "cup",
  "tbsp",
  "tsp"
];

const GRAMS_PER_UNIT: Record<QuantityUnit, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.59237,
  ml: 1,
  "fl oz": 29.5735,
  cup: 236.588,
  tbsp: 14.7868,
  tsp: 4.92892
};

export const toGrams = (value: number, unit: QuantityUnit): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(value, 0) * GRAMS_PER_UNIT[unit];
};
