#!/usr/bin/env node
/**
 * Build source-canon-v1.external-vitamin-k2-provenance.json from the K2 patch file
 * and flat canon (for canonical_name). Run after updating vitamin-k2-patches.json.
 */
const fs = require("fs");
const path = require("path");

const PATCH_PATH = path.resolve("data/canon/source-canon-v1.vitamin-k2-patches.json");
const FLAT_PATH = path.resolve("data/canon/source-canon-v1.flat.json");
const OUT_PATH = path.resolve("data/canon/source-canon-v1.external-vitamin-k2-provenance.json");

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

const out = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  source: "vitamin_k2_patches",
  patch_file: "source-canon-v1.vitamin-k2-patches.json",
  source_citations: patch.sources || {},
  entries
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log("Wrote", OUT_PATH, "with", entries.length, "entries.");
