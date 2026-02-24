# Day 20 Handoff (Source)

Handoff for animal-product biotin completion, vitamin-zero patches with cited values only, and data-completeness standards.

## Session Intent (Founder)
- Fill **all** remaining animal-product biotin blanks (no animal left without a biotin value).
- Replace reported **0** for vitamins A, D, E, K, and B vitamins in animal products with **real values** where findable—no lazy “trace” placeholders.
- Prioritize **completeness** (use web search to find values); do not make things up or use bad proxies.
- Keep git status clean (either ignore or commit generated artifacts).

## What Was Completed

### 1) Full animal-domain biotin fill (82 foods)
- All remaining animal foods missing biotin were patched using BLS 4.0 (where same food/cut) or literature (NIH ODS, eatforhealth, J Nutr) for muscle/organ/dairy/fat proxies.
- New script: `scripts/apply-animal-biotin-patches.js` with a vetted value map; patches write to `source-canon-v1.supplemental-source-rows.json`, curation, and the biotin section of `source-canon-v1.external-provenance.json`.
- Invariant: patches add only `vitamin_b7_ug`; other missing nutrients stay missing.

### 2) Ground beef biotin sourced from NIH ODS
- Replaced generic “~1 µg/100g” with **NIH ODS Table 2**: “Hamburger patty, cooked, 3 ounces” = 3.8 mcg → **4.5 µg/100g** (converted).
- All six ground-beef variants (4%, 7%, 10%, 15%, 20%, 30% fat) and their provenance/manual-curation notes updated to cite NIH ODS; script value map updated for future runs.

### 3) Animal vitamin zeros: real values only (no made-up traces)
- **Reverted** the “trace minimum” hack in `scripts/reseed-canon-v1.js` (no more automatic 0 → 0.1 etc. for animal vitamins).
- Introduced a **cited-values-only** patch system:
  - **Data:** `data/canon/source-canon-v1.animal-vitamin-zero-patches.json` — only values with a clear source (USDA, NIH ODS, nutritionvalue, dietandfitnesstoday, literature).
  - **Script:** `scripts/apply-animal-vitamin-zero-patches.js` — for each animal food, replaces reported 0 for A/D/E/K/B vitamins only where a patch value exists; writes `vitamin-patch-{canonical_id}` supplemental rows and points curation at them.
- Patches added for: Swiss (B12), chicken/turkey (A, K), butter (K), yogurts (K, D, biotin), cottage cheese (D, K), lamb liver (K), half-and-half (D), milk (biotin), chicken/turkey eggs (D), tuna/salmon (D).
- **Result:** 20 animal vitamin zeros replaced with cited values (198 → 178 zeros remaining). Remaining zeros are where no non-zero value was found in search (e.g. beef muscle vitamin A, egg white A/E, refined fats, many shellfish D).

### 4) Data-completeness rule (always apply)
- Added `.cursor/rules/data-completeness.mdc`:
  - Completeness over all else when filling nutrient/food data.
  - Use web search to find real values; don’t leave blanks or use placeholders when a value can be found.
  - No making things up; no bad proxies; only cited, same-food (or documented proxy) values.
  - For animal products, replace reported 0 for A/D/E/K/B vitamins when a reliable source exists; avoid un-sourced “trace” when a real value can be found.

### 5) Biotin/omega-3 doc and coverage snapshot
- `data/canon/source-canon-v1.biotin-omega3-concerns.md` updated: biotin now reported for **205** canon foods; **0** animal-domain biotin blanks; **119** foods still missing biotin (mostly plant/fermented/fungi).

### 6) Git hygiene
- `data/canon/source-canon-v1.match-audit.json` is reseed-generated; added to `.gitignore` and removed from tracking so working tree stays clean after `npm run canon:reseed:dry`.

## Key Files Updated (Today)
- Canon data and outputs (regenerated):
  - `data/canon/source-canon-v1.supplemental-source-rows.json`
  - `data/canon/source-canon-v1.manual-curation.json`
  - `data/canon/source-canon-v1.external-provenance.json` (biotin section)
  - `data/canon/source-canon-v1.reseed-preview.json`
  - `data/canon/source-canon-v1.micronutrient-matrix*.csv`
  - `data/canon/source-canon-v1.micronutrient-coverage*.csv` / `-summary.json`
  - `data/canon/source-canon-v1.biotin-omega3-concerns.md`
- New/added:
  - `data/canon/source-canon-v1.animal-vitamin-zero-patches.json`
  - `scripts/apply-animal-biotin-patches.js`
  - `scripts/apply-animal-vitamin-zero-patches.js`
  - `.cursor/rules/data-completeness.mdc`
- Config:
  - `.gitignore` (match-audit.json ignored; match-audit removed from tracking)

## Commits Landed
- `d354b1f` canon: animal biotin + vitamin-zero patches; data-completeness rule
- `d806034` gitignore: ignore reseed-generated match-audit.json

## Current State Snapshot
- **Biotin:** 205 canon foods report biotin; 0 animal blanks; 119 foods still missing (mostly non-animal).
- **Animal vitamin zeros:** 178 remaining (down from 198); 20 filled with cited values only.
- **Coverage:** any_missing 151, all_reported 173 (324 total foods).
- Trace-minimum shortcut removed; all new values are from patch data with cited sources.
- Data-completeness rule is always-on for future sessions.

## Next Session Plan (Suggestions)

**Do these two first, before everything else:**

1. **Nutrient click-through page** (from Day 18): Implement a tap-from-nutrient view so that tapping any nutrient opens a basic page with:
   - short description of major functions in the body,
   - what deficiencies look like,
   - which foods in our database are especially high in that nutrient.

2. **Minerals audit:** Ensure we aren’t suspiciously mixing, mis-mapping, or **missing** minerals (same rigor as for vitamins: no wrong proxies, no form/unit mix-ups; completeness matters). Audit canon/source mapping and parsing for minerals; fix any mixing, mis-mapping, or gaps before further vitamin/completeness work.

**Then:**

3. Continue reducing animal vitamin zeros by searching for and adding real values to `source-canon-v1.animal-vitamin-zero-patches.json`, then re-running `node scripts/apply-animal-vitamin-zero-patches.js` and `npm run canon:reseed:dry` + `npm run canon:matrix:build`.
4. Focus search on largest remaining gaps: vitamin_a_ug, vitamin_d_ug, vitamin_k_ug (e.g. beef/pork/lamb muscle A, shellfish D, pork K) where a cited per-100g value exists.
5. After any canon/supplemental/provenance change: run `npm run canon:reseed:dry` and `npm run canon:matrix:build` and refresh docs.

## Later / backlog (not urgent)
- **Food detail page:** A page for every canon food showing its full micronutrient profile. From the nutrient click-through page, tapping a listed “top food” should open that food’s detail page.
- **Discover tab:** Searchable/browsable list of all foods (e.g. discover tab with search), linking into the same food detail pages.

## npm audit (as of Day 20)
- Ran `npm audit fix`: fixed **@isaacs/brace-expansion** and **tar** (2 of 21 high). **19 high** remain.
- Remaining issues are all **minimatch** (ReDoS) and **glob** in the **react-native / expo** dependency tree. They are transitive; fixing them would require `npm audit fix --force`, which would downgrade to **expo@51** (breaking change from current ~54). Safe to leave until the next planned Expo upgrade; the vulnerable code is in dev/build tooling (Metro, codegen, jest), not in the app runtime.

## Notes for the Next Agent
- **First:** Ship the nutrient click-through page (tap nutrient → page with description, deficiency signs, top foods). **Second:** Audit minerals for suspicious mixing, mis-mapping, or missing; fix before other completeness work.
- Follow `.cursor/rules/data-completeness.mdc`: use web search for completeness; no made-up traces or bad proxies.
- Animal vitamin zeros: only patch when a **cited** value exists; add it to `source-canon-v1.animal-vitamin-zero-patches.json` (and note source in the file), then run `scripts/apply-animal-vitamin-zero-patches.js`.
- `source-canon-v1.match-audit.json` is generated by reseed and is gitignored; do not commit it.
