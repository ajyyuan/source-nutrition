# Minerals audit (canon v1)

Audit of mineral nutrient mapping and usage across canon, reseed, matrix, and edge functions. Same rigor as for vitamins: no wrong proxies, no form/unit mix-ups; completeness matters.

## Mineral keys (canon v1)

| Our key        | Unit | USDA name (primary) | Notes |
|----------------|------|----------------------|--------|
| `calcium_mg`   | MG   | Calcium, Ca          | Total calcium only. |
| `iron_mg`      | MG   | Iron, Fe             | Total iron only. |
| `magnesium_mg` | MG   | Magnesium, Mg        | |
| `phosphorus_mg`| MG   | Phosphorus, P        | |
| `potassium_mg` | MG   | Potassium, K         | |
| `zinc_mg`      | MG   | Zinc, Zn             | |
| `selenium_ug`  | UG   | Selenium, Se         | |

## Where mapping lives

- **Reseed** (`scripts/reseed-canon-v1.js`): `NUTRIENT_NAME_MAP` maps USDA `nutrient.csv` name + unit → our key. Used to build `per_100g` from `food_nutrient.csv`. Source of truth for which USDA nutrients fill which keys.
- **Matrix** (`scripts/build-canon-v1-matrix.js`): Same `NUTRIENT_NAME_MAP` (must match reseed) for `buildNutrientLookup` / reported-status only. Values come from reseed preview `per_100g`.
- **Ingest** (`scripts/ingest-usda-foundation.js`): Own `NUTRIENT_NAME_MAP`; mineral entries match reseed. Used for one-off foundation ingest.
- **Edge functions** (`parse-meal`, `map-foods`, `_shared/nutrients.ts`): No USDA mapping. They read `per_100g` from DB (canonical_foods) or shared stub; keys are fixed.

## USDA nutrient names checked (SR legacy, foundation, survey)

All three USDA CSV dirs use the same nutrient names:

- **Calcium, Ca** (MG) – mapped ✓  
- **Iron, Fe** (MG) – mapped ✓  
- **Magnesium, Mg** (MG) – mapped ✓  
- **Phosphorus, P** (MG) – mapped ✓  
- **Potassium, K** (MG) – mapped ✓  
- **Zinc, Zn** (MG) – mapped ✓  
- **Selenium, Se** (UG) – mapped ✓  

Other mineral-related entries in USDA (not mapped to our keys, by design):

- Calcium, added; Calcium, intrinsic – not used (would need summing logic if we wanted “total” when Ca, Ca absent).
- Iron, heme; Iron, non-heme; Iron, added; Iron, intrinsic – not used; we use total **Iron, Fe** only.

## Findings

1. **No mixing**  
   Only total minerals are mapped. Sub-components (heme/non-heme iron, added/intrinsic calcium) are not mapped to our keys, so we never combine or substitute them for total.

2. **No unit mix-ups**  
   All minerals use one mapping per key; units match (MG vs UG). No conversion factors needed for minerals (unlike e.g. vitamin A IU→µg).

3. **No mis-mapping**  
   Normalized name + unit matching is consistent. “Iron, heme” does not match “iron, fe”; “Calcium, added” does not match “calcium, ca”.

4. **Supplemental rows**  
   `source-canon-v1.supplemental-source-rows.json` and any scripts that write it use the same keys; `normalizePer100g()` in reseed only accepts our 22 keys. No extra mineral keys or units.

5. **Possible completeness improvement (later)**  
   If a source ever reports only “Calcium, added” + “Calcium, intrinsic” (and not “Calcium, Ca”), we could add logic to sum them into `calcium_mg` when building a source row. Not done in this audit; would require explicit summing in reseed and care to avoid double-counting when “Calcium, Ca” is also present.

## Recommendation

No code changes required. Mineral mapping is consistent and correct. When adding or changing nutrient mappings, keep reseed’s `NUTRIENT_NAME_MAP` as the source of truth and align matrix (and ingest if still used) with it.
