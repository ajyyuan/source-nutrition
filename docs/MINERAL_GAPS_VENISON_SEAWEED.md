# Mineral gaps: venison, ground venison, nori, dulse, chlorella

**Update:** Mineral patches are implemented in `data/canon/source-canon-v1.mineral-patches.json` and applied by `npm run canon:mineral-patches` (after reseed). The five foods now have Mg, P, K, Zn, Se filled from cited sources below.

## Previous state (per 100g in reseed preview, before patches)

| Food | Ca | Fe | Mg | P | K | Zn | Se |
|------|----|----|----|----|----|----|-----|
| **Venison** | 7 | 2.9 | **0** | **0** | **0** | **0** | **0** |
| **Ground venison** | 7 | 2.9 | **0** | **0** | **0** | **0** | **0** |
| **Nori** | 286 | 51.43 | **0** | **0** | **0** | **0** | **0** |
| **Dulse** | 214 | 28.29 | **0** | **0** | **0** | **0** | **0** |
| **Chlorella** | 333 | 240 | **0** | **0** | **0** | **0** | **0** |

Bold = missing (zeros) in current data.

## Why they’re missing

- **Venison / ground venison**  
  Source: USDA SR Legacy FDC 167622 (Deer, venison, sitka, raw). That record only has Ca and Fe; Mg, P, K, Zn, Se are not in the USDA entry. MyFoodData (from same FDC) also shows these as missing.

- **Nori, dulse, chlorella**  
  Source: USDA FDC branded (nori 1662188, dulse 1589432, chlorella 1064099). Branded rows often omit minerals; our current rows have Ca and Fe but no Mg, P, K, Zn, Se.

## Cited values for patching

Use these only with the stated sources and units (per 100 g). Apply via a mineral-patch step to the reseed preview (same idea as K2 patches).

### Venison / ground venison

- **Mg, P, K, Zn, Se**  
  No values in USDA 167622. Use **lean game meat proxy** from comparable USDA or national database (e.g. raw beef round or similar) until a direct venison source is found, or leave zero and document “not reported in source.”

### Nori (dried)

- **Mg** 200–300 mg (Vita Library, dried unseasoned nori); Norwegian table 33 mg (matvaretabellen.no). Range reflects product/form.
- **P** 150–300 mg (Vita Library); Norwegian 250 mg.
- **K** 2,300–2,800 mg (Vita Library); Norwegian 7,500 mg (different product).
- **Zn** 2–5 mg (Vita Library); Norwegian 0.
- **Se** Often unreported; can use 0 or a small value with a note.

### Dulse

- **Mg** 200–500 mg (0.2–0.5%; seaweedproducts.ie, dulsevita.com).
- **K** ~1,600 mg (dulsevita.com, 8 g serving ≈ 16% RNI).
- **Zn** Low (e.g. ~0.003 mg from ppm data); consider rounded 0.1 or leave 0 with note.
- **P, Se** Need a direct dulse source.

### Chlorella (powder)

- **Mg** 0.3–0.7% → 300–700 mg/100 g (Frontiers 2020, dry weight).
- **P** 0.7–1.5% → 700–1,500 mg/100 g.
- **K** 0.7–2.4% → 700–2,400 mg/100 g.
- **Zn** 2.8–6.4 mg/100 g (28–64 mg/kg).
- **Se** Trace (0–0.5 mg/kg); use 0 or small value with note.
- Content varies by product (Frontiers 2020, MDPI variability study).

## Recommendation

1. Add a **mineral-patches** JSON (e.g. `source-canon-v1.mineral-patches.json`) and an **apply-mineral-patches.js** script that updates the reseed preview for the minerals we track (Mg, P, K, Zn, Se), same pattern as K2.
2. Fill in **nori, dulse, chlorella** from the references above; use mid-range or conservative values and cite the source in the patch file.
3. For **venison / ground venison**, either:
   - use a single USDA “lean game/red meat” proxy and document it in provenance, or  
   - leave as 0 and note in provenance that FDC 167622 does not report these minerals.
4. Run the mineral-patch step after reseed (and before matrix/build) so matrix and app reflect the updated minerals.
