# Day 23 Handoff (Source)

Handoff for client-side nutrients, bundled canon lookup for map-foods, saved meals (save/log), tab refetch on focus, History/Capture UI improvements, confidence cleanup, and capture loading/hint tweaks.

## Session Intent (Founder)
- Fix biotin (and nutrients) showing 0 on capture/logging by using bundled data instead of stale DB.
- Optionally remove Supabase dependency for canonical lookup in map-foods; bundle lookup with the function.
- Add option to save meals and log saved meals; ensure Saved list and Home/History refresh when appropriate.
- Improve History and Capture UI (loading screen, confidence, hints).

## What Was Completed

### 1) Client-side nutrient computation (biotin fix)
- **Issue:** Biotin (and other nutrients) showed 0 on the capture/logging screen because map-foods used `canonical_foods` in Supabase, which was often out of sync with the canon.
- **Change:** Nutrients are now computed in the app from bundled `src/data/foodProfiles.json` (same source as food detail pages). Map-foods only returns mapped items; the app computes item and meal totals and persists them to `meals` (final_items, nutrient_totals, nutrient_db_version, insights).
- **New module:** `src/lib/mealNutrients.ts` — `addNutrientsFromFoodProfiles`, `computeMealTotalsAndInsights`, Vitamin K %DV (K1+K2 combined), NUTRIENT_DB_VERSION.
- **CaptureScreen:** Uses mealNutrients for mapping response and for loadMealForEdit; writes nutrient_totals and insights to `meals` after mapping and when loading for edit.

### 2) Bundled canon lookup for map-foods
- **Goal:** map-foods no longer reads `canonical_foods` or `canonical_food_aliases` in Supabase; same canon source as foodProfiles.
- **Build script:** `scripts/build-canon-lookup.js` reads `source-canon-v1.reseed-preview.json`, writes `supabase/functions/map-foods/canon-lookup.json` (array of { canonical_id, canonical_name, aliases, usable }). npm `canon:lookup`; run after reseed when canon/aliases change.
- **map-foods:** Loads `canon-lookup.json` at cold start (cached); builds byId/lookup/usableIds from it; no Supabase select for canonical_foods or canonical_food_aliases. Still uses Supabase to update `meals.final_items`.
- **Pipeline:** `.cursor/rules/canon-pipeline.mdc` step 10 = `canon:lookup`; step 11 = sync-preview-to-db.

### 3) Saved meals (save and log)
- **DB:** `supabase/migrations/20260224_saved_meals.sql` — table `saved_meals` (id, user_id, name, items jsonb, created_at) with RLS (insert/select/update/delete own).
- **Saved tab:** New tab "Saved" (bookmark icon); `SavedMealsScreen` lists saved meals (name + item summary), **Log** (creates meal with photo_path null, copies items, computes totals client-side, navigates to Capture with new mealId), **Delete** (with confirm).
- **Save meal:** From **History** — each meal row has Save (with Edit/Delete); modal for name, then insert into saved_meals and navigate to Saved. From **Capture** (manual/edit) — "Save meal" button when there are mapped items; same name modal and insert. Only meals with mapped final_items (canonical_id + grams) can be saved.
- **Navigation:** Tab navigation uses each screen’s `navigation.navigate("Saved")` or `navigation.navigate("Capture", { mealId })` (not getParent()), so the correct tab navigator handles the action.

### 4) Refetch on tab focus
- **Saved:** `useFocusEffect` in SavedMealsScreen refetches saved meals when the Saved tab is focused — newly saved meals appear immediately after saving from History or Capture.
- **History:** `useFocusEffect` refetches meals for selected date and month when the History tab is focused — newly logged meals (from Saved or Capture) show up when switching to History.
- **Home:** `useFocusEffect` calls `loadToday()` when the Home tab is focused — today’s totals and meal count refresh after logging.

### 5) History UI
- **Meal summary:** 2-line cap with ellipsis; `minWidth: 0` on details container so text doesn’t wrap character-by-character.
- **Actions:** Save / Edit / Delete replaced with icon buttons (bookmark, pencil, trash) to free space and reduce clutter.

### 6) Capture loading screen
- **Overlay on photo:** While uploading/parsing/mapping, a semi-transparent overlay on the photo shows one spinner and one status line: “Uploading…”, “Analyzing photo…”, or “Matching foods…”.
- **No technical IDs:** Removed “Uploaded to: path” and “Meal created: uuid” banners; single success line after completion: “Photo saved. Review or edit items below.”
- **Photo preview:** Wrapper with light gray background and `resizeMode="cover"`; button label stays “Use photo” (disabled during upload).

### 7) Confidence
- **Only on initial parse:** Confidence badges appear only in the “Parsed foods (AI)” list (right after the image is parsed). Not shown in Editable foods, Canonical selected foods, History, or Home.
- **No avg confidence:** Removed “Avg confidence: X%” from History and Home; removed `computeAverageConfidence` and related state from both.

### 8) Capture hint and disclaimer
- **After upload or items:** The “Update foods above and tap Recalculate nutrients…” hint and the “Source uses quantity…” disclaimer are shown only when `uploadPath` or `parsedItems !== null` or `editableItems.length > 0` — i.e. not before the user has uploaded the photo or added foods.

## Key Files Updated (This Session)
- **App:** `src/lib/mealNutrients.ts` (new), `src/screens/CaptureScreen.tsx` (nutrients from bundle, save meal modal, focus refetch, loading overlay, hint/disclaimer conditional), `src/screens/HistoryScreen.tsx` (save meal modal + icon actions, focus refetch, meal summary ellipsis, no avg confidence), `src/screens/HomeScreen.tsx` (focus refetch, no avg confidence), `src/screens/SavedMealsScreen.tsx` (new), `src/navigation/AppNavigator.tsx` (Saved tab).
- **Supabase:** `supabase/functions/map-foods/index.ts` (load canon-lookup.json, remove DB reads), `supabase/functions/map-foods/canon-lookup.json` (generated), `supabase/migrations/20260224_saved_meals.sql` (new).
- **Scripts:** `scripts/build-canon-lookup.js` (new); `package.json` (`canon:lookup`).
- **Rules:** `.cursor/rules/canon-pipeline.mdc` (step 10 = canon:lookup, step 11 = sync-preview-to-db).

## Commits Landed
- Compute nutrients from bundled foodProfiles; map-foods returns items only, app persists totals.
- Bundle canon lookup for map-foods; no DB reads for canonical_foods or aliases.
- Add saved meals: save from History/Capture, log from Saved tab; refetch Home/History/Saved on tab focus.
- History: icon actions + ellipsis for meal summary.
- Capture loading UI: overlay on photo, step status, no technical IDs.
- Show confidence only on initial parse; remove avg confidence from History and Home.
- Remove avg confidence from Home screen.
- Show hint and disclaimer only after photo upload or when foods added.

## Current State Snapshot
- **Nutrients:** Capture and meal totals use `foodProfiles.json`; biotin and other nutrients show correctly. Supabase `canonical_foods` is no longer used for nutrients; sync-preview-to-db is optional for other uses.
- **map-foods:** Uses bundled `canon-lookup.json` (build with `npm run canon:lookup` after reseed); no DB reads for canon or aliases.
- **Saved meals:** Users can save a meal from History or Capture (name modal), then open the Saved tab to log it (creates meal, then navigates to Capture). Home, History, and Saved refetch when their tab is focused.
- **History:** Meal rows use icon actions (save/edit/delete); summary text is 2-line ellipsized. No avg confidence.
- **Capture:** Loading shows overlay on photo with one status line and spinner; no UUIDs; success message “Photo saved. Review or edit items below.” Hint and disclaimer only after upload or when items exist. Confidence only on “Parsed foods (AI)” list.
- **Home:** No avg confidence.
- **Pipeline:** After reseed: K2 → mineral patches → matrix → top-foods → food-profiles → **canon:lookup** → sync-preview-to-db when DB should match.
