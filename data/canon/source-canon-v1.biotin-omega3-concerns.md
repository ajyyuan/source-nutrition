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
- Biotin remained largely source-limited in current datasets:
  - foods missing biotin: `313`
  - foods with biotin reported: `11`
- High-confidence biotin patch blends were added for semantically exact rows where a strict baseline row had full non-biotin coverage but missing biotin:
  - `chia` (from Foundation 2712620)
  - `oyster-mushroom` (from Foundation 1750345)
  - `shiitake` (from Foundation 1757262)
  - `maitake` (from Foundation 2006839)
  - `white-mushroom` (from Foundation 1757173)

## Biotin current state

Biotin is currently reported for:

- `chlorella`
- `chia`
- `duck-fat`
- `dulse`
- `lamb-tallow`
- `lion-s-mane`
- `maitake`
- `nori`
- `oyster-mushroom`
- `shiitake`
- `white-mushroom`

Status: `open` (dataset sparsity / reporting limitation in current source rows).

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
