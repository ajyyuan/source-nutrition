#!/usr/bin/env node
/**
 * Replace reported 0 for A,D,E,K and B vitamins in animal products with real
 * values from data/canon/source-canon-v1.animal-vitamin-zero-patches.json.
 * Only applies where we have a cited value; no made-up traces.
 * Adds supplemental rows and points curation to them.
 */

const fs = require("fs");
const path = require("path");

const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const PATCH_PATH = path.resolve("data/canon/source-canon-v1.animal-vitamin-zero-patches.json");
const SUPPLEMENTAL_PATH = path.resolve("data/canon/source-canon-v1.supplemental-source-rows.json");
const CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");

const VITAMIN_KEYS = [
  "vitamin_a_ug", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "thiamin_mg", "riboflavin_mg", "niacin_mg", "vitamin_b5_mg", "vitamin_b6_mg",
  "vitamin_b7_ug", "folate_ug", "vitamin_b12_ug"
];

function main() {
  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const patchPayload = JSON.parse(fs.readFileSync(PATCH_PATH, "utf8"));
  const patches = patchPayload.patches || {};
  const supplemental = JSON.parse(fs.readFileSync(SUPPLEMENTAL_PATH, "utf8"));
  const curation = JSON.parse(fs.readFileSync(CURATION_PATH, "utf8"));

  const animalRows = (preview.rows || []).filter((r) => r.domain === "Animal foods");
  const curationByCanon = new Map((curation.matches || []).map((m) => [m.canonical_id, m]));
  const existingFdc = new Set((supplemental.rows || []).map((r) => r.fdc_id));
  let added = 0;

  animalRows.forEach((row) => {
    const cid = row.canonical_id;
    const name = row.canonical_name;
    const foodPatches = patches[cid];
    if (!foodPatches || typeof foodPatches !== "object") return;

    const per100g = { ...row.per_100g };
    let changed = false;
    Object.entries(foodPatches).forEach(([key, value]) => {
      if (!VITAMIN_KEYS.includes(key)) return;
      const current = per100g[key];
      const isZero = current === 0 || (typeof current === "number" && !Number.isFinite(current));
      if (isZero && typeof value === "number" && Number.isFinite(value)) {
        per100g[key] = value;
        changed = true;
      }
    });
    if (!changed) return;

    const patchFdcId = `vitamin-patch-${cid}`;
    if (existingFdc.has(patchFdcId)) return;
    existingFdc.add(patchFdcId);

    supplemental.rows.push({
      canonical_id: cid,
      canonical_name: name,
      fdc_id: patchFdcId,
      source: "supplemental",
      source_dataset: "animal_vitamin_zero_patch",
      per_100g: per100g
    });
    added++;

    const cur = curationByCanon.get(cid);
    if (cur) {
      cur.fdc_id = patchFdcId;
      cur.source_dataset = "animal_vitamin_zero_patch";
      cur.source_name = cur.source_name || name;
      cur.notes = (cur.notes || "") + " Vitamin zero-patch: cited values for A/D/E/K/B vitamins where source reported 0.";
    }
  });

  fs.writeFileSync(SUPPLEMENTAL_PATH, JSON.stringify(supplemental, null, 2) + "\n", "utf8");
  fs.writeFileSync(CURATION_PATH, JSON.stringify(curation, null, 2) + "\n", "utf8");
  console.log("Applied animal vitamin zero-patches:", added);
}

main();
