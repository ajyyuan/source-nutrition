# Day 15 Handoff (Source)

Short handoff for the food workflow rebuild, canonical DB expansion, and mapping hardening.

## Recent Progress (Feb 2026)
- Completed Day 14 execution item 1 (food workflow redesign) in production code:
  - manual/edit flow now uses lexical typeahead against canonical DB.
  - selecting a suggestion locks canonical choice per editable row.
  - recalculate now enforces canonical selection locks.
  - photo flow now rewrites editable rows to canonical-selected names after mapping.
- Rewired `map-foods` away from the legacy heuristic path:
  - removed alias/token/descriptor fallback heuristics.
  - uses canonical DB lexical candidates plus AI tie-breaking for ambiguous labels.
  - preserves explicit canonical locks from manual selection.
- Expanded canonical coverage operationally:
  - imported USDA SR Legacy and survey snapshots into local data assets.
  - upserted expanded canonical rows to Supabase.
- Fixed regressions discovered during QA:
  - recalculate failure with `food-unknown` sentinel.
  - pagination bug causing `Unknown canonical_id` on valid selections (`onions-raw` case).
  - error masking in Capture mapping parser (`items array` generic error now surfaces backend error).
  - poisoned zero-vector survey rows being selected as canonical suggestions/mappings.

## Commits
- `900c109` Add USDA SR and survey dataset snapshots.
- `6fa50bd` Harden canonical mapping against incomplete and zero-vector rows.
- `789cc7a` Rewrite map-foods with lexical candidate plus AI disambiguation.
- `8505647` Add canonical food suggestions and selection locks.

## Notable Changes
- `src/screens/CaptureScreen.tsx`
  - Added canonical suggestion parsing and fallback lexical ranking path.
  - Added canonical lock state for editable rows (`canonicalId`, `canonicalName`).
  - Recalculate now blocks if rows are unlocked.
  - Mapping parser now surfaces backend `error` payloads directly.
  - Suggestion fallback now filters poisoned survey zero-vector rows.
- `supabase/functions/map-foods/index.ts`
  - Full replacement of legacy heuristic mapping logic.
  - Canonical DB lookup now paginates through full table.
  - Supports explicit canonical lock IDs and allows `food-unknown` sentinel.
  - Filters poisoned survey zero-vector canonical rows from candidate selection.
  - Maintains deterministic nutrient computation output contract.
- `supabase/functions/search-foods/index.ts`
  - Canonical food loading now paginates full table.
  - Filters poisoned survey zero-vector rows from search candidates.
- `supabase/functions/_shared/lexicalFoodSearch.ts`
  - Shared lexical ranking utility used by mapping and suggestions.
- `scripts/ingest-usda-foundation.js`
  - Added configurable USDA data type filtering flags (`--data-types` / `--types`).
  - Default scope now focuses on `foundation` + `sr legacy`.
  - Added zero-vector skip guard (override with `--include-zero-vectors`).
  - Added ingestion diagnostics for included data types and skipped rows.
- `data/FoodData_Central_sr_legacy_food_csv_2018-04/*`
- `data/FoodData_Central_survey_food_csv_2022-10-28/*`
  - Dataset snapshots now committed.

## Deployment / Data Operations Notes
- `map-foods` function was deployed multiple times during this cycle.
- `search-foods` function was deployed multiple times during this cycle.
- Canonical DB was expanded via ingestion script runs:
  - Foundation ingest pass (usable rows only).
  - SR Legacy ingest pass (usable rows only).
  - Survey ingest was previously run, but runtime filtering now blocks poisoned survey rows.
- Observed DB state during debugging:
  - `canonical_foods_count` reported as `13652` at one checkpoint.
  - Zero-vector contamination was concentrated in survey/FNDDS-origin rows.

## Bugs Found + Resolved This Cycle
- **Unknown locked canonical on recalc**
  - Symptom: `Unknown canonical_id: onions-raw`.
  - Cause: partial canonical table fetch in edge functions.
  - Fix: paginated canonical loading in both mapping and search functions.
- **Generic mapping parser error in Capture**
  - Symptom: `Mapping response must include an items array.`
  - Cause: backend returned `{ error: ... }` and parser ignored it.
  - Fix: Capture mapping parser now throws backend error message directly.
- **Unknown sentinel breakage**
  - Symptom: locked `Unknown food` rows broke recalculate.
  - Cause: `food-unknown` not always represented in canonical lookup set.
  - Fix: sentinel handling added and preserved in mapping flow.
- **Zero-nutrient canonical selection**
  - Symptom: plausible ingredient names with 0 micronutrient totals.
  - Cause: poisoned survey rows with all-zero tracked micronutrients.
  - Fix: runtime filtering of survey-origin zero-vector rows in mapping/search/fallback suggestion path.

## Current Product / Mapping Behavior
- Manual and edit paths now require explicit canonical lock for each row before recalc.
- Photo flow now displays canonical-selected foods directly after map.
- Lexical retrieval is the shared candidate source.
- AI disambiguation is used as tie-breaker in ambiguous lexical cases.
- The additional "force generic meat disambiguation by context" experiment was intentionally reverted this cycle.

## Open Risks / Follow-ups
- Canonical table still contains survey-origin rows with zero vectors (filtered at runtime, not yet cleaned in DB).
- Coverage quality is improved but still depends on canonical naming shape; no alias table is active yet.
- Heavy committed data snapshots increase repo size and may slow clone/CI operations.

## Founder-Recommended Execution Order (for next agent)
1) **Ingredient nutritional profile view**
   - Add ability to view the nutritional profile of individual ingredients.
2) **Vitamin ordering + naming format**
   - Display vitamins in this order: A, C, D, E, K, then B vitamins in sequence (B1, B2, B3, B5, ..., B12).
   - For B vitamins, write out names like `Vitamin B2 (Niacin)` style, except list `Vitamin B6` and `Vitamin B12` without parenthetical names.

## Potential Future Tasks
1) **DB quality cleanup (high priority)**
   - add a maintenance script or SQL cleanup path for poisoned survey zero-vector rows.
   - optionally mark/suppress unusable rows in DB rather than only runtime filtering.
2) **Mapping quality refinement**
   - improve generic label disambiguation (beef/chicken/fish/broth) with conservative context logic.
   - keep lexical source of truth; apply AI only for true ambiguity.
3) **Coverage curation pass**
   - targeted verification for founder-priority foods (broths, sardines, fermented vegetables, etc.).
   - add deterministic smoke checks for key canonical IDs and non-zero nutrient vectors.
4) **Future concept exploration**
   - continue Day 13 concept-definition track (rewards/streaks doc before implementation).
