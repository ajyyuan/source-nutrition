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

const run = () => {
  if (!fs.existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing reseed preview: ${PREVIEW_PATH}. Run npm run canon:reseed:dry first.`);
  }

  const payload = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const result = {};

  NUTRIENT_KEYS.forEach((key) => {
    const entries = rows
      .filter((r) => r.per_100g && Number.isFinite(r.per_100g[key]) && r.per_100g[key] > 0)
      .map((r) => ({
        name: r.canonical_name || r.display_name || r.canonical_id || "",
        value: r.per_100g[key]
      }))
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
