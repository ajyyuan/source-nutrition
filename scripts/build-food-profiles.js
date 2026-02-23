/**
 * Builds src/data/foodProfiles.json from the canon reseed preview.
 * One entry per canon food: canonical_id -> { display_name, per_100g }.
 * Used by the app's food detail screen for full micronutrient profile per 100 g.
 * Only includes rows with is_canon_v1 && is_usable.
 */

const fs = require("fs");
const path = require("path");

const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const OUT_PATH = path.resolve("src/data/foodProfiles.json");

const run = () => {
  if (!fs.existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing reseed preview: ${PREVIEW_PATH}. Run npm run canon:reseed:dry first.`);
  }

  const payload = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const profiles = {};
  for (const r of rows) {
    if (!r.is_canon_v1 || !r.is_usable) continue;
    const id = r.canonical_id;
    if (!id) continue;
    profiles[id] = {
      display_name: r.canonical_name || r.display_name || id,
      per_100g: r.per_100g && typeof r.per_100g === "object" ? r.per_100g : {}
    };
  }

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(profiles, null, 2), "utf8");
  console.log(`Wrote ${OUT_PATH} (${Object.keys(profiles).length} foods)`);
};

run();
