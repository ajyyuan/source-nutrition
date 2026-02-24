#!/usr/bin/env node
/**
 * Apply mineral patches (Mg, P, K, Zn, Se) from source-canon-v1.mineral-patches.json
 * to the reseed preview. Updates per_100g for each matching canonical_id.
 * Run after canon:reseed:dry (and after K2 patches if used).
 */

const fs = require("fs");
const path = require("path");

const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const PATCH_PATH = path.resolve("data/canon/source-canon-v1.mineral-patches.json");

const MINERAL_KEYS = ["magnesium_mg", "phosphorus_mg", "potassium_mg", "zinc_mg", "selenium_ug"];

function main() {
  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const patchPayload = JSON.parse(fs.readFileSync(PATCH_PATH, "utf8"));
  const patches = patchPayload.patches || {};
  const rows = preview.rows || [];
  let updated = 0;

  rows.forEach((row) => {
    const cid = row.canonical_id;
    const patch = patches[cid];
    if (!patch || typeof patch !== "object") return;
    if (!row.per_100g || typeof row.per_100g !== "object") row.per_100g = {};
    let changed = false;
    MINERAL_KEYS.forEach((key) => {
      const v = patch[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        row.per_100g[key] = v;
        changed = true;
      }
    });
    if (changed) updated++;
  });

  fs.writeFileSync(PREVIEW_PATH, JSON.stringify(preview, null, 2) + "\n", "utf8");
  console.log("Applied mineral patches:", updated, "foods.");
}

main();
