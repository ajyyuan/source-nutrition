# Day 21 Handoff (Source)

Handoff for nutrient click-through, food suggestions fix, minerals audit, and beef muscle vitamin A/K patches.

## Session Intent (Founder)
- Ship the nutrient click-through page (tap nutrient → description, deficiency, top foods).
- Fix manual-entry food suggestions (“unable to load” / 401).
- Audit minerals (canon/source mapping) for mixing or gaps.
- Continue reducing animal vitamin zeros with cited values only; always document sources and URLs.

## What Was Completed

### 1) Nutrient click-through page
- **NutrientDetailScreen:** Tap any nutrient bar (Home, History, Capture) or shortfall row (Home) → full-screen with:
  - What it does (body functions), If you don’t get enough (deficiency), Foods high in [nutrient] (top 15 from canon, per 100 g).
- **Metadata:** `src/lib/nutrientInfo.ts` (description + deficiency for all 22 nutrients); `src/data/topFoodsByNutrient.json` from `npm run canon:top-foods` (built from reseed preview).
- **Navigation:** Root stack (MainTabs + NutrientDetail); NutrientBarRow optional `onPress`; shortfall rows on Home tappable.
- **Script:** `scripts/build-top-foods-by-nutrient.js`; npm script `canon:top-foods`.

### 2) Food suggestions fix (manual entry)
- **401 cause:** `search-foods` was not in `supabase/config.toml`; default `verify_jwt = true` caused gateway 401 before handler ran.
- **Change:** Added `[functions.search-foods]` with `verify_jwt = false` (matches parse-meal, map-foods). Auth still passed via request header for DB/RLS.
- **UX:** Surface real suggestion error in UI (not generic “Unable to load”); friendlier message when function returns non-2xx; search-foods handler always returns 200 with error payload when it catches.

### 3) Minerals audit
- **Doc:** `docs/AUDIT_MINERALS.md` — mineral keys, where mapping lives (reseed, matrix, ingest, edge), USDA names checked, findings.
- **Result:** No mixing, no unit mix-ups, no mis-mapping. Only total minerals mapped (e.g. Iron, Fe; Calcium, Ca). Sub-components (heme/non-heme iron, added/intrinsic calcium) intentionally not mapped. No code changes.

### 4) Backlog + npm audit (docs only)
- **HANDOFF_DAY20:** Backlog noted (food detail page, discover tab); npm audit note (19 high remain, minimatch/glob in RN/Expo; fix on next upgrade). Lockfile from `npm audit fix` (brace-expansion, tar fixed).
- Handoffs are not edited by the agent; Day 21 handoff created for this session.

### 5) Beef muscle + bison vitamin A/K patches
- **Patches added:** tenderloin, sirloin, flank, round, shank, oxtail, ground-bison — `vitamin_a_ug: 1`, `vitamin_k_ug: 1.5`.
- **Source (in patches JSON):** USDA FDC 173998 (beef round eye of round roast, raw). Vitamin A RAE 0.85 mcg/85 g → 1 mcg/100 g; vitamin K 1.3 mcg/85 g → 1.5 mcg/100 g. URLs: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/173998/nutrients`, `https://tools.myfooddata.com/nutrition-facts/173998/wt1`. Applied as proxy to lean beef muscle and ground bison.
- **Applied:** `apply-animal-vitamin-zero-patches.js`; reseed dry; matrix build. Animal vitamin A zeros 35 → 28; coverage any_missing 148, all_reported 176.

## Key Files Updated (This Session)
- App: `src/screens/NutrientDetailScreen.tsx`, `src/lib/nutrientInfo.ts`, `src/lib/NutrientBarRow.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/CaptureScreen.tsx`; `src/data/topFoodsByNutrient.json`.
- Scripts: `scripts/build-top-foods-by-nutrient.js`; `supabase/functions/search-foods/index.ts`; `supabase/config.toml`.
- Canon: `data/canon/source-canon-v1.animal-vitamin-zero-patches.json`, supplemental/curation, reseed-preview, matrix/coverage (regenerated).
- Docs: `docs/AUDIT_MINERALS.md`, `docs/HANDOFF_DAY21.md` (this file).

## Commits Landed
- Nutrient click-through page (stack + NutrientDetailScreen, nutrientInfo, topFoodsByNutrient, tappable bars/shortfalls).
- fix: food suggestions 401 and error handling (config.toml verify_jwt, surface real errors, safe 200 from search-foods).
- docs: backlog (food detail + discover tab), npm audit note; lockfile from audit fix.
- docs: add minerals audit (AUDIT_MINERALS.md).
- canon: beef muscle + bison vitamin A/K patches (cited USDA FDC 173998; source + URLs in patches JSON).

## Current State Snapshot
- **Nutrient UX:** Tap any nutrient → detail page (description, deficiency, top 15 foods). Top foods from `canon:top-foods` (reseed preview).
- **Manual entry:** Food suggestions load (search-foods verify_jwt = false); errors show real message or friendly fallback.
- **Minerals:** Audited; mapping correct; see `docs/AUDIT_MINERALS.md`.
- **Animal vitamin zeros:** 7 more filled (beef muscle + bison A/K). Source always recorded with URLs in `animal-vitamin-zero-patches.json`. Coverage: any_missing 148, all_reported 176 (324 foods).

## Next Session Plan (Founder Priority)
- **Food page feature:** Build a page for every canon food showing its full micronutrient profile. From the nutrient click-through screen, tapping a listed “top food” should open that food’s detail page. (Discover tab / searchable food list can follow later.)

## Notes for the Next Agent
- **Next:** Implement the food detail page (one screen per canon food: name + full micronutrient profile per 100 g). Wire “top food” rows on NutrientDetailScreen to navigate to that food’s page. Data: reseed preview or `topFoodsByNutrient` + full profile from canon/preview; consider `canonical_id` as route param.
- Follow `.cursor/rules/data-completeness.mdc`: cited values only; document source and URL for any new patch data.
- Do not edit existing handoff docs (Day 1–20); they are snapshots. Add new handoffs (e.g. Day 22) for the next session’s close.
- `source-canon-v1.match-audit.json` is gitignored; do not commit it.
