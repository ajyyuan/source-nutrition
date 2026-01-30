## Expanded Food DB Plan

### Goal
Move canonical foods out of the hardcoded list in `supabase/functions/_shared/nutrients.ts`
into a Supabase table, seeded from a larger USDA subset, while keeping deterministic
nutrient computation and stable canonical IDs.

### Recommended source
- USDA FoodData Central (Foundation Foods)
- Start with ~1–2k staple foods to keep the dataset manageable.
- Use per-100g nutrient values only, matching current pipeline.

### Proposed schema
`public.canonical_foods`
- `canonical_id` text primary key (stable slug)
- `canonical_name` text not null
- `per_100g` jsonb not null (NutrientVector)
- `source` text not null (e.g. "usda")
- `fdc_id` text null
- `created_at` timestamptz default now()

Optional:
`public.canonical_food_aliases`
- `alias` text primary key
- `canonical_id` text not null references canonical_foods(canonical_id)

### Ingestion outline
1. Download USDA FoodData Central CSV for Foundation Foods.
2. Map USDA nutrients → current nutrient keys.
   - Use only the nutrients tracked in `NutrientKey`.
   - Set missing nutrients to 0.
3. Create stable canonical IDs:
   - `slugify(canonical_name)` + optional `fdc_id` suffix to avoid collisions.
4. Insert into `canonical_foods`.
5. (Optional) Seed aliases table for common synonyms.

### Minimal implementation steps
1. Add `canonical_foods` table + RLS read policy (authenticated).
2. Add ingestion script (Node/TS) that:
   - Reads USDA CSV
   - Outputs JSON rows for `canonical_foods`
   - Inserts via Supabase service role
3. Update `map-foods` function:
   - Load canonical foods from DB (cache per request).
   - Fallback to in-code `CANONICAL_NUTRIENTS` for safety.
4. Bump `NUTRIENT_DB_VERSION` to reflect DB migration.

### Local ingestion script (in progress)
`scripts/ingest-usda-foundation.js` expects a data folder with:
`food.csv`, `nutrient.csv`, `food_nutrient.csv`

Example:
`node scripts/ingest-usda-foundation.js ./usda --out=canonical_foods.json --dry-run`

### Open questions
- Do we want branded foods now or later?
- Should aliases include pluralization and cooking variations?
- Do we want a nightly sync or one-time seed?
