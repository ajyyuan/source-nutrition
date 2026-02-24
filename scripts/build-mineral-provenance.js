#!/usr/bin/env node
/**
 * Build the mineral_patches section of source-canon-v1.external-provenance.json from
 * source-canon-v1.mineral-patches.json. Run after updating mineral-patches.json.
 * Preserves vitamin_k2, biotin, and vitamin_zero sections in the consolidated file.
 */
const fs = require("fs");
const path = require("path");

const PATCH_PATH = path.resolve("data/canon/source-canon-v1.mineral-patches.json");
const FLAT_PATH = path.resolve("data/canon/source-canon-v1.flat.json");
const EXTERNAL_PROVENANCE_PATH = path.resolve("data/canon/source-canon-v1.external-provenance.json");

const patch = JSON.parse(fs.readFileSync(PATCH_PATH, "utf8"));
const flat = JSON.parse(fs.readFileSync(FLAT_PATH, "utf8"));
const nameById = (flat.items || []).reduce((acc, i) => {
  acc[i.canonical_id] = i.canonical_name || i.display_name || i.canonical_id;
  return acc;
}, {});

const entries = Object.entries(patch.patches || {}).map(([canonical_id, p]) => ({
  canonical_id,
  canonical_name: nameById[canonical_id] || canonical_id,
  magnesium_mg: p.magnesium_mg,
  phosphorus_mg: p.phosphorus_mg,
  potassium_mg: p.potassium_mg,
  zinc_mg: p.zinc_mg,
  selenium_ug: p.selenium_ug,
  patch_file: "source-canon-v1.mineral-patches.json"
}));

const mineralPatches = {
  source: "mineral_patches",
  patch_file: "source-canon-v1.mineral-patches.json",
  source_citations: patch.sources || {},
  entries,
  generated_at: new Date().toISOString()
};

let doc = { schema_version: "1.0.0", generated_at: new Date().toISOString() };
if (fs.existsSync(EXTERNAL_PROVENANCE_PATH)) {
  doc = JSON.parse(fs.readFileSync(EXTERNAL_PROVENANCE_PATH, "utf8"));
}
doc.mineral_patches = mineralPatches;
doc.generated_at = new Date().toISOString();
doc.description =
  "External/patch provenance: K2, biotin, vitamin-zero, mineral_patches. One doc for all patch sources.";
if (!doc.vitamin_k2) doc.vitamin_k2 = { source: "vitamin_k2_patches", entries: [], generated_at: null };
if (!doc.biotin) doc.biotin = { source: "external_biotin_pass", entries: [], generated_at: null };
if (!doc.vitamin_zero) doc.vitamin_zero = { source: "animal_vitamin_zero_patches", entries: [], generated_at: null };

fs.writeFileSync(EXTERNAL_PROVENANCE_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log("Wrote mineral_patches section to", EXTERNAL_PROVENANCE_PATH, "with", entries.length, "entries.");
