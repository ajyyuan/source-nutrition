#!/usr/bin/env node
/**
 * Fill all remaining animal-domain biotin blanks with BLS or literature values.
 * Patches: supplemental-source-rows (biotin-only), manual-curation (point to patch), external-biotin-provenance.
 * Only adds vitamin_b7_ug; removes any key in missing_nutrient_keys from baseline per_100g.
 */

const fs = require("fs");
const path = require("path");

const COVERAGE_PATH = path.resolve("data/canon/source-canon-v1.micronutrient-coverage.csv");
const RESEED_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const SUPPLEMENTAL_PATH = path.resolve("data/canon/source-canon-v1.supplemental-source-rows.json");
const CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const PROVENANCE_PATH = path.resolve("data/canon/source-canon-v1.external-biotin-provenance.json");

// Vetted biotin (μg/100g) and provenance. BLS when same food; literature proxy otherwise.
const ANIMAL_BIOTIN_MAP = {
  "ground-goat": { ug: 1, source: "literature", donor_name: "Muscle meat proxy (literature ~1 µg/100g)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "shank": { ug: 0, source: "bls", bls_code: "U291100", donor_name: "Beef leg/hindshank, raw", match_type: "exact" },
  "beef-pancreas": { ug: 8, source: "literature", donor_name: "Organ meat proxy (literature)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "pork-brain": { ug: 5, source: "bls", bls_code: "Y372012", donor_name: "Pork brain fried with egg", match_type: "species-proxy" },
  "pork-jowl": { ug: 0.59, source: "bls", bls_code: "U507100", donor_name: "Pork fat jowl, without rind (S VI) raw", match_type: "exact" },
  "beef-thymus-sweetbreads": { ug: 3, source: "bls", bls_code: "V582100", donor_name: "Veal sweetbread, raw", match_type: "species-proxy" },
  "ground-bison": { ug: 1, source: "literature", donor_name: "Ground beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "chop-lamb-goat": { ug: 1, source: "literature", donor_name: "Lamb muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "ground-chicken": { ug: 1, source: "literature", donor_name: "Poultry muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "back-ribs": { ug: 5, source: "bls", bls_code: "U235100", donor_name: "Beef forerib/prime rib, raw", match_type: "cut-proxy" },
  "ghee": { ug: 2.5, source: "literature", donor_name: "Butter fat proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "strip-steak": { ug: 5, source: "bls", bls_code: "U211100", donor_name: "Beef fillet (tenderloin) raw", match_type: "cut-proxy" },
  "duck-breast": { ug: 0.88, source: "bls", bls_code: "V466172", donor_name: "Duck breast, with skin, grilled", match_type: "species-proxy" },
  "beef-tallow": { ug: 0, source: "literature", donor_name: "Refined fat (no biotin)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "chicken-fat": { ug: 0, source: "literature", donor_name: "Refined fat (no biotin)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "pork-lard": { ug: 0, source: "bls", bls_code: "Y371013", donor_name: "Larded pork heart (fat proxy)", match_type: "category-proxy" },
  "beef-tripe": { ug: 0.89, source: "bls", bls_code: "V551100", donor_name: "Beef stomach/tripe, raw", match_type: "exact" },
  "chicken-gizzard": { ug: 4, source: "literature", donor_name: "Organ meat proxy", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "pork-ribs": { ug: 0.36, source: "bls", bls_code: "Y395222", donor_name: "Pork spare ribs boiled", match_type: "cut-proxy" },
  "pork-shoulder": { ug: 1.01, source: "bls", bls_code: "U665100", donor_name: "Pork shoulder (without fat and rind) raw", match_type: "exact" },
  "cow-s-milk-skim": { ug: 2, source: "literature", donor_name: "Skim milk biotin (literature)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "ground-lamb": { ug: 1, source: "literature", donor_name: "Lamb muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "ground-pork": { ug: 1, source: "literature", donor_name: "Pork muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "half-and-half": { ug: 1.8, source: "literature", donor_name: "Milk/cream blend proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "leg-lamb-goat": { ug: 1, source: "literature", donor_name: "Lamb muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "pork-shank": { ug: 0.7, source: "bls", bls_code: "U672100", donor_name: "Pork foreshank (hock) raw", match_type: "exact" },
  "rack-lamb-goat": { ug: 1, source: "literature", donor_name: "Lamb muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "shank-lamb-goat": { ug: 1, source: "literature", donor_name: "Lamb muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "shoulder-lamb-goat": { ug: 1, source: "bls", bls_code: "U867100", donor_name: "Lamb shoulder, raw", match_type: "exact" },
  "swiss": { ug: 2.5, source: "literature", donor_name: "Hard cheese proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "butter": { ug: 2.5, source: "literature", donor_name: "Butter (dairy fat)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "cow-s-milk": { ug: 2, source: "literature", donor_name: "Cow milk (literature)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "cream-cheese": { ug: 2, source: "literature", donor_name: "Soft cheese proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "feta": { ug: 2.3, source: "bls", bls_code: "M012200", donor_name: "Feta min. 45 % fat in dry matter", match_type: "exact" },
  "flank": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "fresh-ham": { ug: 2.985, source: "bls", bls_code: "U682700", donor_name: "Pork ham raw, with fat, raw cured, smoked", match_type: "cut-proxy" },
  "gouda": { ug: 2.42, source: "bls", bls_code: "M402600", donor_name: "Gouda cheese 48 % fat in dry matter", match_type: "exact" },
  "ground-turkey": { ug: 1, source: "literature", donor_name: "Poultry muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "gruyere": { ug: 2.5, source: "literature", donor_name: "Hard cheese proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "mozzarella": { ug: 2.5, source: "literature", donor_name: "Cheese proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "parmesan": { ug: 3, source: "bls", bls_code: "M306400", donor_name: "Parmesan cheese min. 30 % fat in dry matter", match_type: "exact" },
  "pork-loin": { ug: 4, source: "literature", donor_name: "Pork loin raw (literature 3-5 µg)", url: "https://jn.nutrition.org/article/S0022-3166(23)13556-5/abstract", match_type: "category-proxy" },
  "round": { ug: 5, source: "bls", bls_code: "U287100", donor_name: "Beef topside/top round, raw", match_type: "exact" },
  "squid": { ug: 1, source: "literature", donor_name: "Shellfish proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "tilapia": { ug: 1, source: "literature", donor_name: "Fish muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "turkey-thigh": { ug: 1, source: "literature", donor_name: "Poultry muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "whole-turkey": { ug: 1, source: "literature", donor_name: "Poultry muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "yogurt-plain-nonfat": { ug: 4.6, source: "bls", bls_code: "M148100", donor_name: "Yogurt from skimmed milk, max. 0.5 % fat", match_type: "exact" },
  "yogurt-plain": { ug: 2.5, source: "literature", donor_name: "Yogurt (dairy)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "american-cheese": { ug: 3, source: "literature", donor_name: "Processed cheese proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "beef-brain": { ug: 15, source: "literature", donor_name: "Brain/organ proxy", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "cheddar": { ug: 3, source: "bls", bls_code: "M303700", donor_name: "Chester (Cheddar) cheese min. 50 % fat in dry matter", match_type: "exact" },
  "chicken-drumstick": { ug: 2, source: "bls", bls_code: "V420000", donor_name: "Chicken drumstick, with skin, marinated, raw", match_type: "cut-proxy" },
  "chicken-thigh": { ug: 1.45, source: "bls", bls_code: "V4A5100", donor_name: "Chicken thigh, with skin, raw", match_type: "exact" },
  "chicken-wing": { ug: 1.45, source: "bls", bls_code: "V417100", donor_name: "Chicken wings, with skin, raw", match_type: "exact" },
  "chuck": { ug: 0, source: "bls", bls_code: "U231100", donor_name: "Beef neck/chuck, raw", match_type: "exact" },
  "cow-s-milk-1": { ug: 2, source: "literature", donor_name: "Reduced-fat milk proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "crab": { ug: 1, source: "literature", donor_name: "Shellfish proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "duck-leg": { ug: 1.45, source: "bls", bls_code: "V465100", donor_name: "Duck leg, with skin, raw", match_type: "exact" },
  "ground-beef-10-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-beef-15-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-beef-20-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-beef-30-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-beef-4-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-beef-7-fat": { ug: 4.5, source: "literature", donor_name: "Hamburger patty, cooked, 3 oz (NIH ODS Table 2; converted to per 100g)", url: "https://ods.od.nih.gov/factsheets/Biotin-HealthProfessional/", match_type: "category-proxy" },
  "ground-duck": { ug: 1, source: "literature", donor_name: "Poultry muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "hanger": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "octopus": { ug: 1, source: "literature", donor_name: "Shellfish proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "plate": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "pollock": { ug: 1.3, source: "bls", bls_code: "T213100", donor_name: "Alaska pollock raw", match_type: "exact" },
  "prawn": { ug: 1, source: "bls", bls_code: "T753100", donor_name: "Common shrimp raw", match_type: "species-proxy" },
  "processed-cheese-slices": { ug: 5.9, source: "bls", bls_code: "M816000", donor_name: "Processed cheese preparation 45 - 52 % fat in dry matter", match_type: "cut-proxy" },
  "ribeye": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "short-ribs": { ug: 5, source: "bls", bls_code: "U235100", donor_name: "Beef forerib/prime rib, raw", match_type: "cut-proxy" },
  "shrimp": { ug: 1, source: "bls", bls_code: "T753100", donor_name: "Common shrimp raw", match_type: "exact" },
  "skirt": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "stew-meat": { ug: 1, source: "literature", donor_name: "Beef muscle proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "tuna-yellowfin": { ug: 0.935, source: "bls", bls_code: "T124100", donor_name: "Yellowfin tuna raw", match_type: "exact" },
  "whole-duck": { ug: 1, source: "literature", donor_name: "Poultry whole-carcass proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "yogurt-plain-lowfat": { ug: 2.5, source: "literature", donor_name: "Yogurt lowfat proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "cow-s-milk-2": { ug: 2, source: "literature", donor_name: "Reduced-fat milk proxy", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "heavy-cream": { ug: 2, source: "literature", donor_name: "Cream (dairy)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "light-cream": { ug: 2, source: "literature", donor_name: "Cream (dairy)", url: "https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/biotin", match_type: "category-proxy" },
  "whole-chicken": { ug: 0.84, source: "bls", bls_code: "V414100", donor_name: "Chicken whole, boneless, with skin, raw", match_type: "exact" },
};

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    header.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function getAnimalBiotinBlanks(coveragePath) {
  const csv = fs.readFileSync(coveragePath, "utf8");
  const rows = parseCsv(csv);
  return rows.filter(
    (r) => r.domain === "Animal foods" && String(r.missing_nutrient_keys || "").split("|").includes("vitamin_b7_ug")
  );
}

function loadReseedRows(reseedPath) {
  const data = JSON.parse(fs.readFileSync(reseedPath, "utf8"));
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const byId = new Map();
  rows.forEach((r) => {
    const id = r?.canonical_id;
    if (id) byId.set(id, r);
  });
  return byId;
}

function buildPatchPer100g(baselinePer100g, missingKeysSet, biotinUg) {
  const out = { ...baselinePer100g };
  missingKeysSet.forEach((k) => delete out[k]);
  out.vitamin_b7_ug = biotinUg;
  return out;
}

function main() {
  const blanks = getAnimalBiotinBlanks(COVERAGE_PATH);
  const reseedById = loadReseedRows(RESEED_PATH);
  const supplemental = JSON.parse(fs.readFileSync(SUPPLEMENTAL_PATH, "utf8"));
  const curation = JSON.parse(fs.readFileSync(CURATION_PATH, "utf8"));
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, "utf8"));

  const missingInMap = blanks.filter((b) => !ANIMAL_BIOTIN_MAP[b.canonical_id]);
  if (missingInMap.length) {
    console.error("Missing biotin value for:", missingInMap.map((m) => m.canonical_id).join(", "));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const patchRows = [];
  const curationByCanon = new Map((curation.matches || []).map((m) => [m.canonical_id, m]));
  const newProvenanceEntries = [];

  blanks.forEach((row) => {
    const cid = row.canonical_id;
    const name = row.canonical_name;
    const missingKeys = String(row.missing_nutrient_keys || "")
      .split("|")
      .filter(Boolean);
    const missingSet = new Set(missingKeys);
    const info = ANIMAL_BIOTIN_MAP[cid];
    const reseedRow = reseedById.get(cid);
    if (!reseedRow || !reseedRow.per_100g) {
      console.error("No reseed baseline for", cid);
      return;
    }
    const biotinUg = info.ug;
    const patchFdcId = info.source === "bls"
      ? `biotin-patch-bls4-${cid}-${info.bls_code}`
      : `biotin-patch-animal-${cid}-lit`;
    const sourceDataset = info.source === "bls"
      ? "german_bls_4_0_biotin_patch"
      : "external_biotin_literature_patch";
    const per_100g = buildPatchPer100g(reseedRow.per_100g, missingSet, biotinUg);

    patchRows.push({
      canonical_id: cid,
      canonical_name: name,
      fdc_id: patchFdcId,
      source: "supplemental",
      source_dataset: sourceDataset,
      per_100g,
    });

    const cur = curationByCanon.get(cid);
    if (cur) {
      cur.fdc_id = patchFdcId;
      cur.source_dataset = sourceDataset;
      cur.source_name = info.donor_name;
      cur.notes = `Biotin-only patch: ${info.donor_name} (${info.match_type}).`;
    }

    const provEntry = {
      canonical_id: cid,
      canonical_name: name,
      patch_fdc_id: patchFdcId,
      baseline_source_dataset: reseedRow.source === "usda" ? "sr_legacy_food" : (reseedRow.source_dataset || "usda"),
      baseline_fdc_id: reseedRow.fdc_id || "",
      donor_source_dataset: info.source === "bls" ? "german_bls_4_0_2025" : "literature",
      donor_food_name: info.donor_name,
      biotin_ug_per_100g: biotinUg,
      semantic_match_type: info.match_type,
      retrieved_at: now,
    };
    if (info.bls_code) {
      provEntry.donor_bls_code = info.bls_code;
      provEntry.donor_dataset_url = "https://www.blsdb.de/download";
      provEntry.donor_dataset_doi = "10.25826/Data20251217-134202-0";
    }
    if (info.url) provEntry.donor_source_url = info.url;
    newProvenanceEntries.push(provEntry);
  });

  // Append new patch rows to supplemental (avoid duplicates by fdc_id)
  const existingFdc = new Set((supplemental.rows || []).map((r) => r.fdc_id));
  patchRows.forEach((r) => {
    if (!existingFdc.has(r.fdc_id)) {
      supplemental.rows.push(r);
      existingFdc.add(r.fdc_id);
    }
  });

  provenance.entries = (provenance.entries || []).concat(newProvenanceEntries);
  provenance.generated_at = now;

  fs.writeFileSync(SUPPLEMENTAL_PATH, JSON.stringify(supplemental, null, 2) + "\n", "utf8");
  fs.writeFileSync(CURATION_PATH, JSON.stringify(curation, null, 2) + "\n", "utf8");
  fs.writeFileSync(PROVENANCE_PATH, JSON.stringify(provenance, null, 2) + "\n", "utf8");

  console.log("Applied", patchRows.length, "animal biotin patches.");
  console.log("Supplemental rows:", supplemental.rows.length);
  console.log("Provenance entries:", provenance.entries.length);
}

main();
