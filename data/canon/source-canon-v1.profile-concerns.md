# Source Canon v1 Profile Concerns

Last updated: 2026-02-22
Owner: data-quality pass
Scope: non-biotin / non-omega3 micronutrient completeness constraints where strict semantic replacements are limited.

## Why this file exists

- Vitamin-focused passes improved non-biotin completeness, but some profile gaps remain outside biotin/omega-3 work.
- This file tracks unresolved "proper micronutrition profile" constraints without forcing form/category drift.

## Status legend

- `open`: no semantically strict replacement currently available.
- `accepted`: known gap accepted to avoid semantic/process drift.
- `resolved`: concern removed via stricter mapping with no meaningful regression.

## Current concerns

| canonical_id | current mapping | current non-biotin/non-omega3 gaps | strict alternatives checked | status | next action |
|---|---|---|---|---|---|
| `ground-goat` | `sr_legacy_food/175303` (`Game meat, goat, raw`) | `vitamin_d_ug`, `vitamin_e_mg`, `vitamin_k_ug`, `vitamin_b5_mg`, `vitamin_b6_mg`, `magnesium_mg` | `sr_legacy_food/175304` (`... cooked, roasted`) improves coverage but introduces raw->cooked form drift against canon default state. | `open` | Keep raw row for now; seek exact ground-goat raw row with fuller reporting in supplemental sources. |
| `hemp` | `sr_legacy_food/170148` (`Seeds, hemp seed, hulled`) | `vitamin_d_ug`, `vitamin_k_ug`, `vitamin_b5_mg`, `vitamin_b12_ug`, `selenium_ug` | No better exact hemp-seed row found in current SR/Foundation/Survey local snapshots. | `open` | Search approved supplemental datasets for exact hemp seed row with fuller micronutrient reporting. |
| `portobello` | `sr_legacy_food/169255` (`Mushrooms, portabella, raw`) | `magnesium_mg` | `sr_legacy_food/169243` (grilled) and `sr_legacy_food/170143` (UV-exposed raw) close the gap but add process/UV treatment drift vs plain raw canonical form. | `accepted` | Keep plain raw mapping unless a plain raw row with full mineral reporting is found. |
| `soba-noodles` | `sr_legacy_food/168906` (`Noodles, japanese, soba, dry`) | `vitamin_e_mg`, `vitamin_k_ug`, `selenium_ug` | `sr_legacy_food/168907` (cooked) has equivalent gaps; no stricter complete soba row currently available. | `open` | Continue source search for exact soba row with fuller micronutrient fields. |
| `wheat` | `sr_legacy_food/169719` (`Wheat, hard white`) | `selenium_ug` | `sr_legacy_food/169722` (wheat bran) removes selenium gap but is a bran-form drift; `sr_legacy_food/169721` (durum) introduces additional vitamin gaps. | `accepted` | Keep current whole-grain wheat mapping; replace only with whole-wheat-equivalent row that improves profile quality. |

## Update protocol

When a profile concern is addressed:

1. Update item notes in `source-canon-v1.manual-curation.json`.
2. Update this tracker status/rationale.
3. Re-run:
   - `npm run canon:reseed:dry`
   - `npm run canon:matrix:build`
4. Verify no semantic drift and no meaningful coverage regression.
