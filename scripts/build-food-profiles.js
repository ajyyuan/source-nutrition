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

  const profiles = {};
  for (const r of rows) {
    if (!r.is_canon_v1 || !r.is_usable) continue;
    const id = r.canonical_id;
    if (!id) continue;
    const displayName =
      BEEF_CUT_DISPLAY_OVERRIDES[id] ?? r.canonical_name ?? r.display_name ?? id;
    profiles[id] = {
      display_name: displayName,
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
