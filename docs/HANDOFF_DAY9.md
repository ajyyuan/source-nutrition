#[Day 9 Handoff (Source)]

This handoff captures progress after Day 8 and notes open issues.

## Recent Progress (Feb 2026)
- **History UI polish** completed (calendar dots, alignment, month navigation fixes).
- **Meal deletion** added in History (with confirm + UI refresh).
- **Food DB expansion** implemented:
  - `canonical_foods` table + RLS migration.
  - USDA ingestion script added and run (Foundation Foods CSV).
  - `map-foods` now reads from DB (fallback to bundled list).
  - Improved matching heuristics for noisy USDA names.
- **OAuth UI/flow** added for Apple/Google, but Apple sign‑in still broken (see below).

## Commits (local)
- `7854b0d` Enable meal deletion in history
- `20bb6ce` Improve canonical food matching heuristics
- `755e52f` Load canonical foods from database in map-foods
- `d183632` Add USDA ingestion helper script
- `448f99b` Add canonical foods table and RLS
- `746dc87` Add OAuth sign-in flow with session exchange
- `310f38d` Keep selection in navigated month
- `0e315ae` Prevent calendar dot shifting
- `ec14615` Align weekday header with calendar grid
- `1c38d79` Fix calendar meal day keying
- `71a5081` Polish history calendar UI

## Notable Changes
- `src/screens/HistoryScreen.tsx`: delete button + confirm, UI refresh after delete.
- `supabase/migrations/20260130_day9_meals_delete.sql`: delete policy for `meals`.
- `supabase/migrations/20260129_day9_canonical_foods.sql`: `canonical_foods` table + RLS.
- `scripts/ingest-usda-foundation.js`: USDA CSV ingestion helper.
- `supabase/functions/map-foods/index.ts`: DB-backed canonical foods + improved matching.
- `supabase/functions/_shared/nutrients.ts`: `NUTRIENT_DB_VERSION` bumped to `v0.3-canonical-db`.
- `app.json`: Apple sign-in entitlements added.
- `package.json` / `package-lock.json`: added `expo-auth-session`, `expo-web-browser`, `expo-apple-authentication`, `expo-crypto`, `csv-parse`.

## Food DB Status
- USDA Foundation Foods CSV downloaded to `data/` (untracked).
- Ingestion script run successfully (≈436 rows).
- `map-foods` now reads from DB, falls back to bundled list.

## Apple/Google Auth Status (Blocked)
Google:
- OAuth web flow added; still needs verified provider setup in Supabase.

Apple:
- Native Apple Sign‑In still failing with `ERR_REQUEST_UNKNOWN`.
- Web OAuth flow failing with `invalid_client` in Supabase logs even after new keys/JWTs.
- JWT validity confirmed via direct Apple token endpoint (returned `invalid_grant` for fake code).
- Supabase Auth logs show `/callback` `invalid_client`.
- Device build shows **invalid entitlements blob** (iOS ignores entitlements).
- `Source.entitlements` contains `com.apple.developer.applesignin`, but codesign output on device build warns entitlements blob invalid.

### Apple Debugging Notes
- Entitlements check (device build):
  - `codesign -d --entitlements :- /Users/.../Debug-iphoneos/Source.app` reports **invalid entitlements blob**.
- Native Apple errors in device log:
  - `AKAuthenticationError Code=-7026`
  - `ASAuthorizationController credential request failed (error 1000)`
- Web Apple errors in Supabase logs:
  - `oauth2: "invalid_client"` on `/callback`.

## Actions Needed Next
1) **Fix native Apple entitlements**: clean prebuild and verify entitlements are valid in the device build.
   - If still invalid, manually add Sign In with Apple capability in Xcode target.
2) **Re-verify Supabase Apple provider** with new Services ID + new key after entitlements are fixed.
3) **Commit/cleanup**:
   - Ensure `data/` remains untracked.
   - Confirm `secrets/` ignored.

## Testing
- History calendar UI, dots, month navigation tested.
- Delete meals works after adding delete RLS policy.
- Food DB ingestion verified; mapping improved but still imperfect (Foundation Foods lacks items like blueberries).

