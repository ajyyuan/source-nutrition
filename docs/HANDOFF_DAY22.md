# Day 22 Handoff (Source)

Handoff for mineral patches (venison, nori, dulse, chlorella), whole-wheat-pasta mapping fix, user-preferences rule, mapping spot-check, and mineral patch provenance.

## Session Intent (Founder)
- Review minerals for venison, ground venison, nori, dulse, chlorella (gaps filled).
- Confirm whole wheat pasta omega-3 ranking was wrong; fix mapping.
- Add rules: run scripts for user (don’t ask); no Co-authored-by on commits.
- Quick check of all mappings for accuracy; commit; handoff for today.
- Add mineral patch provenance to external-provenance.

## What Was Completed

### 1) Mineral patches (venison, nori, dulse, chlorella)
- **Gaps:** These five foods had Ca/Fe but missing Mg, P, K, Zn, Se in reseed (USDA source rows omit them).
- **Patch file:** `data/canon/source-canon-v1.mineral-patches.json` with cited values:
  - Venison/ground venison: lean game proxy (Mg 21, P 201, K 330, Zn 4, Se 10).
  - Nori: Vita Library mid-range (Mg 250, P 225, K 2550, Zn 3.5).
  - Dulse: dulsevita.com / seaweedproducts.ie (Mg 350, P 80, K 1600, Zn 0.5).
  - Chlorella: Frontiers 2020 / PMC7557355 (Mg 500, P 1100, K 1550, Zn 4.6).
- **Script:** `scripts/apply-mineral-patches.js`; npm `canon:mineral-patches` (run after reseed, with K2).
- **Docs:** `docs/MINERAL_GAPS_VENISON_SEAWEED.md` (rationale and sources).
- Pipeline rule updated: mineral patches are step 5; matrix/top-foods/food-profiles follow.

### 2) Whole-wheat-pasta mapping fix
- **Issue:** Whole wheat pasta was ranked #10 for omega-3 (above sockeye/chinook) because it was mapped to FDC **172749 = "Crackers, whole-wheat"** (high fat/ALA), not pasta.
- **Fix:** Curation updated so `whole-wheat-pasta` uses FDC **168910 = "Pasta, whole-wheat, cooked"**. Omega-3 now ~0.036 g/100 g; pasta no longer in top omega-3 list.
- **Note in curation:** Remapped from 172749 (Crackers, whole-wheat); 168910 is actual whole-wheat pasta cooked.

### 3) User-preferences rule
- **`.cursor/rules/user-preferences.mdc`** (always apply):
  - Do not ask the user to run scripts; run any necessary scripts (build, test, canon pipeline) yourself.
  - When committing on the user’s behalf, do not add a "Co-authored-by" line; use a plain commit message only.

### 4) Mapping spot-check
- Reviewed manual curation for obvious mismatches (e.g. pasta vs crackers, noodles vs wrong type).
- Confirmed: only crackers entry is `crackers-plain` → "Crackers, matzo, plain"; whole-wheat-pasta is now pasta; noodle/pasta entries align with source names. No other corrections needed.

### 5) Mineral patch provenance
- **`source-canon-v1.external-provenance.json`** now has a **`mineral_patches`** section: source_citations (venison_proxy, nori_literature, dulse_literature, chlorella_literature) and entries for venison, ground-venison, nori, dulse, chlorella with Mg, P, K, Zn, Se values and patch_file ref.
- **Script:** `scripts/build-mineral-provenance.js` reads `source-canon-v1.mineral-patches.json` and flat, writes `mineral_patches` into the consolidated external-provenance file; npm `canon:mineral-provenance`.
- **Pipeline and rules:** `canon-pipeline.mdc` step 6 = run mineral-provenance after changing mineral-patches; provenance doc lists vitamin_k2, biotin, vitamin_zero, mineral_patches; **always** update the matching provenance section when adding or changing any patch. `canon-data-and-provenance.mdc` updated to include mineral_patches and to require running the matching provenance script.

## Key Files Updated (This Session)
- Canon: `source-canon-v1.manual-curation.json`, `source-canon-v1.mineral-patches.json` (new), `source-canon-v1.external-provenance.json` (mineral_patches section), reseed-preview, matrix/coverage (regenerated).
- Scripts: `scripts/apply-mineral-patches.js` (new), `scripts/build-mineral-provenance.js` (new); `package.json` (`canon:mineral-patches`, `canon:mineral-provenance`).
- App data: `src/data/topFoodsByNutrient.json`, `src/data/foodProfiles.json` (rebuilt).
- Rules: `.cursor/rules/user-preferences.mdc` (new), `.cursor/rules/canon-pipeline.mdc` (mineral step + mineral-provenance step), `.cursor/rules/canon-data-and-provenance.mdc` (mineral_patches + provenance requirement).
- Docs: `docs/MINERAL_GAPS_VENISON_SEAWEED.md`, `docs/HANDOFF_DAY22.md` (this file).

## Commits Landed
- Add mineral patches for venison, nori, dulse, chlorella; user-preferences rule (run scripts, no coauthor).
- Fix whole-wheat-pasta mapping: use FDC 168910 (pasta cooked) not 172749 (crackers); omega-3 now correct.
- Add mineral patch provenance (build-mineral-provenance.js, external-provenance mineral_patches section, pipeline + rule updates).
- (Co-authored-by stripped from commit messages per user preference.)

## Current State Snapshot
- **Minerals:** Venison, ground venison, nori, dulse, chlorella have Mg, P, K, Zn, Se from cited patch; matrix and app data rebuilt.
- **Omega-3 / pasta:** Whole wheat pasta shows ~0.036 g omega-3/100 g; top omega-3 list is fish/oils/hemp/etc., no pasta.
- **Provenance:** All patch types (K2, biotin, vitamin-zero, mineral) are recorded in `source-canon-v1.external-provenance.json`; run `canon:k2-provenance` or `canon:mineral-provenance` after changing the corresponding patch file.
- **Pipeline:** After reseed: K2 patches → mineral patches → mineral-provenance (if patch changed) → matrix → top-foods → food-profiles; sync-preview-to-db when DB should match.
- **Rules:** User preferences (run scripts, no coauthor) and canon pipeline (including mineral + provenance steps) and canon-data-and-provenance (mineral_patches, always-update-provenance) are in `.cursor/rules`.
