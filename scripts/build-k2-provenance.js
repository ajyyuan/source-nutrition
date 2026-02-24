#!/usr/bin/env node
/**
 * Build the vitamin_k2 section of source-canon-v1.external-provenance.json from the K2 patch file
 * and flat canon (for canonical_name). Run after updating vitamin-k2-patches.json.
 * Preserves biotin and vitamin_zero sections in the consolidated file.
 */
const fs = require("fs");
const path = require("path");

const PATCH_PATH = path.resolve("data/canon/source-canon-v1.vitamin-k2-patches.json");
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
  vitamin_k2_ug: p.vitamin_k2_ug,
  patch_file: "source-canon-v1.vitamin-k2-patches.json"
}));

const vitaminK2 = {
  source: "vitamin_k2_patches",
  patch_file: "source-canon-v1.vitamin-k2-patches.json",
  source_citations: patch.sources || {},
  entries,
  generated_at: new Date().toISOString()
};

let doc = { schema_version: "1.0.0", generated_at: new Date().toISOString() };
if (fs.existsSync(EXTERNAL_PROVENANCE_PATH)) {
  doc = JSON.parse(fs.readFileSync(EXTERNAL_PROVENANCE_PATH, "utf8"));
}
doc.vitamin_k2 = vitaminK2;
doc.generated_at = new Date().toISOString();
if (!doc.biotin) doc.biotin = { source: "external_biotin_pass", entries: [], generated_at: null };
if (!doc.vitamin_zero) doc.vitamin_zero = { source: "animal_vitamin_zero_patches", entries: [], generated_at: null };

fs.writeFileSync(EXTERNAL_PROVENANCE_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log("Wrote vitamin_k2 section to", EXTERNAL_PROVENANCE_PATH, "with", entries.length, "entries.");
