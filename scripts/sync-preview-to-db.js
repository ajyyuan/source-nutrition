/**
 * Pushes the current reseed preview (e.g. after K2 or other patches) into
 * canonical_foods so meal totals in the app use the latest per_100g data.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (in .env or environment)
 * Usage: node scripts/sync-preview-to-db.js [--preview=path]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const CHUNK_SIZE = 500;

const chunk = (values, size) => {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
};

const run = async () => {
  const previewPath = process.argv.some((a) => a.startsWith("--preview="))
    ? path.resolve(process.argv.find((a) => a.startsWith("--preview=")).split("=")[1])
    : DEFAULT_PREVIEW_PATH;

  if (!fs.existsSync(previewPath)) {
    throw new Error(`Preview file not found: ${previewPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(previewPath, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) {
    throw new Error("Preview has no rows.");
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase URL and service role key are required. Set in .env:\n" +
        "  SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL (your project URL)\n" +
        "  SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard → Project Settings → API → service_role secret)"
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from("canonical_foods").upsert(part, {
      onConflict: "canonical_id"
    });
    if (error) {
      throw new Error(`Failed upsert into canonical_foods: ${error.message}`);
    }
  }

  console.log(`Synced ${rows.length} rows from preview to canonical_foods.`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
