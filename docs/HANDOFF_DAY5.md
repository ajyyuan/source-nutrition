# Day 5 Handoff (Source)

This file captures the non-repo state and operational context for continuing after Day 5.

## Project Status (Day 5 complete)
- Robustness + safety updates applied (confidence labels, empty states, disclaimers).
- Parsed AI items + model version persisted.
- parse-meal now uses OpenAI vision and stores parsed_items/model_version.
- Home screen includes top contributors + likely shortfalls.
- Canonical mapping improved with alias + token matching.
- Capture upload fixed to avoid empty files (base64 bytes upload).

## Supabase Setup (current)
### Project
- Project ref: `cpbwrjeoxkkxyduovjhh`
- Project URL and anon key are in `.env`

### Secrets
- `OPENAI_API_KEY` must be set for `parse-meal`.
  - Command: `supabase secrets set OPENAI_API_KEY=...`

### Edge Functions
1) `parse-meal`
   - Uses OpenAI vision (`gpt-4o-mini`) with JSON-only responses.
   - Downloads meal photo from storage and sends base64 data URL to OpenAI.
   - Returns `{ items, model_version, error? }`.
2) `map-foods`
   - Canonical mapping improved (alias + token similarity).
   - Persists `final_items`, `nutrient_totals`, `nutrient_db_version`, `insights`.

### Migrations (applied)
- `20260125_day5_parsed_items.sql` (parsed_items, model_version)
- `20260126_day5_storage_read.sql` (authenticated read for meal photos)
- `20260127_day5_meal_insights.sql` (insights jsonb column)

If you need to reapply, use `supabase db push`.

## Notable Files / Changes
- `src/screens/CaptureScreen.tsx`
  - Upload uses base64 bytes to avoid empty uploads.
  - Shows parse warning if `parse-meal` returns `error`.
- `src/screens/HomeScreen.tsx`
  - Shows estimated labels + avg confidence.
  - Adds Top contributors and Likely shortfalls sections.
- `supabase/functions/parse-meal/index.ts`
  - Real vision call + base64 data URL.
- `supabase/functions/map-foods/index.ts`
  - Insight computation and improved canonical mapping.
- `supabase/functions/_shared/nutrients.ts`
  - Helper functions for per-item totals + %DV sum.

## How to Run
1) `npm install`
2) `npx expo run:ios --device`
3) Ensure iPhone Developer Mode + signing set up in Xcode.

## Deploy Steps
- `supabase db push`
- `supabase functions deploy parse-meal`
- `supabase functions deploy map-foods`

## Manual Test Notes
- Capture on real device (simulator camera yields empty files).
- Confirm parse-meal warnings show when API key missing.
- Confirm parsed items appear after OpenAI key set.
- Home screen shows contributors + shortfalls after a meal.

## Known Gaps / Next Steps
- Canonical mapping still limited by tiny canonical food list (only 4 foods).
- Nutrient DB is small; expand when ready.
- Consider additional insights (weekly wins/gaps) if desired.
