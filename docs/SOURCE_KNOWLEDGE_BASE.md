# Source — Full Knowledge Base

> **Purpose:** A comprehensive knowledge document for brainstorming product direction. Combines architecture, data flow, product decisions, technical constraints, and evolution history. Use alongside ChatGPT or other tools to explore next directions.

---

## 1. What Source Is

**Source** is an iOS app that turns meal photos into micronutrient insight.

Instead of "How many calories did I eat?", Source asks: **"What did this food actually give my body?"**

### Core Positioning
- **Micronutrients > macros**
- **Estimates > fake precision**
- **Correction over perfection**
- **Clarity over gamification**
- **Real food over abstraction**

### Tagline
**Source — Micronutrients, not macros.**

---

## 2. Product Scope (v1)

### In Scope
1. **Photo → Foods (AI)** — Vision model parses meal photos into structured food list (name, grams, confidence)
2. **User Corrections** — Editable food list, portion adjustment, add/remove/replace; light clarifications (packaged vs homemade, wild vs farmed)
3. **Micronutrient Engine** — Vitamins, minerals, key fatty acids; per-meal, daily, weekly totals; banded signals (gray/yellow/green) + visible %DV
4. **Persistence & History** — Meals saved by day, editable after creation, recalculation supported
5. **Insights** — Today view (totals, top contributors, shortfalls); 7-day view (averages, wins, gaps)
6. **Safety & Transparency** — Confidence labels, no medical claims, App Store-safe wording

### Explicitly Out of Scope (v1)
- Calories as primary metric
- Macro optimization
- Barcode scanning
- Branded food search/browse as user-facing feature
- Supplements
- Meal plans or recipes
- Social features
- Android

---

## 3. Technical Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Expo (React Native), iOS only |
| **Auth** | Supabase Auth — native Apple Sign-In (primary), Google OAuth available |
| **Backend** | Supabase (Postgres, Storage, Edge Functions) |
| **AI** | Vision model for photo parsing (structured JSON output) |

### Platform Constraints
- iOS only
- Managed Expo
- Supabase for auth, DB, storage

---

## 4. Architecture Overview

### High-Level Flow
1. User captures photo
2. Image uploaded to Supabase Storage
3. Meal record created
4. Vision model parses foods (strict JSON schema)
5. Foods mapped to canonical IDs
6. User edits final items
7. Nutrients computed (client-side from bundled `foodProfiles.json`)
8. Results persisted to `meals` table

### Dual Food Representation (Critical)
Each meal stores two versions:
- **parsed_items** — Raw AI output, versioned by model_version, never overwritten
- **final_items** — User-approved canonical foods + grams; used for all nutrient computation

**These must never be merged.** Enables model upgrades, nutrient DB upgrades, safe recomputation.

### Nutrient Computation (Current)
- **Client-side** from bundled `src/data/foodProfiles.json`
- map-foods returns mapped items only; app computes totals via `mealNutrients.ts`
- Vitamin K %DV = K1 + K2 combined
- 22 nutrients tracked (vitamins A/C/D/E/K/K2, B vitamins, minerals, omega-3)

### Canon Lookup (Bundled, No DB)
- `parse-meal` and `map-foods` both use bundled `canon-lookup.json` (built by `npm run canon:lookup`)
- No Supabase reads for `canonical_foods` or `canonical_food_aliases` at runtime
- Same canon source as foodProfiles; sync-preview-to-db is optional for other uses

---

## 5. Canonical Food DB (v1)

### Design Philosophy
- **List-first canon** — Fixed gold set of foods; each maps to explicit nutrient source rows
- **Strict curation** — No runtime fallback substitution; each canon item must map to an explicit source row
- **Provenance required** — Every data change must be traceable (source, URL/DOI)

### Key Files
| File | Purpose |
|------|---------|
| `source-canon-v1.json` | Founder-provided canon list (schema, principles, groups) |
| `source-canon-v1.flat.json` | Built canon rows with stable `canonical_id` |
| `source-canon-v1.manual-curation.json` | Per-item source mapping (canonical_id → fdc_id) |
| `source-canon-v1.supplemental-source-rows.json` | External/online rows when USDA insufficient |
| `source-canon-v1.reseed-preview.json` | One row per food with winning `per_100g` |
| `source-canon-v1.vitamin-k2-patches.json` | K2 values patched post-reseed |
| `source-canon-v1.mineral-patches.json` | Mg, P, K, Zn, Se for venison, nori, dulse, chlorella |
| `source-canon-v1.animal-vitamin-zero-patches.json` | Cited A/D/E/K/B values for animal products |
| `source-canon-v1.external-provenance.json` | Sections: vitamin_k2, biotin, vitamin_zero, mineral_patches |

### Canon Principles
- Single-ingredient only
- Exclude branded/restaurant items
- Exclude composite dishes
- Default state: raw baseline (unless inherently processed)
- ~324 foods in canon

### Patch System
- **K2 patches** — Applied after reseed; overwrite preview file
- **Mineral patches** — Venison, nori, dulse, chlorella (USDA gaps)
- **Animal vitamin-zero patches** — Replace reported 0 with cited values only
- **Biotin patches** — Fill animal-domain blanks
- All patches require provenance (source + URL)

---

## 6. Data Flow (End-to-End)

```
[ source-canon-v1.json ] → canon:build → [ flat.json ]
         +
[ USDA CSVs + supplemental-source-rows.json ]
         +
[ manual-curation.json (canonical_id → fdc_id) ]
         |
         v
    canon:reseed:dry → [ reseed-preview.json ]
         |
         +-- canon:k2-patches
         +-- canon:mineral-patches
         |
         v
[ preview file on disk ]
         |
         +-- canon:matrix:build → matrix + coverage
         +-- canon:top-foods → topFoodsByNutrient.json
         +-- canon:food-profiles → foodProfiles.json → APP (Capture, Home, History, FoodDetail)
         +-- canon:lookup → canon-lookup.json → parse-meal, map-foods
         +-- canon:sync-preview-to-db → Supabase canonical_foods (optional)
```

**Critical:** Nutrients in the app come from `foodProfiles.json` (bundled). Meal totals are computed client-side. The DB `canonical_foods` is only used if sync-preview-to-db is run; otherwise it can be stale.

---

## 7. Canon Pipeline (Run After Any Data Change)

1. `canon:build` — flat from source-canon-v1.json
2. `canon:provenance:build` — provenance manifest
3. `canon:reseed:dry` — reseed-preview
4. `canon:k2-patches` — apply K2
5. `canon:mineral-patches` — apply mineral patches
6. `canon:mineral-provenance` — if mineral patches changed
7. `canon:matrix:build` — matrix + coverage
8. `canon:top-foods` — topFoodsByNutrient.json
9. `canon:food-profiles` — foodProfiles.json
10. `canon:lookup` — canon-lookup.json for edge functions
11. `canon:sync-preview-to-db` — push to Supabase (when DB should match)

**Rule:** Every data change must be full-stack + provenance. No exceptions.

---

## 8. App Screens & Navigation

### Tabs
- **Home** — Today's totals, top contributors, shortfalls; 7-day averages
- **Capture** — Photo capture, AI parse, editable food list, nutrient totals
- **History** — Meals by date; save/edit/delete; photo thumbnails
- **Saved** — Saved meals; log (creates meal, copies items); refetch on focus
- **Discover** — Searchable list of all canon foods; tap → FoodDetail

### Stack Screens (modal/drill-down)
- **NutrientDetail** — Tap nutrient → description, deficiency, top 15 foods
- **FoodDetail** — Tap food → full micronutrient profile per 100g; nutrients tappable to NutrientDetail

### Key UX Decisions
- No estimate/precise mode toggle; unified nutrient experience
- Signal bands (gray/yellow/green) + %DV on nutrient bars
- Confidence only on initial "Parsed foods (AI)" list
- Manual meals: `photo_path: null`; no fake placeholder images

---

## 9. Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `parse-meal` | Vision model call; returns structured food list; uses bundled canon-lookup |
| `map-foods` | Maps parsed items to canonical_id; returns items only (app computes nutrients) |
| `search-foods` | Lexical search for manual food entry; `verify_jwt: false` in config |

All use bundled `canon-lookup.json`; no DB reads for canon catalog.

---

## 10. AI Rules & Guardrails

- AI identifies foods and estimates grams; outputs strict JSON
- AI is **not** a source of truth
- Confidence must be surfaced; low-confidence easy to edit
- If unsure, return fewer items, not more
- No medical advice; no disease prevention/treatment claims
- AI output always validated; frontend allows full user override

### Recent AI Fixes
- HEIC → JPEG conversion for Vision API compatibility
- No-visible-food guard: black/blank photo returns empty items (no hallucination)

---

## 11. Nutrient UX Contract

- Single experience: bands + %DV + quantity/unit editing
- No mode toggle
- Vitamin K %DV = K1 + K2 combined
- 22 nutrients; %DV from fixed daily values
- Nutrient bars tappable → NutrientDetail (description, deficiency, top foods)
- Food rows tappable → FoodDetail (per-100g profile)

---

## 12. Data Quality & Completeness

### Rules (Always Apply)
- **Completeness over all else** — Prefer real values over blanks
- **Use web search** — USDA FDC, NIH ODS, BLS, literature
- **No made-up values** — Only cited, same-food (or documented proxy) values
- **Animal products** — Replace reported 0 for A/D/E/K/B when source exists

### Current Coverage (as of recent handoffs)
- ~324 canon foods
- Biotin: 205 reported; 0 animal blanks
- Animal vitamin zeros: reduced via cited patches
- Mineral patches: venison, nori, dulse, chlorella filled

---

## 13. Roadmap & Future Concepts

### Near-Term (from ROADMAP.md)
1. Complete single-mode cleanup
2. Data quality hardening (validate completeness, fix sparse vectors)
3. Nutrient education drill-down (tap → function/deficiency/top foods) — **DONE**
4. Micronutrient matrix export — **DONE**
5. QA checklist for capture/edit/restart

### Future Concepts (Founder Notes)
1. **Nutrient drill-down** — Tap nutrient → high-source foods, context — **DONE**
2. **Ingredient detail** — Tap ingredient → per-100g profile, notes — **DONE** (FoodDetailScreen)
3. **Bioavailability layer** — Informational notes/scores with conservative wording
4. **Effective RDA research** — How goals/context affect interpretation (research only; high-risk)

### Safety Guardrails
- No personalized medical advice
- No diagnosis/treatment framing
- Educational wording; transparent uncertainty

---

## 14. Evolution Highlights (from Handoffs)

| Phase | Key Changes |
|-------|-------------|
| Days 1–6 | App shell, auth, camera, AI parse, nutrients, persistence, robustness |
| Day 13 | Unified nutrient UX; decimal input; photo semantics; pull-to-refresh |
| Day 18 | Strict curation; supplemental sources; full provenance; 324 foods resolved |
| Day 20 | Animal biotin + vitamin-zero patches; data-completeness rule |
| Day 21 | Nutrient click-through; food suggestions 401 fix; minerals audit; beef vitamin patches |
| Day 22 | Mineral patches (venison, nori, dulse, chlorella); whole-wheat-pasta fix; provenance |
| Day 23 | Client-side nutrients (biotin fix); bundled canon lookup; saved meals; refetch on focus |
| Day 24 | HEIC→JPEG; no-visible-food guard; beef cut names; parse-meal bundled canon; app icon |

---

## 15. Known Technical Debt & Notes

- **npm audit:** 19 high remain (minimatch/glob in RN/Expo); fix on next upgrade
- **match-audit.json** — Gitignored; reseed-generated
- **sync-preview-to-db** — Optional; app uses bundled foodProfiles, not DB, for nutrients
- **App icon** — app.json points to assets; native may need prebuild to refresh

---

## 16. Decision Rules

1. **Scope:** If a feature doesn't convert photos to micronutrient insight or make it more accurate/usable, it doesn't belong in v1.
2. **Uncertainty:** If a feature conflicts with honest uncertainty handling, redesign before shipping.
3. **Data:** Every canon/data change must be full-stack + provenance. No exceptions.
4. **Scripts:** Run scripts yourself; don't ask user. No Co-authored-by on commits.

---

## 17. File Reference (Quick)

| Path | Purpose |
|-----|---------|
| `src/screens/CaptureScreen.tsx` | Photo capture, parse, map, edit, nutrients |
| `src/screens/HomeScreen.tsx` | Today totals, shortfalls, 7-day |
| `src/screens/HistoryScreen.tsx` | Meals by date, save/edit/delete |
| `src/screens/SavedMealsScreen.tsx` | Saved meals, log |
| `src/screens/DiscoverScreen.tsx` | Search foods, tap → FoodDetail |
| `src/screens/FoodDetailScreen.tsx` | Per-100g profile |
| `src/screens/NutrientDetailScreen.tsx` | Nutrient description, deficiency, top foods |
| `src/lib/mealNutrients.ts` | Client-side nutrient computation |
| `src/data/foodProfiles.json` | Bundled per_100g (app source of truth) |
| `src/data/topFoodsByNutrient.json` | Top foods per nutrient |
| `supabase/functions/parse-meal/` | Vision AI parsing |
| `supabase/functions/map-foods/` | Canonical mapping |
| `scripts/reseed-canon-v1.js` | Core reseed logic |
| `.cursor/rules/` | canon-pipeline, canon-data-and-provenance, data-completeness, user-preferences |

---

## 18. Brainstorming Hooks

Use these as prompts for next-direction brainstorming:

1. **Bioavailability** — How could Source surface absorption context (e.g., iron + vitamin C) without making medical claims?
2. **Effective RDA** — Could goals (e.g., athletic, pregnancy, aging) change how %DV is interpreted? What evidence/safety framework would be needed?
3. **Discover UX** — How could Discover become more than a searchable list? Categories? "Foods like this"? Weekly highlights?
4. **Saved meals** — What patterns emerge from saved meals? Could they power "log again" or "similar meals"?
5. **Confidence & correction** — How could the app learn from user corrections to improve future parses?
6. **Data gaps** — 119 foods still missing biotin (mostly plant/fermented/fungi). What's the right completeness bar?
7. **Insights depth** — Today/7-day is basic. What would make insights genuinely actionable without being prescriptive?
8. **Platform** — Android, web, or API for other apps? (Currently out of scope but worth considering.)
9. **B2B / research** — Could the canon + provenance system support research or institutional use?
10. **Engagement** — No gamification per principles. What keeps users coming back without streaks/badges?

---

*Generated from README, docs/, .cursor/rules, and codebase exploration. Use for product brainstorming and cross-tool alignment.*
