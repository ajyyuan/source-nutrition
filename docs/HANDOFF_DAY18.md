# Day 18 Handoff (Source)

Handoff for strict canon curation completion, supplemental-source integration, full provenance tracking, and docs alignment for the next micronutrient-quality push.

## Session Intent (Founder)
- Keep canon mapping strict: no shortcuts, no loopholes, no fallback substitutions.
- Resolve remaining weak/approximate canon source mappings using online data when needed.
- Track exactly which dataset each canon item comes from.
- Prepare a clear next-work direction around micronutrient data quality and nutrient UX.

## What Was Completed

### 1) Canon item updates requested by founder
- Replaced `whole milk` naming with `cow's milk` and added `goat milk` + `sheep milk` canon entries.
- Fixed `chicken egg` canonical ID resolution issue in parse/map flows.
- Added cooked egg variants:
  - `Scrambled egg (chicken)`
  - `Fried egg (chicken)`

### 2) Strict curation hardening (no hidden fallback behavior)
- Strengthened curation candidate filtering/scoring to reject semantically weak matches and force unresolved visibility instead of auto-accepting weak rows.
- Tightened matching logic for species/process/form constraints (for example: ground, organ, egg-specific handling).
- Kept canonical list as the fixed gold set; no extra foods introduced.

### 3) External source resolution for remaining hard gaps
- Resolved remaining approximations by sourcing explicit rows from:
  - local USDA CSV datasets,
  - USDA FDC online API (including branded rows),
  - OpenFoodFacts,
  - Canadian Nutrient File.
- Added supplemental-source row artifact:
  - `data/canon/source-canon-v1.supplemental-source-rows.json`
- Ensured reseed path can merge supplemental rows with local USDA rows deterministically.

### 4) Curation state finalized to full coverage
- Manual curation now reports:
  - `unresolved_count: 0`
  - `low_confidence_count: 0`
- Canon source mapping is explicit for all current canon items.

### 5) Provenance system implemented
- Added provenance build script:
  - `scripts/build-canon-v1-provenance.js`
  - npm script: `canon:provenance:build`
- Generated provenance manifest:
  - `data/canon/source-canon-v1.provenance.json`
- Current manifest summary:
  - `total_items: 324`
  - `with_source_dataset: 324`
  - `missing_source_dataset: 0`

### 6) Docs audit and refresh completed
- Updated living docs to match strict curation/provenance behavior and upcoming priorities.
- Added historical snapshot note to Day 17 handoff so readers do not treat it as the latest architecture state.

## Key Files Updated (Today)
- Canon/data pipeline:
  - `data/canon/source-canon-v1.json`
  - `data/canon/source-canon-v1.manual-curation.json`
  - `data/canon/source-canon-v1.supplemental-source-rows.json`
  - `data/canon/source-canon-v1.provenance.json`
  - `scripts/build-canon-v1-curation.js`
  - `scripts/reseed-canon-v1.js`
  - `scripts/build-canon-v1-provenance.js`
  - `package.json`
- Runtime mapping/parse:
  - `supabase/functions/parse-meal/index.ts`
  - `supabase/functions/map-foods/index.ts`
- Docs:
  - `README.md`
  - `docs/README.md`
  - `docs/PROJECT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/FOOD_DB_PLAN.md`
  - `docs/ROADMAP.md`
  - `docs/HANDOFF_DAY17.md`

## Commits Landed
- `709c2d2` Rename milk canon variants to cow’s milk labels and add goat milk + sheep milk
- `633aed5` Fix chicken egg canonical ID resolution in parse/map flows
- `35d1033` Add scrambled/fried chicken egg canon variants
- `931871e` Enforce strict manual canon curation and seed gate
- `d1ed2a4` Finalize strict canon curation with supplemental online sources
- `678e5fc` Finalize canon provenance tracking and strict source curation
- `3ae2ae6` Refresh docs for strict canon source curation and next priorities

## Current State Snapshot
- Canon source mapping coverage: complete for current list (`324/324` with dataset provenance).
- Strictness contract: canon list is exact, curation is explicit, and runtime path avoids hidden fallback substitutions.
- Next work is focused on strict nutrient data correctness and shipping the requested nutrient UX features.

## Next Session Plan (Founder Priorities)
1) Make sure we have proper micronutrition profiles for all foods in canon.
   - Example to validate and fix directly: `ground-beef-15-fat` currently appears underfilled.
2) Continue this same data-correctness pass for missing nutrients:
   - ensure nutrients such as biotin and omega-3 are properly present where expected.
3) Code a nutrient click-through page:
   - tap any nutrient -> basic page with:
     - short description of major functions in the body,
     - what deficiencies look like,
     - which foods in our database are especially high in that nutrient.
4) Build an updated micronutrient spreadsheet view/export:
   - micronutrients on rows,
   - food names on columns (X axis),
   - kept updated from current canon nutrient data.

## Notes for the Next Agent
- Treat `source-canon-v1.json` as exact gold food scope unless founder explicitly changes it.
- Preserve strict no-fallback mapping behavior.
- Prefer explicit source-row provenance and confidence notes for every data update.
