# How the data works (explained in detail)

This doc explains where nutrient data lives, how it gets updated, and what has to happen for a change (like adding vitamin K2) to show up in the real product. Written to be very concrete and step-by-step.

---

## 1. The big picture in one sentence

**We have a list of “canon” foods; for each food we pick one “winning” nutrient row (per 100g); that winning row is written to a preview file and used to build everything the app and API use — and optionally pushed to the database.**

---

## 2. The main “buckets” of data

Think of it in layers.

### Layer A: The master list of foods (the “canon” list)

- **What:** The list of every food we care about: “chicken-breast”, “natto”, “butter”, etc.
- **Where:** Comes from **`source-canon-v1.flat.json`** (the “flat” file). Each item has things like `canonical_id`, `canonical_name`, `domain`, `food_group`, etc. **No nutrient numbers live here** — just “who” the foods are.
- **Who builds it:** `npm run canon:build` produces the flat from another source (e.g. `source-canon-v1.json`). You don’t edit the flat by hand for normal nutrient work.

So: **flat = the list of canonical foods, no per_100g.**

---

### Layer B: All the possible nutrient rows (candidates)

We have many rows that each say “for this fdc_id, here are nutrients per 100g”. Two places they come from:

1. **USDA CSV data**  
   Loaded from CSV dirs (e.g. SR Legacy, Foundation, Survey). Each row has an `fdc_id` (e.g. `"173998"`) and a `per_100g` object (vitamin_a_ug, vitamin_k_ug, etc.).

2. **Supplemental source rows**  
   **File:** `data/canon/source-canon-v1.supplemental-source-rows.json`  
   Same idea: each row has `fdc_id`, `canonical_id`, `canonical_name`, and **`per_100g`**.  
   This is where we put “patched” or custom rows that don’t come from USDA — e.g. “vitamin-patch-chicken-breast” with our own vitamin values, or biotin patches.

So: **“Source rows” = USDA rows + supplemental rows. Each has `fdc_id` and `per_100g`.**

---

### Layer C: The “curation” map (which row wins for each food)

- **What:** For each canonical food we decide: “use *this* fdc_id’s nutrients.”
- **Where:** **`data/canon/source-canon-v1.manual-curation.json`**  
   It has `matches`: each match says `canonical_id` (e.g. `"chicken-breast"`) and `fdc_id` (e.g. `"vitamin-patch-chicken-breast"`).
- **Effect:** When we build the “preview”, we don’t guess — we use that fdc_id’s `per_100g` for that food.

So: **curation = canonical_id → fdc_id. “For chicken-breast, use the row with fdc_id vitamin-patch-chicken-breast.”**

---

### Layer D: The “preview” (one row per food, with per_100g)

- **What:** One row per canonical food: the **chosen** `per_100g` (and metadata). This is the single source of truth for “what nutrients does this food have?”
- **Where:** **`data/canon/source-canon-v1.reseed-preview.json`**  
   It has `rows`. Each row has `canonical_id`, `canonical_name`, `fdc_id`, `per_100g`, `is_usable`, etc.
- **How it’s built:** The **reseed** script:
  1. Reads the **flat** (list of foods).
  2. Loads all **source rows** (USDA + supplemental), merged by `fdc_id`.
  3. Loads **curation** (canonical_id → fdc_id).
  4. For each food in the flat:  
     - If curation says “use fdc_id X”, it takes the row with that `fdc_id` and uses its `per_100g`.  
     - Otherwise it tries to match by name, etc.  
  5. Writes one row per food to **the preview file** (and optionally to the DB; see below).

So: **preview = one row per canon food, with the winning `per_100g`. Built by reseed from flat + source rows + curation.**

---

### Layer E: Post-preview patches (e.g. K2)

- **What:** Some values we add *after* reseed by editing the preview file. We don’t put them in supplemental rows; we overwrite specific keys in the preview.
- **Where:**  
  - **K2:** `data/canon/source-canon-v1.vitamin-k2-patches.json` (canonical_id → `{ vitamin_k2_ug: number }`).  
  - **Script:** `npm run canon:k2-patches` reads the preview, for each patched canonical_id sets `per_100g.vitamin_k2_ug`, and **writes the preview file back**.
- **Important:** Reseed does **not** know about K2 patches. So the preview *file* on disk can have K2 (after you run k2-patches), but the in-memory result inside reseed does not. That matters for the DB (see below).

So: **K2 (and similar) = patch the preview file after reseed. Reseed itself never runs this step.**

---

### Layer F: Derived files (from the preview)

These are **read-only outputs** from the preview. They don’t get edited by hand.

| File | What it is | Who builds it |
|------|------------|----------------|
| `data/canon/source-canon-v1.micronutrient-matrix.csv` (and related) | Matrix of which foods have which nutrients (and values) | `npm run canon:matrix:build` (reads preview) |
| `data/canon/source-canon-v1.micronutrient-coverage.csv` / `.json` | Coverage stats | same script |
| `src/data/topFoodsByNutrient.json` | For each nutrient, top N foods by per-100g value | `npm run canon:top-foods` (reads preview) |
| **`src/data/foodProfiles.json`** | **canonical_id → { display_name, per_100g }** | **`npm run canon:food-profiles`** (reads preview) |
| `data/canon/source-canon-v1.provenance.json` | High-level provenance (which source dataset per food) | `npm run canon:provenance:build` (reads flat + curation, not preview) |

So: **matrix, coverage, top-foods, and foodProfiles are all “preview in another shape”. Provenance is from flat + curation.**

---

### Layer G: The database (Supabase)

- **What:** The **canonical_foods** table. One row per canonical food, with `canonical_id`, `canonical_name`, `per_100g` (JSONB), `is_canon_v1`, etc.
- **When it changes:** Only when you run **`npm run canon:reseed:apply`** (reseed with `--apply`).  
  Reseed then:
  1. Builds the preview **in memory** (flat + source rows + curation; **no K2 patch**).
  2. Writes the preview to the **preview file** (so the file on disk still has no K2 at that moment).
  3. **Upserts** those in-memory rows into **canonical_foods** in Supabase.

So: **the DB gets exactly what reseed computed in memory. It does not read the preview file. So if you only ran k2-patches on the file, the DB never gets K2.**

---

## 3. Where does the app get its numbers?

Two different places:

1. **Food detail screen (per 100g view)**  
   The app reads **`src/data/foodProfiles.json`** (bundled with the app).  
   So: **whatever is in foodProfiles when you build the app** is what you see there.  
   FoodProfiles is built from the **preview file** (after k2-patches). So **K2 shows here** once you’ve run: reseed → k2-patches → canon:food-profiles, and rebuilt the app.

2. **Meal totals (when you add foods to a meal)**  
   The app calls the **map-foods** API. That API reads **canonical_foods** in Supabase and uses each food’s `per_100g` to compute totals.  
   So: **whatever is in the DB** is what meal totals use.  
   The DB is updated only by **reseed:apply**, and reseed does **not** apply K2. So **K2 does not appear in meal totals** unless we either:
   - Put K2 into the supplemental rows (so the “winning” row already has vitamin_k2_ug), or
   - Add a step that writes the **preview file** (after k2-patches) to the DB, or
   - Run K2-style patches inside reseed before it writes to the DB.

So: **food detail = foodProfiles (from patched preview). Meal totals = DB (from reseed only, no K2 today).**

---

## 4. End-to-end: “I want to add K2 and see it in the product”

Concrete steps and where each one matters.

### Step 1: Decide we store K2

- We added a new key **`vitamin_k2_ug`** to the schema everywhere (types, NUTRIENT_KEYS, default 0 in all `per_100g`).  
- So every place that holds nutrients (preview, supplemental, DB, foodProfiles) can carry that number.

### Step 2: Put K2 values somewhere the preview can get them

- We created **`source-canon-v1.vitamin-k2-patches.json`** (canonical_id → vitamin_k2_ug).
- We do **not** put these into supplemental rows (we could, but we didn’t). We patch the **preview file** after reseed.

### Step 3: Reseed (build the “winning” row per food)

- **`npm run canon:reseed:dry`**  
  Reads flat + USDA + supplemental + curation → for each food picks one row → writes **reseed-preview.json**.  
  At this point preview has `vitamin_k2_ug: 0` (or whatever the winning row had; most have 0).

### Step 4: Apply K2 to the preview file

- **`npm run canon:k2-patches`**  
  Reads the preview file, for each canonical_id in the K2 patch file sets `per_100g.vitamin_k2_ug`, **writes the preview file back**.  
  Now the **preview file on disk** has real K2 for natto, cheese, eggs, etc.

### Step 5: Rebuild everything that depends on the preview

- **`npm run canon:matrix:build`** — matrix and coverage from preview.  
- **`npm run canon:top-foods`** — top foods per nutrient from preview.  
- **`npm run canon:food-profiles`** — **foodProfiles.json** from preview.  
  So **foodProfiles** now has K2. The **food detail screen** will show K2 (and total K = K1+K2) after you **rebuild/reload the app**.

### Step 6: (Optional) Push to the database so meal totals have K2

- **As things are now:** **`npm run canon:reseed:apply`** would overwrite the DB with reseed’s in-memory result (no K2). So meal totals still wouldn’t use K2.
- **To get K2 in meal totals** you’d need one of:
  - A script that **reads the preview file** (after k2-patches) and **upserts those rows into canonical_foods**, or
  - Adding K2 into **supplemental rows** (or into the winning rows reseed picks) so reseed:apply naturally writes K2 to the DB, or
  - Running the K2 patch logic **inside** reseed before it writes the preview and the DB (so both get K2).

So: **today, “add K2 and run the pipeline” = you see K2 in the food detail screen (foodProfiles). To see K2 in meal totals you need the DB to get the patched preview (extra step or change to reseed).**

---

## 5. One-page “data flow” diagram (words)

```
[ Flat (list of foods) ]
         +
[ Source rows: USDA CSVs + supplemental-source-rows.json ]
         +
[ Curation: manual-curation.json (canonical_id → fdc_id) ]
         |
         v
    RESEED (reseed-canon-v1.js)
         |
         v
[ reseed-preview.json ]  (one row per food, per_100g)
         |
         +---> K2 PATCHES (apply-vitamin-k2-patches.js)  -->  overwrites preview file
         |
         v
[ preview file on disk ]  (with K2 if you ran k2-patches)
         |
         +---> canon:matrix:build   -->  matrix + coverage CSVs/JSON
         +---> canon:top-foods      -->  topFoodsByNutrient.json
         +---> canon:food-profiles  -->  foodProfiles.json  -->  FOOD DETAIL SCREEN
         |
         (reseed:apply writes reseed’s in-memory rows to DB; does NOT read this file)
         v
[ Supabase canonical_foods ]  -->  map-foods API  -->  MEAL TOTALS
```

---

## 6. Quick reference: “I changed X, what do I run?”

- **Changed flat or curation only**  
  `canon:build` (if flat comes from another source), `canon:provenance:build`, then **reseed → k2-patches → matrix → top-foods → food-profiles**.

- **Changed supplemental rows or USDA data**  
  **Reseed** (so the new rows are merged and the winning row can change), then **k2-patches → matrix → top-foods → food-profiles**.

- **Changed K2 (or other post-preview patch) file only**  
  **k2-patches** (updates preview file), then **matrix → top-foods → food-profiles**. No need to reseed unless you also changed sources or curation.

- **Want the app’s food detail screen to match**  
  After foodProfiles is built, **rebuild/reload the app** so it bundles the new foodProfiles.

- **Want meal totals in the real product to match**  
  The DB must be updated. Right now that’s **reseed:apply** (which doesn’t include K2). To get K2 there you need a DB update that uses the **patched** preview (see section 4, step 6).

---

That’s the full picture: where data lives, how it’s updated, and what “add K2 and see it in the UI” actually means for the food detail screen vs. meal totals.
