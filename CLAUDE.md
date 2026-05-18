# Source — Project Conventions

iOS-only nutrition app: meal photo → canonical food mapping → micronutrient %DV. Expo RN + Supabase + GPT-4o-mini vision. See `docs/PROJECT.md` for scope and `docs/ARCHITECTURE.md` for system design.

## Architectural non-negotiables

- **Canonical IDs are stable.** Never silently rename or re-slug a `canonical_id`. Display names (`canonical_name`) are separate and can change.
- **Dual food representation.** `parsed_items` (raw AI) and `final_items` (user-approved canonical) on the `meals` table are never merged or overwritten across each other.
- **Nutrient computation is deterministic.** Client uses bundled `src/data/foodProfiles.json`; edge functions use bundled `canon-lookup.json`. No live Supabase reads for catalog or per-100g vectors.
- **AI output is validated before use.** Vision items must resolve to a canon `canonical_id`; `food-unknown` is never accepted from the model.
- **All sensitive logic runs server-side.** Never trust client input — including AI output.

## Scope discipline (v1)

If a feature is not required to (a) convert photos to micronutrient insight, or (b) make that insight more accurate or usable — it does not belong in v1. Out of scope: calories as primary metric, macros, barcode scanning, Android, supplements, meal plans, social features.

## Canon data changes — full-stack + provenance, no exceptions

Every canon/data change must be **full-stack** (preview → matrix → bundled lookups → DB) **and** record **provenance** (source URL/DOI). No exceptions.

Pipeline order after any canon edit:

1. `npm run canon:build` — rebuild flat from source
2. `npm run canon:provenance:build` — rebuild provenance from flat + curation
3. `npm run canon:reseed:dry` — rebuild reseed preview + match audit
4. `npm run canon:k2-patches` — apply K2 patches to preview
5. `npm run canon:mineral-patches` — apply mineral patches (Mg/P/K/Zn/Se)
6. `npm run canon:mineral-provenance` — write mineral provenance section
7. `npm run canon:matrix:build` — rebuild micronutrient matrix + coverage
8. `npm run canon:top-foods` — rebuild `src/data/topFoodsByNutrient.json`
9. `npm run canon:food-profiles` — rebuild `src/data/foodProfiles.json`
10. `npm run canon:lookup` — rebuild bundled `canon-lookup.json` for `map-foods` AND `parse-meal`
11. `npm run canon:sync-preview-to-db` — push preview to Supabase `canonical_foods` (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)

After any patch file change, run the matching provenance step (`canon:k2-provenance` or `canon:mineral-provenance`). Provenance lives in `data/canon/source-canon-v1.external-provenance.json` (sections: `vitamin_k2`, `biotin`, `vitamin_zero`, `mineral_patches`).

## Data completeness

- **Completeness over placeholders.** Prefer searching for real values (USDA FoodData Central, NIH ODS, peer-reviewed sources) over leaving blanks or writing generic "trace" / "~1" without a citation.
- **Never invent values or use bad proxies.** Only use values clearly for the same food, or a documented same-species/cut proxy with a citable source. Document URL/DOI in provenance.
- **Animal products:** reported `0` for vitamins A/D/E/K or B vitamins should be replaced with sourced real values when available.

## Workflow preferences

- **Run scripts yourself.** Do not ask Andrew to run build/test/lint/canon scripts — execute them.
- **Commit messages: no Co-Authored-By.** Plain message only when committing on his behalf.
- **Only commit when explicitly asked.**
