/**
 * Builds src/data/topFoodsByNutrient.json from the canon reseed preview.
 * For each nutrient, lists top N foods by per-100g value (descending).
 * Used by the app's nutrient detail screen for "foods high in this nutrient."
 */

const fs = require("fs");
const path = require("path");

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
];

const TOP_N = 15;
const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const OUT_PATH = path.resolve("src/data/topFoodsByNutrient.json");

/** Exclude cooking oils/fats from top-foods list (per 100g they dominate many nutrients). */
const EXCLUDED_FOOD_GROUPS = new Set(["Plant oils", "Animal fats"]);

const isCookingOilOrFat = (r) =>
  EXCLUDED_FOOD_GROUPS.has(r.food_group) || (r.canonical_id && r.canonical_id.endsWith("-oil"));

/** Display name overrides for beef cuts so we show "Beef chuck" etc. in the app. */
const BEEF_CUT_DISPLAY_OVERRIDES = {
  ribeye: "Beef ribeye",
  "strip-steak": "Beef strip steak",
  tenderloin: "Beef tenderloin",
  sirloin: "Beef sirloin",
  flank: "Beef flank",
  skirt: "Beef skirt",
  hanger: "Beef hanger",
  chuck: "Beef chuck",
  brisket: "Beef brisket",
  "short-ribs": "Beef short ribs",
  "back-ribs": "Beef back ribs",
  round: "Beef round",
  shank: "Beef shank",
  oxtail: "Beef oxtail",
  plate: "Beef plate",
  "stew-meat": "Beef stew meat"
};

const run = () => {
  if (!fs.existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing reseed preview: ${PREVIEW_PATH}. Run npm run canon:reseed:dry first.`);
  }

  const payload = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const result = {};

  NUTRIENT_KEYS.forEach((key) => {
    // Vitamin K in the app = K1 + K2 combined
    const getValue = (r) => {
      const p = r.per_100g;
      if (key === "vitamin_k_ug") {
        const k1 = typeof p?.vitamin_k_ug === "number" && Number.isFinite(p.vitamin_k_ug) ? p.vitamin_k_ug : 0;
        const k2 = typeof p?.vitamin_k2_ug === "number" && Number.isFinite(p.vitamin_k2_ug) ? p.vitamin_k2_ug : 0;
        return k1 + k2;
      }
      return p?.[key];
    };

    const entries = rows
      .filter((r) => {
        if (!r.per_100g || isCookingOilOrFat(r)) return false;
        const val = getValue(r);
        return Number.isFinite(val) && val > 0;
      })
      .map((r) => {
        const name =
          BEEF_CUT_DISPLAY_OVERRIDES[r.canonical_id] ??
          r.canonical_name ??
          r.display_name ??
          r.canonical_id ??
          "";
        return {
          name,
          value: getValue(r),
          canonical_id: r.canonical_id || null
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);

    result[key] = entries;
  });

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote ${OUT_PATH}`);
};

run();
