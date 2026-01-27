# Day 3 Handoff (Source)

This file captures non-repo state and operational context for continuing Day 4 in a new chat.

## Project Status (Day 3 in progress, micronutrients wired)
- Nutrient DB subset added with real per-100g values for a few canonical foods.
- %DV constants + per-meal totals computation implemented server-side.
- `map-foods` now returns `nutrient_totals` + `nutrient_db_version`.
- Capture screen shows a read-only Micronutrients (%DV) section from `map-foods`.

## Notable Files / Changes
- `supabase/functions/_shared/nutrients.ts`
  - `NUTRIENT_DB_VERSION = "v0.2-usda-100g"`
  - Canonical foods with real values: `apple-raw`, `spinach-raw`, `salmon-cooked`, `egg-whole`
  - Helpers: `computeMealTotals`, `DAILY_VALUES`, vector math
- `supabase/functions/map-foods/index.ts`
  - Adds grams + heuristic canonical IDs
  - Computes and returns `nutrient_totals`
- `src/screens/CaptureScreen.tsx`
  - Parses `nutrient_totals` and displays %DV list

## Supabase Setup (current)
### Project
- Project ref: `cpbwrjeoxkkxyduovjhh`
- Project URL and anon key are in `.env`

### Edge Functions
1) `parse-meal`
   - Still stubbed (placeholder item).
   - JWT verification disabled at function level.
2) `map-foods`
   - Now computes nutrient totals and returns them.
   - JWT verification disabled at function level.

### Supabase config
- `supabase/config.toml` has:
  - `[functions.parse-meal] verify_jwt = false`
  - `[functions.map-foods] verify_jwt = false`

## How to Run
1) `npm install`
2) `npx expo run:ios`

## How to Deploy Edge Functions
From repo root:
- `supabase functions deploy parse-meal`
- `supabase functions deploy map-foods`

## Quick Manual Test (backend)
```
curl -X POST "https://cpbwrjeoxkkxyduovjhh.functions.supabase.co/map-foods" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Spinach","estimated_grams":50,"confidence":0.6},{"name":"Salmon","estimated_grams":100,"confidence":0.8}]}'
```
Expected: `nutrient_totals` with non-zero values and `nutrient_db_version: v0.2-usda-100g`.

## Day 4 Targets (per PLAN.md)
- Save finalized meals
- Today view (daily totals)
- 7-day rolling view

## Known Gaps (Day 2+)
- `parse-meal` still stubbed (no real AI parsing/validation).
- Canonical mapping is still heuristic in `map-foods` (not a real DB mapping).
- Nutrient DB is tiny (4 foods), not a full canonical set.
