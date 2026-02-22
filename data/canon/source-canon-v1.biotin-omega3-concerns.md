# Source Canon v1 Biotin + Omega-3 Concerns

Last updated: 2026-02-22
Owner: data-quality pass
Scope: explicit biotin (`vitamin_b7_ug`) and omega-3 (`omega3_g`) completeness tracking.

## Pass summary (Day 20)

- Omega-3 parsing was expanded to support USDA component rows when `fatty acids, total omega-3` is absent:
  - ALA: `PUFA 18:3 n-3 c,c,c (ALA)` and `PUFA 18:3 c`
  - EPA: `PUFA 20:5 n-3 (EPA)` and `PUFA 20:5c`
  - DHA: `PUFA 22:6 n-3 (DHA)` and `PUFA 22:6 c`
- Coverage impact after rebuild:
  - foods missing omega-3: `319 -> 36`
  - foods with omega-3 reported: `5 -> 288`
- Biotin remained source-limited in core USDA/CNF rows, then improved via external-source patch blending:
  - foods missing biotin: `313 -> 229 -> 203 -> 119`
  - foods with biotin reported: `11 -> 95 -> 121 -> 205`
- External biotin donor source added:
  - German Nutrient Database (BLS), version 4.0 (2025), DOI `10.25826/Data20251217-134202-0`
  - URL: `https://www.blsdb.de/download`
- Patch strategy for this pass:
  - preserve existing canon baseline vectors
  - inject only `vitamin_b7_ug` from high-confidence BLS matches
  - keep all previously missing non-biotin nutrients missing (no non-biotin fill-in)
- Follow-up targeted animal-food pass:
  - added `26` additional animal-focused donor patches (eggs, shellfish, fish species, selected dairy/cuts)
  - proxy-species donor rows were used only when an exact species row was unavailable and tagged in provenance
- **Complete animal-domain biotin pass (Day 20+):**
  - all remaining animal-product biotin blanks filled (`82` foods)
  - BLS used where same food/cut; literature proxy (e.g. eatforhealth, ODS) for muscle/cheese/dairy/fat where no BLS match
  - provenance: `external_biotin_literature_patch` or `german_bls_4_0_biotin_patch` with URL/DOI and `semantic_match_type`

## Biotin current state

Biotin is now reported for `205` canon foods. **All animal-domain foods now report biotin** (0 animal blanks remaining).

Provenance for external-source injections is tracked in:

- `source-canon-v1.external-biotin-provenance.json`

Status: `open` (improved; `119` foods still missing biotin, predominantly plant/fermented/fungi).

## Residual omega-3 missing set

Residual omega-3 missing foods (36):

- `acorn-squash`, `almond-butter`, `anchovy`, `avocado-oil`, `beef-kidney`, `beef-tongue`, `chia`,
- `chicken-heart`, `chop-lamb-goat`, `corn`, `duck-breast`, `ghee`, `grapeseed-oil`, `ground-goat`,
- `hot-sauce`, `ketchup`, `lamb-liver`, `lion-s-mane`, `millet`, `naan`, `oxtail`, `oyster-mushroom`,
- `parsnip`, `pork-belly`, `pork-heart`, `pork-kidney`, `pork-liver`, `rice-bran-oil`, `sheep-milk`,
- `soba-noodles`, `soybean`, `spaghetti-squash`, `spirulina`, `strip-steak`, `tempeh`, `turkey-egg`

Status: mixed `open` (some likely data sparsity; some may benefit from future targeted supplemental rows).

## Update protocol

When addressing biotin/omega-3 concerns:

1. Keep semantic strictness first (no form/category drift solely for coverage gain).
2. Update manual curation notes for any source-row changes.
3. Re-run:
   - `npm run canon:reseed:dry`
   - `npm run canon:matrix:build`
4. Verify both:
   - no regression in non-biotin vitamin completeness,
   - concern status updates reflected in this file.
