#!/usr/bin/env node
/**
 * Apply vitamin K2 (menaquinone) values from source-canon-v1.vitamin-k2-patches.json
 * to the reseed preview. Updates per_100g.vitamin_k2_ug for each matching canonical_id.
 * Run after canon:reseed:dry (or before build-food-profiles).
 */

const fs = require("fs");
const path = require("path");

const PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const PATCH_PATH = path.resolve("data/canon/source-canon-v1.vitamin-k2-patches.json");

function main() {
  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf8"));
  const patchPayload = JSON.parse(fs.readFileSync(PATCH_PATH, "utf8"));
  const patches = patchPayload.patches || {};
  const rows = preview.rows || [];
  let updated = 0;

  rows.forEach((row) => {
    const cid = row.canonical_id;
    const patch = patches[cid];
    if (!patch || typeof patch.vitamin_k2_ug !== "number" || !Number.isFinite(patch.vitamin_k2_ug))
      return;
    if (!row.per_100g || typeof row.per_100g !== "object") row.per_100g = {};
    row.per_100g.vitamin_k2_ug = patch.vitamin_k2_ug;
    updated++;
  });

  fs.writeFileSync(PREVIEW_PATH, JSON.stringify(preview, null, 2) + "\n", "utf8");
  console.log("Applied vitamin K2 patches:", updated, "foods.");
}

main();
