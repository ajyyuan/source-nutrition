# Day 16 Handoff (Source)

Detailed handoff for Day 16 covering ingredient profiles, canonical-first photo flow, vitamin ordering/naming updates, B5/B7 expansion, live data backfill, and current DB quality findings.

## Session Intent (Founder)
- Continue Day 15 priorities:
  1) ingredient-level nutrition profile view
  2) vitamin ordering and B-vitamin naming format
- Pause for test + commit after each step.
- Evaluate mapping/data quality and propose direction for improving real-food relevance.

## What Was Completed

### 1) Ingredient profile view shipped (and fixed for older meals)
- Added per-item nutrient totals support to mapping output and persistence.
- Added per-ingredient "Show profile / Hide profile" UI in Capture mapped foods section.
- Added hydration fallback for old meals missing per-item `nutrient_totals`:
  - if missing on `final_items`, compute from canonical `per_100g` + grams on client.
- Result: ingredient profile works for both newly mapped and previously saved meals (assuming canonical row exists).

### 2) Photo flow moved to canonical-first resolution
- Updated `parse-meal` to assign canonical food IDs/names directly after CV extraction using lexical DB matching.
- Capture parse payload now accepts and applies `canonical_id` / `canonical_name` immediately to editable rows.
- Net effect: photo flow now uses one AI vision pass; canonical lock happens during parse stage.
- `map-foods` still validates and computes nutrients; AI tie-break logic remains in code for unlocked/ambiguous cases.

### 3) Vitamin ordering + naming format implemented
- Enforced deterministic nutrient render order in Capture meal-level nutrient sections by iterating `NUTRIENT_KEYS` (not object iteration).
- Updated labels to requested style:
  - `Vitamin B1 (Thiamin)`
  - `Vitamin B2 (Riboflavin)`
  - `Vitamin B3 (Niacin)`
  - `Vitamin B9 (Folate)`
  - Keep `Vitamin B6` and `Vitamin B12` plain.

### 4) B5 + B7 added end-to-end
- Added keys everywhere:
  - `vitamin_b5_mg`
  - `vitamin_b7_ug`
- Wired through:
  - shared nutrient types/vectors/math/DV
  - edge functions key lists and normalization
  - app vectors and rendering lists
  - formatting labels
  - USDA ingest nutrient-name mapping
- DV values used:
  - B5 = `5 mg`
  - B7 = `30 ug`
- Bumped nutrient DB version:
  - `v0.4-canonical-db-b5b7`

## Commits Landed
- `590a83b` Canonicalize photo parse items at parse time.
- `21231ec` Format B-vitamin names and render micronutrients in fixed order.
- `e5a298a` Add Vitamin B5/B7 tracking across ingestion, backend, and app displays.

## Notable File Changes

### App/UI
- `src/screens/CaptureScreen.tsx`
  - Ingredient profile toggle UI for mapped items.
  - Added fallback hydration from canonical `per_100g` for missing per-item totals.
  - Parse payload supports canonical fields and pre-locks parsed rows.
  - Meal-level nutrient rendering now uses ordered `NUTRIENT_KEYS`.
  - Nutrient vectors updated for B5/B7.
- `src/screens/HomeScreen.tsx`
  - Nutrient vector + key list expanded with B5/B7.
- `src/screens/HistoryScreen.tsx`
  - Nutrient vector + key list expanded with B5/B7.
- `src/lib/formatters.ts`
  - B-vitamin naming updated to requested display labels.
  - Added B5/B7 label mappings.

### Edge Functions / Shared
- `supabase/functions/parse-meal/index.ts`
  - Canonical lexical assignment inside parse flow.
  - Canonical table loading + cache/pagination + zero-vector survey filtering.
  - NUTRIENT_KEYS expanded for B5/B7.
- `supabase/functions/map-foods/index.ts`
  - NUTRIENT_KEYS expanded for B5/B7.
  - (Earlier step) per-item `nutrient_totals` included in mapped output.
- `supabase/functions/search-foods/index.ts`
  - NUTRIENT_KEYS expanded for B5/B7.
- `supabase/functions/_shared/nutrients.ts`
  - Nutrient keys/types/vectors expanded for B5/B7.
  - DV math and vector operations updated.
  - DB version bump to `v0.4-canonical-db-b5b7`.

### Ingestion
- `scripts/ingest-usda-foundation.js`
  - Added B5/B7 nutrient keys.
  - Added nutrient name mapping:
    - B5: `pantothenic acid`, `vitamin b-5`
    - B7: `biotin`, `vitamin b-7`

## Deploy / Data Operations Performed

### Function deploys executed
- `parse-meal` deployed.
- `map-foods` deployed.
- `search-foods` deployed.

### Canonical DB backfill executed
- Foundation ingest:
  - prepared `435`, inserted `435`
- SR Legacy ingest:
  - prepared `7736`, inserted `7736`

## Verified Live DB State (end of Day 16)
- Total `canonical_foods` rows: `13652`
- `source` distribution: all `usda`
- Survey-like row count by `fdc_id` prefix `2...`: `5717`
- Non-survey-like rows: `7935`
- B5 populated rows (`vitamin_b5_mg > 0`): `6174`
- B7 populated rows (`vitamin_b7_ug > 0`): `93`

### High-B7 examples confirmed in DB
- `Peanut butter, creamy`
- `Nuts, almonds, whole, raw`
- `Eggs, Grade A, Large, egg yolk`
- `Oats, whole grain, steel cut`

## Key Product/Data Findings from Founder QA
- Current USDA-derived canonical set is too noisy for user-facing "real food first" goals.
- Search quality pain points cited:
  - `egg` returns many processed/dried/specialized variants
  - `beef liver` poor retrieval while unrelated liver variants dominate
  - parmesan/real-food naming and alias quality are weak
- Core diagnosis:
  - this is primarily a **data curation/catalog strategy problem**, not just model choice.

## Current Architecture Snapshot (end of day)
- Photo path:
  - upload photo -> `parse-meal` (AI extraction + canonical lexical assignment) -> editable locked rows -> `map-foods` compute/persist.
- Manual path:
  - lexical suggestions (`search-foods`) -> user canonical lock -> `map-foods` compute/persist.
- Ingredient profile:
  - prefers persisted per-item totals; falls back to canonical `per_100g` x grams when missing.

## Open Risks / Gaps
- Canonical catalog still includes many low-value/processed/over-specific rows for founder use case.
- B7 remains sparse in source nutrition data even after backfill.
- Ingredient profile currently suppresses zero-value nutrients (can make B7 feel "missing" unless nonzero).
- No dedicated alias/synonym table yet for user-intent naming (`parmigiano reggiano`, `beef liver`, etc.).

## Founder Direction Captured for Day 17
- Move toward a curated **non-fortified, whole-food-first** canonical dataset.
- Strong preference to reduce noisy options and improve AI + search quality by narrowing candidate space.
- Accept some useful variants (e.g., skim/reduced-fat milk) but avoid catalog clutter and processed slop.

## Recommended Next Execution Plan (Day 17)
1) Build deterministic whole-food filter policy (include/exclude + reason tags).
2) Run dry-run audit report against current catalog:
   - keep/exclude counts
   - top excluded patterns
   - query spot checks (`egg`, `beef liver`, `parmesan`, etc.).
3) Materialize curated layer (table or flag), keep old data archived.
4) Switch `search-foods` and `map-foods` retrieval scope to curated layer.
5) Add alias/synonym map for founder-priority terms and common names.
6) Run focused QA on founder food list and iterate rules.

