# Day 4 Handoff (Source)

This file captures non-repo state and operational context for continuing Day 5 in a new chat.

## Project Status (Day 4 complete: persistence + trends)
- Meals now persist `final_items`, `nutrient_totals`, and `nutrient_db_version`.
- Home screen shows Today totals and 7-day rolling averages (daily average across days with meals).
- Capture screen supports recalculating nutrients from edited items.
- Capture + Home screens are scrollable for long nutrient lists.

## Notable Files / Changes
- `supabase/migrations/20260124_day4_persistence.sql`
  - Adds `final_items`, `nutrient_totals`, `nutrient_db_version` to `public.meals`
  - Adds `meals_update_own` RLS policy
- `supabase/functions/map-foods/index.ts`
  - Requires `meal_id` in request
  - Writes `final_items`, `nutrient_totals`, `nutrient_db_version` to `meals`
- `src/screens/HomeScreen.tsx`
  - Loads Today totals from `meals.nutrient_totals`
  - Computes 7-day rolling average (per-day average across days with meals)
  - ScrollView added for long lists
- `src/screens/CaptureScreen.tsx`
  - Adds “Recalculate nutrients” button using edited foods
  - ScrollView for preview flow

## Supabase Setup (current)
### Project
- Project ref: `cpbwrjeoxkkxyduovjhh`
- Project URL and anon key are in `.env`

### Edge Functions
1) `parse-meal`
   - Still stubbed (placeholder item).
   - JWT verification disabled at function level.
2) `map-foods`
   - Computes nutrient totals and persists them to `meals`.
   - JWT verification disabled at function level.

### Supabase config
- `supabase/config.toml` has:
  - `[functions.parse-meal] verify_jwt = false`
  - `[functions.map-foods] verify_jwt = false`

### Required DB Migration
- Apply `supabase/migrations/20260124_day4_persistence.sql` to the project.

## How to Run
1) `npm install`
2) `npx expo run:ios`

## How to Deploy Edge Functions
From repo root:
- `supabase functions deploy parse-meal`
- `supabase functions deploy map-foods`

## Manual Test Notes
- After capture + map, `meals` row should contain `final_items`, `nutrient_totals`, `nutrient_db_version`.
- Home screen shows totals and averages; values may be zero with stub parsing.
- Use “Recalculate nutrients” on Capture to update totals based on edited foods (e.g., “salmon”).

## Known Gaps (Day 2+)
- `parse-meal` still stubbed (no real AI parsing/validation).
- Canonical mapping still heuristic in `map-foods` (not a real DB mapping).
- Nutrient DB is tiny (4 foods), not a full canonical set.
