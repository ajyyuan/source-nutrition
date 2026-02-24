/**
 * Builds canon lookup JSON for the map-foods edge function from the reseed preview.
 * Output: supabase/functions/map-foods/canon-lookup.json
 * Run after canon:reseed:dry (same as canon:food-profiles). No DB or canonical_food_aliases.
 */

const fs = require("fs");
const path = require("path");

const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const OUT_PATH = path.resolve("supabase/functions/map-foods/canon-lookup.json");

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

const isSurveyFdcId = (fdcId) => typeof fdcId === "string" && /^2\d+/.test(fdcId);

function sumPer100g(per100g) {
  if (!per100g || typeof per100g !== "object") return 0;
  return NUTRIENT_KEYS.reduce(
    (acc, key) => acc + (Number.isFinite(per100g[key]) ? per100g[key] : 0),
    0
  );
}

function run() {
  if (!fs.existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing reseed preview: ${PREVIEW_PATH}. Run npm run canon:reseed:dry first.`);
  }

  const payload = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const items = [];
  for (const r of rows) {
    const canonicalId = typeof r?.canonical_id === "string" ? r.canonical_id.trim() : "";
    const canonicalName =
      typeof r?.canonical_name === "string" ? r.canonical_name.trim() : "";
    if (!canonicalId || !canonicalName) continue;

    const fdcId = typeof r?.fdc_id === "string" ? r.fdc_id.trim() : "";
    const per100gSum = sumPer100g(r?.per_100g);
    const unusableSurveyRow = isSurveyFdcId(fdcId) && per100gSum === 0;
    const usable = Boolean(r?.is_canon_v1 && r?.is_usable && !unusableSurveyRow);

    const aliases = Array.isArray(r?.aliases)
      ? r.aliases.filter((a) => typeof a === "string" && a.trim().length > 0)
      : [];

    items.push({
      canonical_id: canonicalId,
      canonical_name: canonicalName,
      aliases,
      usable
    });
  }

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(items), "utf8");
  const usableCount = items.filter((i) => i.usable).length;
  console.log(`Wrote ${OUT_PATH} (${items.length} items, ${usableCount} usable)`);
}

run();
