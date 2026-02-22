# Source Canon v1 Proxy Concerns

Last updated: 2026-02-22
Owner: data-quality pass
Scope: semantic/form proxy concerns in canonical source mappings (not generic vitamin sparsity).

## Why this file exists

- `source-canon-v1.manual-curation.json` stores per-item notes, but it is hard to quickly see unresolved proxy risks in one place.
- This file is the canonical "watch list" for proxy concerns that still need action or explicit acceptance.

## Status legend

- `open`: still needs a better source row.
- `accepted`: not ideal form, but currently best available source with explicit rationale.
- `resolved`: proxy concern removed via a better mapping.

## Current concerns

| canonical_id | current mapping | status | concern | rationale | next action |
|---|---|---|---|---|---|
| `oxtail` | `canadian_nutrient_file/cnf-1092` (`Soup, oxtail, dehydrated, water added`) | `open` | soup-form proxy | Exact oxtail non-soup row with strong vitamin coverage not yet found in USDA/CNF. | Continue external-source search for true oxtail row; replace immediately if found. |
| `chlorella` | `usda_api_branded/1064099` (`CHLORELLA POWDER`) | `accepted` | product-form proxy | Canonical item is ingredient-level chlorella; powder form is currently the best exact available labeled source. | Keep as accepted unless a more authoritative non-branded ingredient row is found. |
| `sardine` | `sr_legacy_food/175139` (`Fish, sardine, Atlantic, canned in oil, drained solids with bone`) | `accepted` | packed-in-oil form | This is still whole sardine food (not fish oil), but oil-packed form can bias fat-soluble nutrients. | Prefer equivalent non-oil sardine row with equal or better vitamin completeness when available. |

## Recently resolved examples (from latest pass)

- `banana`: fixed banana-pepper homonym mismatch.
- `oyster`: fixed oyster-mushroom homonym mismatch.
- `apple`, `orange`, `tangerine`, `lemon`, `lime`, `strawberry`, `blueberry`, `papaya`, `peach`, `apricot`: fixed juice/pie/babyfood proxies to direct fruit rows.
- `onion`, `tomato`, `potato`, `green-bean`, `white-rice`, `brown-rice`, `soybean`: fixed powder/flour/chips/curd proxies to plain/raw rows.
- `cow-s-milk-1`, `cow-s-milk-skim`: fixed beverage/yogurt proxies to true milk rows.
- `pita`, `bagel`, `white-bread`, `whole-wheat-bread`: fixed chips/flour cross-proxies to direct bread rows.

## Update protocol

When a mapping is changed due to proxy risk:

1. Update the per-item `notes` in `source-canon-v1.manual-curation.json`.
2. Update this file (`open` -> `accepted` or `resolved`, with rationale).
3. Rebuild:
   - `npm run canon:reseed:dry`
   - `npm run canon:matrix:build`
4. Verify no regression in coverage and semantic fit.
